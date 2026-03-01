/**
 * Enriched event types for SSE and API.
 * Ported from sse-service/app/schemas.py
 */

// ============================================================================
// Hasura Webhook Types
// ============================================================================

export interface HasuraHeader {
  name: string;
  value: string;
}

export interface HasuraDeliveryInfo {
  current_retry: number;
  max_retries: number;
}

export interface HasuraEventData<T = any> {
  new: T | null;
  old: T | null;
}

export interface HasuraEvent<T = any> {
  data: HasuraEventData<T>;
  op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL';
  session_variables?: Record<string, string>;
  trace_context?: Record<string, any>;
}

export interface HasuraTable {
  name: string;
  schema: string;
}

export interface HasuraTrigger {
  name: string;
}

// Campaign row from indexer
export interface CampaignRow {
  id: string;
  created_at?: string | null;
  creator_id?: string | null;
  current_price?: string | null;
  current_price_scaled?: string | null;
  curve_base_price?: string | null;
  curve_k?: string | null;
  curve_k_scale?: string | null;
  curve_max_supply?: string | null;
  curve_n?: string | null;
  curve_slope?: string | null;
  curve_sold_supply?: string | null;
  image?: string | null;
  status?: string | null;
  target?: string | null;
  decimals?: number | null;
  description?: string | null;
  name?: string | null;
  ticker?: string | null;
  total_pledged?: string | null;
  total_volume_base?: string | null;
  curve_reserve?: string | null;
  virtual_base_reserve?: string | null;
  virtual_token_reserve?: string | null;
}

// Trade row from indexer
export interface TradeRow {
  id: string;
  user_id?: string | null;
  campaign_id: string;
  side?: string | null;
  amount_token?: string | null;
  amount_base?: string | null;
  price_scaled?: string | null;
  price?: string | null;
  timestamp: string;
  tx_id?: string | null;
  block_height?: string | null;
}

// Webhook payloads
export interface CampaignUpdatedPayload {
  created_at: string;
  delivery_info: HasuraDeliveryInfo;
  event: HasuraEvent<CampaignRow>;
  id: string;
  table: HasuraTable;
  trigger: HasuraTrigger;
}

export interface CampaignUpdatedWebhookEnvelope {
  headers: HasuraHeader[];
  payload: CampaignUpdatedPayload;
  version?: string | null;
}

export interface CampaignMigratedPayload {
  created_at: string;
  delivery_info: HasuraDeliveryInfo;
  event: HasuraEvent<CampaignRow>;
  id: string;
  table: HasuraTable;
  trigger: HasuraTrigger;
}

export interface CampaignMigratedWebhookEnvelope {
  headers: HasuraHeader[];
  payload: CampaignMigratedPayload;
  version?: string | null;
}

export interface TradeInsertEventData {
  new: TradeRow;
}

export interface TradeInsertEvent {
  data: TradeInsertEventData;
  op: 'INSERT';
}

export interface TradeInsertPayload {
  created_at: string;
  delivery_info: HasuraDeliveryInfo;
  event: TradeInsertEvent;
  id: string;
  table: HasuraTable;
  trigger: HasuraTrigger;
}

// ============================================================================
// SSE Event Data Types
// ============================================================================

export interface ReadyEventData {
  type: 'ready';
  channel: string;
  connectedAt: string;
}

export interface HeartbeatEventData {
  type: 'heartbeat';
  channel: string;
  ts: string;
}

export interface CampaignUpdatedEventData {
  type: 'campaign_updated';
  op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL';
  triggerName?: string | null;
  campaignId: string;
  currentPrice?: string | null;
  currentPriceScaled?: string | null;
  currentPriceUsd?: number | null;
  totalVolumeBase?: string | null;
  totalVolumeUsd?: number | null;
  totalPledged?: string | null;
  progress?: number | null;
  curveSoldSupply?: string | null;
  curveMaxSupply?: string | null;
  virtualBaseReserve?: string | null;
  virtualTokenReserve?: string | null;
  marketCapBase?: string | null;
  marketCapUsd?: number | null;
  fuelUsd?: number | null;
  fuelUsdUpdatedAt?: string | null;
  status?: string | null;
  updatedAt: string;
}

