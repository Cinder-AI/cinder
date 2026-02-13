import asyncio
import json
import os
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Literal
from urllib import request as urllib_request

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from broker import SSEBroker
from cmc import CoinMarketCapFeed
from schemas import (
    BrokerStatsResponse,
    CampaignRow,
    CampaignSnapshotResponse,
    CampaignUpdatedEventData,
    CampaignUpdatedPayload,
    CampaignUpdatedResponse,
    CampaignUpdatedWebhookEnvelope,
    CandlePoint,
    ChartHistoryResponse,
    ChartSummary,
    ChartSeriesPoint,
    HealthResponse,
    HeartbeatEventData,
    ReadyEventData,
    TradeRow,
    TradeCreatedEventData,
    TradeCreatedResponse,
    TradeInsertPayload,
)

INDEXER_URL = os.getenv("INDEXER_URL", "http://host.docker.internal:8080")
HEARTBEAT_INTERVAL_SECONDS = int(os.getenv("SSE_HEARTBEAT_SECONDS", "15"))
HASURA_ADMIN_SECRET = os.getenv("HASURA_GRAPHQL_ADMIN_SECRET")
DEFAULT_CHART_WINDOW_SEC = int(os.getenv("CHART_DEFAULT_WINDOW_SEC", "86400"))
DEFAULT_CHART_INTERVAL_SEC = int(os.getenv("CHART_DEFAULT_INTERVAL_SEC", "300"))
COINMK_API_KEY = os.getenv("COINMK_API_KEY")
COINMK_API_ENDPOINT = os.getenv("COINMK_API_ENDPOINT")
COINMK_SYMBOL = os.getenv("COINMK_SYMBOL", "FUEL")
COINMK_POLL_SECONDS = int(os.getenv("COINMK_POLL_SECONDS", "20"))

app = FastAPI(title="cinder-sse-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_sse(event_name: str, data: BaseModel | dict[str, Any], event_id: str | None = None) -> str:
    payload = data.model_dump_json() if isinstance(data, BaseModel) else json.dumps(data, ensure_ascii=False)
    lines: list[str] = []
    if event_id:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event_name}")
    lines.append(f"data: {payload}")
    return "\n".join(lines) + "\n\n"


broker = SSEBroker.instance()
cmc_feed = CoinMarketCapFeed(
    api_key=COINMK_API_KEY,
    endpoint=COINMK_API_ENDPOINT,
    symbol=COINMK_SYMBOL,
    convert="USD",
    poll_seconds=COINMK_POLL_SECONDS,
)


@app.on_event("startup")
async def _on_startup() -> None:
    await cmc_feed.start()


@app.on_event("shutdown")
async def _on_shutdown() -> None:
    await cmc_feed.stop()


def _graphql_endpoint() -> str:
    if INDEXER_URL.endswith("/v1/graphql"):
        return INDEXER_URL
    return f"{INDEXER_URL.rstrip('/')}/v1/graphql"


def _parse_int(value: str | int | None, default: int = 0) -> int:
    if value is None:
        return default
    if isinstance(value, int):
        return value
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _scaled_to_price(price_scaled: str | None) -> float:
    if not price_scaled:
        return 0.0
    try:
        return float(Decimal(price_scaled) / Decimal(1_000_000_000))
    except (InvalidOperation, ValueError):
        return 0.0


def _to_usd(amount_in_fuel: float | None, fuel_usd: float | None) -> float | None:
    if amount_in_fuel is None or fuel_usd is None:
        return None
    return round(amount_in_fuel * fuel_usd, 12)


def _parse_float(value: str | int | float | None, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, float):
        return value
    if isinstance(value, int):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _fetch_trades(campaign_id: str, from_ts: int, to_ts: int) -> list[TradeRow]:
    query_template = """
    query Trades($campaignId: String!, $from: {ts_type}!, $to: {ts_type}!) {{
      Trade(
        where: {{
          campaign_id: {{ _eq: $campaignId }}
          timestamp: {{ _gte: $from, _lte: $to }}
          price_scaled: {{ _is_null: false }}
        }}
        order_by: [{{ timestamp: asc }}, {{ block_height: asc }}]
      ) {{
        id
        campaign_id
        side
        amount_token
        amount_base
        price_scaled
        price
        timestamp
        block_height
      }}
    }}
    """
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if HASURA_ADMIN_SECRET:
        headers["x-hasura-admin-secret"] = HASURA_ADMIN_SECRET

    last_errors: list[dict[str, Any]] | None = None

    # Different deployments expose Trade.timestamp as numeric or bigint.
    for ts_type in ("numeric", "bigint"):
        query = query_template.format(ts_type=ts_type)
        payload = {"query": query, "variables": {"campaignId": campaign_id, "from": str(from_ts), "to": str(to_ts)}}
        body = json.dumps(payload).encode("utf-8")
        req = urllib_request.Request(_graphql_endpoint(), data=body, headers=headers, method="POST")

        with urllib_request.urlopen(req, timeout=10) as resp:  # nosec B310 - URL is controlled by env
            if resp.status != 200:
                raise HTTPException(status_code=502, detail=f"Indexer GraphQL request failed: {resp.status}")
            data = json.loads(resp.read().decode("utf-8"))

        errors = data.get("errors")
        if not errors:
            trades = data.get("data", {}).get("Trade", [])
            return [TradeRow.model_validate(item) for item in trades]

        last_errors = errors
        errors_str = json.dumps(errors, ensure_ascii=False)
        if "where 'numeric' is expected" in errors_str or "where 'bigint' is expected" in errors_str:
            continue
        raise HTTPException(status_code=502, detail=f"Indexer GraphQL errors: {errors}")

    raise HTTPException(status_code=502, detail=f"Indexer GraphQL errors: {last_errors}")


