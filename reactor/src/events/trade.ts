/**
 * Event builders for trade-related events.
 * Ported from sse-service/app/events.py
 */

import type { TradeRow } from "../types/enriched.js";
import type { CoinMarketCapFeed } from "../services/coinMarketCapFeed.js";
import { parseFloatValue, scaledToPrice, toUsd } from "../utils/math.js";
import { nowIso } from "../utils/time.js";

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

/**
 * Build trade created event data from a trade row.
 */
export async function buildTradeCreatedEventData(
  row: TradeRow,
  cmcFeed: CoinMarketCapFeed,
): Promise<TradeCreatedEventData> {
  const priceFuel = scaledToPrice(row.price_scaled);
  const quote = await cmcFeed.getQuote();

  return {
    type: 'trade_created',
    tradeId: row.id,
    campaignId: row.campaign_id,
    side: row.side ?? null,
    amountBase: row.amount_base ?? null,
    amountToken: row.amount_token ?? null,
    priceScaled: row.price_scaled ?? null,
    price: row.price ?? null,
    priceUsd: toUsd(priceFuel, quote?.price ?? null) ?? null,
    timestamp: row.timestamp,
    blockHeight: row.block_height ?? null,
    fuelUsd: quote?.price ?? null,
    fuelUsdUpdatedAt: quote?.updated_at ?? null,
    updatedAt: nowIso(),
  };
}
