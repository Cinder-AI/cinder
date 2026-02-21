import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from broker import SSEBroker
from cmc import CoinMarketCapFeed
from config import (
    INDEXER_URL,
    HEARTBEAT_INTERVAL_SECONDS,
    DEFAULT_CHART_WINDOW_SEC,
    DEFAULT_CHART_INTERVAL_SEC,
    COINMK_API_KEY,
    COINMK_API_ENDPOINT,
    COINMK_SYMBOL,
    COINMK_POLL_SECONDS,
)
from chart import build_chart_points, fill_candle_gaps, build_chart_summary
from events import build_campaign_updated_event_data, build_trade_created_event_data
from graphql import fetch_trades, fetch_campaign_row
from schemas import (
    BrokerStatsResponse,
    CampaignSnapshotResponse,
    CampaignUpdatedPayload,
    CampaignUpdatedWebhookEnvelope,
    CampaignUpdatedResponse,
    ChartHistoryResponse,
    HealthResponse,
    HeartbeatEventData,
    ReadyEventData,
    TradeInsertPayload,
    TradeCreatedResponse,
)
from utils import now_iso, to_sse


app = FastAPI(title="cinder-sse-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

broker = SSEBroker.instance()
cmc_feed = CoinMarketCapFeed(
    api_key=COINMK_API_KEY,
    endpoint=COINMK_API_ENDPOINT,
    symbol=COINMK_SYMBOL,
    convert="USD",
    poll_seconds=COINMK_POLL_SECONDS,
)


@app.on_event("startup")
async def on_startup() -> None:
    await cmc_feed.start()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await cmc_feed.stop()


# ============================================================================
# Health & Stats Routes
# ============================================================================

@app.get("/healthz")
async def healthz() -> HealthResponse:
    return HealthResponse(ok=True, indexer_url=INDEXER_URL)


@app.get("/broker_stats")
async def broker_stats() -> BrokerStatsResponse:
    return BrokerStatsResponse(ok=True, subscriptions=await broker.stats())


# ============================================================================
# SSE Route
# ============================================================================

@app.get("/sse")
async def sse(request: Request, campaignId: str | None = Query(default=None)) -> StreamingResponse:
    channel = campaignId or "*"
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=200)
    await broker.subscribe(channel, queue)

    async def event_stream():
        ready_data = ReadyEventData(channel=channel, connectedAt=now_iso())
        yield to_sse("ready", ready_data)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_INTERVAL_SECONDS)
                    yield msg
                except asyncio.TimeoutError:
                    heartbeat_data = HeartbeatEventData(channel=channel, ts=now_iso())
                    yield to_sse("heartbeat", heartbeat_data)
        finally:
            await broker.unsubscribe(channel, queue)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


# ============================================================================
# Campaign Routes
# ============================================================================

@app.post("/campaign_updated")
async def campaign_updated(
    webhook: CampaignUpdatedPayload | CampaignUpdatedWebhookEnvelope,
) -> JSONResponse:
    payload = webhook.payload if isinstance(webhook, CampaignUpdatedWebhookEnvelope) else webhook

    row = payload.event.data.new or payload.event.data.old
    if row is None:
        raise HTTPException(status_code=400, detail="Invalid payload: missing event.data.new/old")

    event_data = await build_campaign_updated_event_data(row, cmc_feed, op=payload.event.op)
    msg = to_sse("campaign_updated", event_data, event_id=payload.id)
    delivered = await broker.publish_campaign(row.id, msg)

    response = CampaignUpdatedResponse(ok=True, campaignId=row.id, delivered=delivered)
    return JSONResponse(response.model_dump())


@app.get("/campaign/snapshot")
async def campaign_snapshot(campaignId: str = Query(...)) -> CampaignSnapshotResponse:
    row = await asyncio.to_thread(fetch_campaign_row, campaignId)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Campaign not found: {campaignId}")

    snapshot = await build_campaign_updated_event_data(row, cmc_feed, op="MANUAL")
    return CampaignSnapshotResponse(ok=True, campaignId=campaignId, snapshot=snapshot)


@app.post("/campaign_migrated")
async def campaign_migrated():
    pass


# ============================================================================
# Trade Routes
# ============================================================================

@app.post("/trade")
@app.post("/trade_updated")
async def trade_updated(payload: TradeInsertPayload) -> JSONResponse:
    row = payload.event.data.new
    quote = await cmc_feed.get_quote()

    event_data = build_trade_created_event_data(
        row,
        fuel_usd=quote.price if quote else None,
        fuel_usd_updated_at=quote.updated_at if quote else None
    )
    msg = to_sse("trade_created", event_data, event_id=payload.id)
    delivered = await broker.publish_campaign(row.campaign_id, msg)

    response = TradeCreatedResponse(
        ok=True,
        tradeId=row.id,
        campaignId=row.campaign_id,
        delivered=delivered,
    )
    return JSONResponse(response.model_dump())


# ============================================================================
# Chart Routes
# ============================================================================

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
    trades = await asyncio.to_thread(fetch_trades, campaignId, from_ts, to_ts)
    series, candles = build_chart_points(trades, intervalSec, fuel_usd=fuel_usd)
    summary = build_chart_summary(trades, fuel_usd=fuel_usd)
    filled_candles = fill_candle_gaps(candles, from_ts, to_ts, intervalSec)

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
