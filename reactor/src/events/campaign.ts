/**
 * Event builders for campaign-related events.
 * Ported from sse-service/app/events.py
 */

import type { CampaignRow } from "../types/enriched.js";
import type { CoinMarketCapFeed } from "../services/coinMarketCapFeed.js";
import { parseIntValue, parseFloatValue, scaledToPrice, toUsd } from "../utils/math.js";
import { nowIso } from "../utils/time.js";

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

/**
 * Build campaign updated event data from a campaign row.
 */
export async function buildCampaignUpdatedEventData(
  row: CampaignRow,
  cmcFeed: CoinMarketCapFeed,
  op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL' = 'MANUAL',
  triggerName?: string | null,
): Promise<CampaignUpdatedEventData> {
  const soldSupply = parseInt(row.curve_sold_supply);
  const maxSupply = parseInt(row.curve_max_supply);
  const tokenDecimals = row.decimals ?? 0;
  const progress = maxSupply > 0 ? round((soldSupply / maxSupply) * 100, 4) : null;

  let marketCapBase: string | null = null;
  const currentPriceScaledInt = parseInt(row.current_price_scaled);
  if (currentPriceScaledInt > 0 && maxSupply > 0) {
    let supplyHuman = maxSupply;
    if (tokenDecimals > 0) {
      supplyHuman = Math.floor(maxSupply / Math.pow(10, tokenDecimals));
    }
    marketCapBase = String(Math.floor((currentPriceScaledInt * supplyHuman) / 1_000_000_000));
  }

  const quote = await cmcFeed.getQuote();
  const currentPriceFuel = scaledToPrice(row.current_price_scaled);
    const volumeBaseFuel = parseFloatValue(row.total_volume_base);
    const marketCapBaseFuel = marketCapBase ? parseFloatValue(marketCapBase) : null;
  const virtualBaseReserve = parseInt(row.virtual_base_reserve);
  const virtualTokenReserve = parseInt(row.virtual_token_reserve);

  return {
    type: 'campaign_updated',
    op,
    triggerName,
    campaignId: row.id,
    currentPrice: row.current_price ?? null,
    currentPriceScaled: row.current_price_scaled ?? null,
    currentPriceUsd: toUsd(currentPriceFuel, quote?.price ?? null) ?? null,
    totalVolumeBase: row.total_volume_base ?? null,
    totalVolumeUsd: toUsd(volumeBaseFuel, quote?.price ?? null) ?? null,
    totalPledged: row.total_pledged ?? null,
    progress,
    curveSoldSupply: row.curve_sold_supply ?? null,
    curveMaxSupply: row.curve_max_supply ?? null,
    marketCapBase: marketCapBase,
    marketCapUsd: toUsd(marketCapBaseFuel, quote?.price ?? null) ?? null,
    fuelUsd: quote?.price ?? null,
    fuelUsdUpdatedAt: quote?.updated_at ?? null,
    status: row.status ?? null,
    virtualBaseReserve: String(virtualBaseReserve),
    virtualTokenReserve: String(virtualTokenReserve),
    updatedAt: nowIso(),
  };
}

/**
 * Build campaign migrated event data from a campaign row.
 */
export function buildCampaignMigratedEventData(
  row: CampaignRow,
  op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL' = 'MANUAL',
  triggerName?: string | null,
): CampaignMigratedEventData {
  return {
    type: 'campaign_migrated',
    op,
    triggerName,
    campaignId: row.id,
    status: row.status ?? null,
    fuelAmount: '1000000000000000',
    tokenAmount: '200000000000000000',
    updatedAt: nowIso(),
  };
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