def _fetch_campaign_row(campaign_id: str) -> CampaignRow | None:
    query = """
    query CampaignSnapshot($campaignId: String!) {
      Campaign(where: { id: { _eq: $campaignId } }, limit: 1) {
        id
        current_price
        current_price_scaled
        total_volume_base
        total_pledged
        curve_sold_supply
        curve_max_supply
        token_decimals
        status
      }
    }
    """
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if HASURA_ADMIN_SECRET:
        headers["x-hasura-admin-secret"] = HASURA_ADMIN_SECRET

    payload = {"query": query, "variables": {"campaignId": campaign_id}}
    body = json.dumps(payload).encode("utf-8")
    req = urllib_request.Request(_graphql_endpoint(), data=body, headers=headers, method="POST")

    with urllib_request.urlopen(req, timeout=10) as resp:  # nosec B310 - URL is controlled by env
        if resp.status != 200:
            raise HTTPException(status_code=502, detail=f"Indexer GraphQL request failed: {resp.status}")
        data = json.loads(resp.read().decode("utf-8"))

    errors = data.get("errors")
    if errors:
        raise HTTPException(status_code=502, detail=f"Indexer GraphQL errors: {errors}")

    rows = data.get("data", {}).get("Campaign", [])
    if not rows:
        return None
    return CampaignRow.model_validate(rows[0])


