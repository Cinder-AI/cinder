/**
 * Chart building utilities.
 * Ported from sse-service/app/chart.py
 */

import type { TradeRow, ChartSeriesPoint, CandlePoint, ChartSummary } from "../types/enriched.js";
import { parseIntValue, parseFloatValue, scaledToPrice, toUsd } from "../utils/math.js";

/**
 * Build chart series points and candle data from trades.
 */
export function buildChartPoints(
  trades: TradeRow[],
  intervalSec: number,
  fuelUsd: number | null = null
): { series: ChartSeriesPoint[]; candles: CandlePoint[] } {
  if (!trades || trades.length === 0) {
    return { series: [], candles: [] };
  }

  const series: ChartSeriesPoint[] = [];
  const candlesMap: Map<number, CandlePoint> = new Map();

  for (const trade of trades) {
    const ts = parseInt(trade.timestamp);
    const priceScaled = trade.price_scaled;
    if (ts <= 0 || !priceScaled) {
      continue;
    }

    const priceValue = scaledToPrice(priceScaled);
    series.push({
      t: ts,
      price_scaled: priceScaled,
      price: priceValue,
      price_usd: toUsd(priceValue, fuelUsd) ?? null,
    });

    const bucket = Math.floor(ts / intervalSec) * intervalSec;
    const amountBase = parseInt(trade.amount_base);
    const amountToken = parseInt(trade.amount_token);

    if (!candlesMap.has(bucket)) {
      candlesMap.set(bucket, {
        t: bucket,
        o: priceScaled,
        h: priceScaled,
        l: priceScaled,
        c: priceScaled,
        v_base: String(amountBase),
        v_token: String(amountToken),
        n: 1,
      });
      continue;
    }

    const candle = candlesMap.get(bucket)!;
    candle.c = priceScaled;
    const priceInt = parseInt(priceScaled);
    candle.h = String(Math.max(parseInt(candle.h), priceInt));
    candle.l = String(Math.min(parseInt(candle.l), priceInt));
    candle.v_base = String(parseInt(candle.v_base) + amountBase);
    candle.v_token = String(parseInt(candle.v_token) + amountToken);
    candle.n += 1;
  }

  const candles = Array.from(candlesMap.values()).sort((a, b) => a.t - b.t);
  return { series, candles };
}

/**
 * Fill gaps in candle data with empty candles using previous close price.
 */
export function fillCandleGaps(
  candles: CandlePoint[],
  fromTs: number,
  toTs: number,
  intervalSec: number
): CandlePoint[] {
  if (!candles || candles.length === 0) {
    return [];
  }

  const startBucket = Math.floor(fromTs / intervalSec) * intervalSec;
  const endBucket = Math.floor(toTs / intervalSec) * intervalSec;
  const byBucket = new Map<number, CandlePoint>();
  for (const candle of candles) {
    byBucket.set(candle.t, candle);
  }

  const filled: CandlePoint[] = [];
  let lastClose = candles[0].o;

  for (let bucket = startBucket; bucket <= endBucket; bucket += intervalSec) {
    const candle = byBucket.get(bucket);
    if (candle !== undefined) {
      filled.push(candle);
      lastClose = candle.c;
      continue;
    }

    filled.push({
      t: bucket,
      o: lastClose,
      h: lastClose,
      l: lastClose,
      c: lastClose,
      v_base: "0",
      v_token: "0",
      n: 0,
    });
  }

  return filled;
}

/**
 * Build summary statistics from trades.
 */
export function buildChartSummary(
  trades: TradeRow[],
  fuelUsd: number | null = null
): ChartSummary {
  if (!trades || trades.length === 0) {
    return {
      ok: true,
      priceChangePct: 0.0,
      volumeBase: "0",
      volumeToken: "0",
      tradeCount: 0,
    };
  }

  const validPrices = trades
    .map(t => t.price_scaled)
    .filter(p => p !== null && p !== undefined) as string[];

  let volumeBase = 0;
  let volumeToken = 0;
  for (const trade of trades) {
    volumeBase += parseInt(trade.amount_base);
    volumeToken += parseInt(trade.amount_token);
  }

  if (validPrices.length === 0) {
    return {
      ok: true,
      volumeBase: String(volumeBase),
      volumeUsd: toUsd(volumeBase, fuelUsd) ?? null,
      volumeToken: String(volumeToken),
      tradeCount: trades.length,
    };
  }

  const firstScaled = validPrices[0];
  const lastScaled = validPrices[validPrices.length - 1];
  const highScaled = validPrices.reduce((max, p) => parseInt(p) > parseInt(max) ? p : max);
  const lowScaled = validPrices.reduce((min, p) => parseInt(p) < parseInt(min) ? p : min);

  const firstPrice = scaledToPrice(firstScaled);
  const lastPrice = scaledToPrice(lastScaled);
  const highPrice = scaledToPrice(highScaled);
  const lowPrice = scaledToPrice(lowScaled);

  let changePct = 0.0;
  if (firstPrice > 0) {
    changePct = round(((lastPrice - firstPrice) / firstPrice) * 100, 4);
  }

  return {
    ok: true,
    firstPriceScaled: firstScaled,
    lastPriceScaled: lastScaled,
    firstPrice,
    firstPriceUsd: toUsd(firstPrice, fuelUsd) ?? null,
    lastPrice,
    lastPriceUsd: toUsd(lastPrice, fuelUsd) ?? null,
    priceChangePct: changePct,
    highPriceScaled: highScaled,
    lowPriceScaled: lowScaled,
    highPrice,
    highPriceUsd: toUsd(highPrice, fuelUsd) ?? null,
    lowPrice,
    lowPriceUsd: toUsd(lowPrice, fuelUsd) ?? null,
    volumeBase: String(volumeBase),
    volumeUsd: toUsd(volumeBase, fuelUsd) ?? null,
    volumeToken: String(volumeToken),
    tradeCount: trades.length,
  };
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