export interface CampaignMigratedEventData {
  type: 'campaign_migrated';
  op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL';
  triggerName?: string | null;
  campaignId: string;
  status?: string | null;
  fuelAmount?: string | null;
  tokenAmount?: string | null;
  updatedAt: string;
}

export interface TradeCreatedEventData {
  type: 'trade_created';
  tradeId: string;
  campaignId: string;
  side?: string | null;
  amountBase?: string | null;
  amountToken?: string | null;
  priceScaled?: string | null;
  price?: string | null;
  priceUsd?: number | null;
  timestamp: string;
  blockHeight?: string | null;
  fuelUsd?: number | null;
  fuelUsdUpdatedAt?: string | null;
  updatedAt: string;
}

// ============================================================================
// Chart Types
// ============================================================================

export interface ChartSeriesPoint {
  t: number;
  price_scaled: string;
  price: number;
  price_usd?: number | null;
}

export interface CandlePoint {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v_base: string;
  v_token: string;
  n: number;
}

export interface ChartSummary {
  firstPriceScaled?: string | null;
  lastPriceScaled?: string | null;
  firstPrice?: number | null;
  firstPriceUsd?: number | null;
  lastPrice?: number | null;
  lastPriceUsd?: number | null;
  priceChangePct: number;
  highPriceScaled?: string | null;
  lowPriceScaled?: string | null;
  highPrice?: number | null;
  highPriceUsd?: number | null;
  lowPrice?: number | null;
  lowPriceUsd?: number | null;
  volumeBase: string;
  volumeUsd?: number | null;
  volumeToken: string;
  tradeCount: number;
}

export interface ChartHistoryResponse {
  ok: boolean;
  campaignId: string;
  fromTs: number;
  toTs: number;
  intervalSec: number;
  series: ChartSeriesPoint[];
  candles: CandlePoint[];
  summary: ChartSummary;
  fuelUsd?: number | null;
  fuelUsdUpdatedAt?: string | null;
}

// ============================================================================
// Response Types
// ============================================================================

export interface HealthResponse {
  ok: boolean;
  indexer_url: string;
}

export interface BrokerStatsResponse {
  ok: boolean;
  subscriptions: Record<string, number>;
}

export interface CampaignUpdatedResponse {
  ok: boolean;
  campaignId: string;
  delivered: { global: number; campaign: number };
}

export interface CampaignMigratedResponse {
  ok: boolean;
  campaignId: string;
  delivered: { global: number; campaign: number };
}

export interface CampaignSnapshotResponse {
  ok: boolean;
  campaignId: string;
  snapshot: CampaignUpdatedEventData;
}

export interface TradeCreatedResponse {
  ok: boolean;
  tradeId: string;
  campaignId: string;
  delivered: { global: number; campaign: number };
}

// ============================================================================
// Reactor Pool Types (from existing types.ts)
// ============================================================================

export type Campaign = {
  id: string;
  status: string;
  token_asset_id: string;
  token_decimals: number;
};

export type CampaignMigratedEvent = {
  campaign_id: string;
  fuel_reserve: string;
  token_reserve: string;
  timestamp: string;
  tx_id: string;
};

export type ReactorPoolCreateEvent = {
  pool_id: string;
  token_0_asset_id: string;
  token_1_asset_id: string;
  fee: string;
  timestamp: string;
};

export type ReactorPoolSwapEvent = {
  recipient_id: string;
  asset_0_in: string;
  asset_1_in: string;
  asset_0_out: string;
  asset_1_out: string;
};

export type CampaignMigrationSignal = CampaignUpdatedEventData | CampaignMigratedEventData | {
  type?: string;
  campaignId: string;
  status: string;
};