async def _build_campaign_updated_event_data(
    row: CampaignRow, op: Literal["INSERT", "UPDATE", "DELETE", "MANUAL"] = "MANUAL"
) -> CampaignUpdatedEventData:
    sold_supply = _parse_int(row.curve_sold_supply)
    max_supply = _parse_int(row.curve_max_supply)
    token_decimals = row.token_decimals or 0
    progress = round((sold_supply / max_supply) * 100, 4) if max_supply > 0 else None
    market_cap_base = None
    current_price_scaled_int = _parse_int(row.current_price_scaled)
    if current_price_scaled_int > 0 and max_supply > 0:
        supply_human = max_supply
        if token_decimals > 0:
            supply_human = max_supply // (10**token_decimals)
        market_cap_base = str((current_price_scaled_int * supply_human) // 1_000_000_000)

    quote = await cmc_feed.get_quote()
    current_price_fuel = _scaled_to_price(row.current_price_scaled)
    volume_base_fuel = _parse_float(row.total_volume_base)
    market_cap_base_fuel = _parse_float(market_cap_base) if market_cap_base is not None else None
    return CampaignUpdatedEventData(
        op=op,
        campaignId=row.id,
        currentPrice=row.current_price,
        currentPriceScaled=row.current_price_scaled,
        currentPriceUsd=_to_usd(current_price_fuel, quote.price if quote else None),
        totalVolumeBase=row.total_volume_base,
        totalVolumeUsd=_to_usd(volume_base_fuel, quote.price if quote else None),
        totalPledged=row.total_pledged,
        progress=progress,
        curveSoldSupply=row.curve_sold_supply,
        curveMaxSupply=row.curve_max_supply,
        marketCapBase=market_cap_base,
        marketCapUsd=_to_usd(market_cap_base_fuel, quote.price if quote else None),
        fuelUsd=quote.price if quote else None,
        fuelUsdUpdatedAt=quote.updated_at if quote else None,
        status=row.status,
        updatedAt=_now_iso(),
    )


def _build_chart_points(
    trades: list[TradeRow], interval_sec: int, fuel_usd: float | None = None
) -> tuple[list[ChartSeriesPoint], list[CandlePoint]]:
    if not trades:
        return [], []

    series: list[ChartSeriesPoint] = []
    candles_map: dict[int, CandlePoint] = {}

    for trade in trades:
        ts = _parse_int(trade.timestamp)
        price_scaled = trade.price_scaled
        if ts <= 0 or not price_scaled:
            continue

        price_value = _scaled_to_price(price_scaled)
        series.append(
            ChartSeriesPoint(t=ts, price_scaled=price_scaled, price=price_value, price_usd=_to_usd(price_value, fuel_usd))
        )

        bucket = (ts // interval_sec) * interval_sec
        amount_base = _parse_int(trade.amount_base)
        amount_token = _parse_int(trade.amount_token)

        if bucket not in candles_map:
            candles_map[bucket] = CandlePoint(
                t=bucket,
                o=price_scaled,
                h=price_scaled,
                l=price_scaled,
                c=price_scaled,
                v_base=str(amount_base),
                v_token=str(amount_token),
                n=1,
            )
            continue

        candle = candles_map[bucket]
        candle.c = price_scaled
        candle.h = str(max(_parse_int(candle.h), _parse_int(price_scaled)))
        candle.l = str(min(_parse_int(candle.l), _parse_int(price_scaled)))
        candle.v_base = str(_parse_int(candle.v_base) + amount_base)
        candle.v_token = str(_parse_int(candle.v_token) + amount_token)
        candle.n += 1

    candles = sorted(candles_map.values(), key=lambda c: c.t)
    return series, candles


def _fill_candle_gaps(candles: list[CandlePoint], from_ts: int, to_ts: int, interval_sec: int) -> list[CandlePoint]:
    if not candles:
        return []

    start_bucket = (from_ts // interval_sec) * interval_sec
    end_bucket = (to_ts // interval_sec) * interval_sec
    by_bucket = {candle.t: candle for candle in candles}
    filled: list[CandlePoint] = []
    last_close = candles[0].o

    for bucket in range(start_bucket, end_bucket + 1, interval_sec):
        candle = by_bucket.get(bucket)
        if candle is not None:
            filled.append(candle)
            last_close = candle.c
            continue

        filled.append(
            CandlePoint(
                t=bucket,
                o=last_close,
                h=last_close,
                l=last_close,
                c=last_close,
                v_base="0",
                v_token="0",
                n=0,
            )
        )

    return filled


def _build_chart_summary(trades: list[TradeRow], fuel_usd: float | None = None) -> ChartSummary:
    if not trades:
        return ChartSummary()

    valid_prices = [trade.price_scaled for trade in trades if trade.price_scaled]
    if not valid_prices:
        volume_base = sum(_parse_int(trade.amount_base) for trade in trades)
        return ChartSummary(
            volumeBase=str(volume_base),
            volumeUsd=_to_usd(float(volume_base), fuel_usd),
            volumeToken=str(sum(_parse_int(trade.amount_token) for trade in trades)),
            tradeCount=len(trades),
        )

    first_scaled = valid_prices[0]
    last_scaled = valid_prices[-1]
    high_scaled = max(valid_prices, key=_parse_int)
    low_scaled = min(valid_prices, key=_parse_int)

    first_price = _scaled_to_price(first_scaled)
    last_price = _scaled_to_price(last_scaled)
    change_pct = 0.0
    if first_price > 0:
        change_pct = round(((last_price - first_price) / first_price) * 100, 4)

    volume_base = sum(_parse_int(trade.amount_base) for trade in trades)
    return ChartSummary(
        firstPriceScaled=first_scaled,
        lastPriceScaled=last_scaled,
        firstPrice=first_price,
        firstPriceUsd=_to_usd(first_price, fuel_usd),
        lastPrice=last_price,
        lastPriceUsd=_to_usd(last_price, fuel_usd),
        priceChangePct=change_pct,
        highPriceScaled=high_scaled,
        lowPriceScaled=low_scaled,
        highPrice=_scaled_to_price(high_scaled),
        highPriceUsd=_to_usd(_scaled_to_price(high_scaled), fuel_usd),
        lowPrice=_scaled_to_price(low_scaled),
        lowPriceUsd=_to_usd(_scaled_to_price(low_scaled), fuel_usd),
        volumeBase=str(volume_base),
        volumeUsd=_to_usd(float(volume_base), fuel_usd),
        volumeToken=str(sum(_parse_int(trade.amount_token) for trade in trades)),
        tradeCount=len(trades),
    )


@app.get("/healthz")
async def healthz() -> HealthResponse:
    return HealthResponse(ok=True, indexer_url=INDEXER_URL)


@app.get("/broker_stats")
async def broker_stats() -> BrokerStatsResponse:
    return BrokerStatsResponse(ok=True, subscriptions=await broker.stats())


@app.get("/sse")
async def sse(request: Request, campaignId: str | None = Query(default=None)) -> StreamingResponse:
    channel = campaignId or "*"
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=200)
    await broker.subscribe(channel, queue)

    async def event_stream():
        ready_data = ReadyEventData(channel=channel, connectedAt=_now_iso())
        yield _to_sse("ready", ready_data)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_INTERVAL_SECONDS)
                    yield msg
                except asyncio.TimeoutError:
                    heartbeat_data = HeartbeatEventData(channel=channel, ts=_now_iso())
                    yield _to_sse("heartbeat", heartbeat_data)
        finally:
            await broker.unsubscribe(channel, queue)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


@app.post("/campaign_updated")
async def campaign_updated(
    webhook: CampaignUpdatedPayload | CampaignUpdatedWebhookEnvelope,
) -> JSONResponse:
    payload = webhook.payload if isinstance(webhook, CampaignUpdatedWebhookEnvelope) else webhook

    row = payload.event.data.new or payload.event.data.old
    if row is None:
        raise HTTPException(status_code=400, detail="Invalid payload: missing event.data.new/old")

    event_data = await _build_campaign_updated_event_data(row, op=payload.event.op)
    msg = _to_sse("campaign_updated", event_data, event_id=payload.id)
    delivered = await broker.publish_campaign(row.id, msg)

    response = CampaignUpdatedResponse(ok=True, campaignId=row.id, delivered=delivered)
    return JSONResponse(response.model_dump())


@app.get("/campaign/snapshot")
async def campaign_snapshot(campaignId: str = Query(...)) -> CampaignSnapshotResponse:
    row = await asyncio.to_thread(_fetch_campaign_row, campaignId)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Campaign not found: {campaignId}")

    snapshot = await _build_campaign_updated_event_data(row, op="MANUAL")
    return CampaignSnapshotResponse(ok=True, campaignId=campaignId, snapshot=snapshot)


@app.post("/trade")
@app.post("/trade_updated")
async def trade_updated(payload: TradeInsertPayload) -> JSONResponse:
    row = payload.event.data.new
    quote = await cmc_feed.get_quote()
    price_fuel = _scaled_to_price(row.price_scaled)

    event_data = TradeCreatedEventData(
        tradeId=row.id,
        campaignId=row.campaign_id,
        side=row.side,
        amountBase=row.amount_base,
        amountToken=row.amount_token,
        priceScaled=row.price_scaled,
        price=row.price,
        priceUsd=_to_usd(price_fuel, quote.price if quote else None),
        timestamp=row.timestamp,
        blockHeight=row.block_height,
        fuelUsd=quote.price if quote else None,
        fuelUsdUpdatedAt=quote.updated_at if quote else None,
        updatedAt=_now_iso(),
    )
    msg = _to_sse("trade_created", event_data, event_id=payload.id)
    delivered = await broker.publish_campaign(row.campaign_id, msg)

    response = TradeCreatedResponse(
        ok=True,
        tradeId=row.id,
        campaignId=row.campaign_id,
        delivered=delivered,
    )
    return JSONResponse(response.model_dump())


@app.get("/chart/history")
async def chart_history(
    campaignId: str = Query(...),
    fromTs: int | None = Query(default=None),
    toTs: int | None = Query(default=None),
    intervalSec: int = Query(default=DEFAULT_CHART_INTERVAL_SEC, ge=10, le=86400),
) -> ChartHistoryResponse:
    now_ts = int(datetime.now(timezone.utc).timestamp())
    to_ts = toTs if toTs is not None else now_ts
    from_ts = fromTs if fromTs is not None else (to_ts - DEFAULT_CHART_WINDOW_SEC)
    if from_ts >= to_ts:
        raise HTTPException(status_code=400, detail="fromTs must be less than toTs")

    quote = await cmc_feed.get_quote()
    fuel_usd = quote.price if quote else None
    trades = await asyncio.to_thread(_fetch_trades, campaignId, from_ts, to_ts)
    series, candles = _build_chart_points(trades, intervalSec, fuel_usd=fuel_usd)
    summary = _build_chart_summary(trades, fuel_usd=fuel_usd)
    filled_candles = _fill_candle_gaps(candles, from_ts, to_ts, intervalSec)
    return ChartHistoryResponse(
        ok=True,
        campaignId=campaignId,
        fromTs=from_ts,
        toTs=to_ts,
        intervalSec=intervalSec,
        series=series,
        candles=filled_candles,
        summary=summary,
        fuelUsd=quote.price if quote else None,
        fuelUsdUpdatedAt=quote.updated_at if quote else None,
    )