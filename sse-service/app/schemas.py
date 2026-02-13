from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class HasuraHeader(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    value: str


class HasuraDeliveryInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    current_retry: int
    max_retries: int


class CampaignRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    created_at: str | None = None
    creator_id: str | None = None
    current_price: str | None = None
    current_price_scaled: str | None = None
    curve_base_price: str | None = None
    curve_max_supply: str | None = None
    curve_slope: str | None = None
    curve_sold_supply: str | None = None
    image: str | None = None
    status: str | None = None
    target: str | None = None
    token_asset_id: str | None = None
    token_decimals: int | None = None
    token_description: str | None = None
    token_image: str | None = None
    token_name: str | None = None
    token_ticker: str | None = None
    total_pledged: str | None = None
    total_volume_base: str | None = None


class HasuraEventData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    new: CampaignRow | None = None
    old: CampaignRow | None = None


class HasuraEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: HasuraEventData
    op: Literal["INSERT", "UPDATE", "DELETE", "MANUAL"]
    session_variables: dict[str, str] | None = None
    trace_context: dict[str, Any] | None = None


class HasuraTable(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    name: str
    schema_name: str = Field(alias="schema")


class HasuraTrigger(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str


class CampaignUpdatedPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    created_at: str
    delivery_info: HasuraDeliveryInfo
    event: HasuraEvent
    id: str
    table: HasuraTable
    trigger: HasuraTrigger


class CampaignUpdatedWebhookEnvelope(BaseModel):
    model_config = ConfigDict(extra="ignore")

    headers: list[HasuraHeader] = Field(default_factory=list)
    payload: CampaignUpdatedPayload
    version: str | None = None


class ReadyEventData(BaseModel):
    type: Literal["ready"] = "ready"
    channel: str
    connectedAt: str


class HeartbeatEventData(BaseModel):
    type: Literal["heartbeat"] = "heartbeat"
    channel: str
    ts: str


class CampaignUpdatedEventData(BaseModel):
    type: Literal["campaign_updated"] = "campaign_updated"
    op: Literal["INSERT", "UPDATE", "DELETE", "MANUAL"]
    campaignId: str
    currentPrice: str | None = None
    currentPriceScaled: str | None = None
    currentPriceUsd: float | None = None
    totalVolumeBase: str | None = None
    totalVolumeUsd: float | None = None
    totalPledged: str | None = None
    progress: float | None = None
    curveSoldSupply: str | None = None
    curveMaxSupply: str | None = None
    marketCapBase: str | None = None
    marketCapUsd: float | None = None
    fuelUsd: float | None = None
    fuelUsdUpdatedAt: str | None = None
    status: str | None = None
    updatedAt: str


class HealthResponse(BaseModel):
    ok: bool
    indexer_url: str


class BrokerStatsResponse(BaseModel):
    ok: bool
    subscriptions: dict[str, int]


class CampaignUpdatedResponse(BaseModel):
    ok: bool
    campaignId: str
    delivered: dict[str, int]


class CampaignSnapshotResponse(BaseModel):
    ok: bool
    campaignId: str
    snapshot: CampaignUpdatedEventData


class TradeRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    user_id: str | None = None
    campaign_id: str
    side: str | None = None
    amount_token: str | None = None
    amount_base: str | None = None
    price_scaled: str | None = None
    price: str | None = None
    timestamp: str
    tx_id: str | None = None
    block_height: str | None = None


class TradeInsertEventData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    new: TradeRow


class TradeInsertEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: TradeInsertEventData
    op: Literal["INSERT"]


class TradeInsertPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    created_at: str
    delivery_info: HasuraDeliveryInfo
    event: TradeInsertEvent
    id: str
    table: HasuraTable
    trigger: HasuraTrigger


class TradeCreatedEventData(BaseModel):
    type: Literal["trade_created"] = "trade_created"
    tradeId: str
    campaignId: str
    side: str | None = None
    amountBase: str | None = None
    amountToken: str | None = None
    priceScaled: str | None = None
    price: str | None = None
    priceUsd: float | None = None
    timestamp: str
    blockHeight: str | None = None
    fuelUsd: float | None = None
    fuelUsdUpdatedAt: str | None = None
    updatedAt: str


class TradeCreatedResponse(BaseModel):
    ok: bool
    tradeId: str
    campaignId: str
    delivered: dict[str, int]


class ChartSeriesPoint(BaseModel):
    t: int
    price_scaled: str
    price: float
    price_usd: float | None = None


class CandlePoint(BaseModel):
    t: int
    o: str
    h: str
    l: str
    c: str
    v_base: str
    v_token: str
    n: int


class ChartSummary(BaseModel):
    firstPriceScaled: str | None = None
    lastPriceScaled: str | None = None
    firstPrice: float | None = None
    firstPriceUsd: float | None = None
    lastPrice: float | None = None
    lastPriceUsd: float | None = None
    priceChangePct: float = 0.0
    highPriceScaled: str | None = None
    lowPriceScaled: str | None = None
    highPrice: float | None = None
    highPriceUsd: float | None = None
    lowPrice: float | None = None
    lowPriceUsd: float | None = None
    volumeBase: str = "0"
    volumeUsd: float | None = None
    volumeToken: str = "0"
    tradeCount: int = 0


class ChartHistoryResponse(BaseModel):
    ok: bool
    campaignId: str
    fromTs: int
    toTs: int
    intervalSec: int
    series: list[ChartSeriesPoint]
    candles: list[CandlePoint]
    summary: ChartSummary
    fuelUsd: float | None = None
    fuelUsdUpdatedAt: str | None = None
