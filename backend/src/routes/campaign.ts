/**
 * Campaign routes.
 */

import type { Request, Response } from "express";
import type { IndexerGraphqlClient } from "../services/indexerGraphqlClient.js";
import type { FuelPriceFeed } from "../services/fuelPriceFeed.js";
import { buildCampaignUpdatedEventData } from "../events/campaign.js";
import { logger } from "../logger.js";

/**
 * Setup campaign routes.
 */
export function setupCampaignRoutes(
  app: any,
  indexerClient: IndexerGraphqlClient,
  fuelPriceFeed: FuelPriceFeed
): void {
  app.get("/campaign/snapshot", async (req: Request, res: Response) => {
    try {
      const campaignId = req.query.campaignId as string;
      if (!campaignId) {
        res.status(400).json({ ok: false, error: "campaignId is required" });
        return;
      }

      const row = await indexerClient.fetchCampaignRow(campaignId);
      if (!row) {
        res.status(404).json({ ok: false, error: `Campaign not found: ${campaignId}` });
        return;
      }

      const snapshot = await buildCampaignUpdatedEventData(row, fuelPriceFeed, "MANUAL");
      res.json({
        ok: true,
        campaignId,
        snapshot,
      });
    } catch (error: any) {
      logger.error("Failed to fetch campaign snapshot", {
        error: error.message,
        campaignId: req.query.campaignId,
      });
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}
