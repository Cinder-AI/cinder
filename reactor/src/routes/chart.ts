/**
 * Chart routes for historical data.
 */

import type { Request, Response } from "express";
import type { IndexerGraphqlClient } from "../services/indexerGraphqlClient.js";
import type { CoinMarketCapFeed } from "../services/coinMarketCapFeed.js";
import { buildChartPoints, fillCandleGaps, buildChartSummary } from "../services/chartBuilder.js";
import { logger } from "../logger.js";

const DEFAULT_CHART_WINDOW_SEC = 86400; // 24 hours
const DEFAULT_CHART_INTERVAL_SEC = 300; // 5 minutes

/**
 * Setup chart routes.
 */
export function setupChartRoutes(
  app: any,
  indexerClient: IndexerGraphqlClient,
  cmcFeed: CoinMarketCapFeed,
  defaultWindowSec: number = 86400,
  defaultIntervalSec: number = 300
): void {
  app.get("/chart/history", async (req: Request, res: Response) => {
    try {
      const campaignId = req.query.campaignId as string;
      if (!campaignId) {
        res.status(400).json({ ok: false, error: "campaignId is required" });
        return;
      }

      const nowTs = Math.floor(Date.now() / 1000);
      const toTs = req.query.toTs ? parseInt(req.query.toTs as string, 10) : nowTs;
      const fromTs = req.query.fromTs ? parseInt(req.query.fromTs as string, 10) : toTs - defaultWindowSec;
      const intervalSec = req.query.intervalSec
        ? parseInt(req.query.intervalSec as string, 10)
        : defaultIntervalSec;

      if (fromTs >= toTs) {
        res.status(400).json({ ok: false, error: "fromTs must be less than toTs" });
        return;
      }

      if (intervalSec < 10 || intervalSec > 86400) {
        res.status(400).json({ ok: false, error: "intervalSec must be between 10 and 86400" });
        return;
      }

      const quote = await cmcFeed.getQuote();
      const fuelUsd = quote?.price ?? null;

      // Fetch trades in a thread to avoid blocking
      const trades = await indexerClient.fetchTrades(campaignId, fromTs, toTs);
      const { series, candles } = buildChartPoints(trades, intervalSec, fuelUsd);
      const summary = buildChartSummary(trades, fuelUsd);
      const filledCandles = fillCandleGaps(candles, fromTs, toTs, intervalSec);

      res.json({
        ok: true,
        campaignId,
        fromTs,
        toTs,
        intervalSec,
        series,
        candles: filledCandles,
        summary,
        fuelUsd: quote?.price ?? null,
        fuelUsdUpdatedAt: quote?.updated_at ?? null,
      });
    } catch (error: any) {
      logger.error("Failed to fetch chart history", {
        error: error.message,
        campaignId: req.query.campaignId,
      });
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}
