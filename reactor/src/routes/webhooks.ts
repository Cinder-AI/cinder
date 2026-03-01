/**
 * Webhook routes for Hasura events.
 */

import type { Request, Response } from "express";
import type {
  CampaignUpdatedWebhookEnvelope,
  CampaignMigratedWebhookEnvelope,
  TradeInsertPayload,
} from "../types/enriched.js";
import { buildCampaignUpdatedEventData } from "../events/campaign.js";
import { buildTradeCreatedEventData } from "../events/trade.js";
import type { SSEBroker } from "../services/sseBroker.js";
import type { CoinMarketCapFeed } from "../services/coinMarketCapFeed.js";
import { logger } from "../logger.js";

/**
 * Setup webhook routes.
 */
export function setupWebhookRoutes(
  app: any,
  broker: SSEBroker,
  cmcFeed: CoinMarketCapFeed
): void {
  // Campaign updated webhook
  app.post("/campaign_updated", async (req: Request, res: Response) => {
    try {
      let payload: CampaignUpdatedWebhookEnvelope | { payload: any };

      if (req.body.payload) {
        // Envelope format
        payload = req.body as CampaignUpdatedWebhookEnvelope;
      } else {
        // Direct payload format
        payload = { payload: req.body };
      }

      const webhookPayload = payload.payload as any;
      const row = webhookPayload.event.data.new || webhookPayload.event.data.old;

      if (!row) {
        res.status(400).json({ ok: false, error: "Invalid payload: missing event.data.new/old" });
        return;
      }

      const eventData = await buildCampaignUpdatedEventData(
        row,
        cmcFeed,
        webhookPayload.event.op,
        webhookPayload.trigger?.name || null
      );

      const msg = toSse("campaign_updated", eventData, webhookPayload.id);
      await broker.publishCampaign(row.id, msg);

      res.json({ ok: true, campaignId: row.id });
    } catch (error: any) {
      logger.error("Failed to handle campaign_updated webhook", {
        error: error.message,
        body: req.body,
      });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Campaign migrated webhook
  app.post("/campaign_migrated", async (req: Request, res: Response) => {
    try {
      let payload: CampaignMigratedWebhookEnvelope | { payload: any };

      if (req.body.payload) {
        payload = req.body as CampaignMigratedWebhookEnvelope;
      } else {
        payload = { payload: req.body };
      }

      const webhookPayload = payload.payload as any;
      const row = webhookPayload.event.data.new || webhookPayload.event.data.old;

      if (!row) {
        res.status(400).json({ ok: false, error: "Invalid payload: missing event.data.new/old" });
        return;
      }

      const eventData = buildCampaignUpdatedEventData(
        row,
        cmcFeed,
        webhookPayload.event.op,
        webhookPayload.trigger?.name || null
      );

      if (eventData.status !== "Migrated") {
        res.json({ ok: true, campaignId: row.id, skipped: true });
        return;
      }

      const msg = toSse("campaign_migrated", eventData, webhookPayload.id);
      await broker.publishCampaign(row.id, msg);

      res.json({ ok: true, campaignId: row.id });
    } catch (error: any) {
      logger.error("Failed to handle campaign_migrated webhook", {
        error: error.message,
        body: req.body,
      });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Trade webhook (both /trade and /trade_updated)
  app.post("/trade", async (req: Request, res: Response) => {
    await handleTradeWebhook(req, res, broker, cmcFeed);
  });

  app.post("/trade_updated", async (req: Request, res: Response) => {
    await handleTradeWebhook(req, res, broker, cmcFeed);
  });
}

async function handleTradeWebhook(
  req: Request,
  res: Response,
  broker: SSEBroker,
  cmcFeed: CoinMarketCapFeed
): Promise<void> {
  try {
    const payload = req.body as TradeInsertPayload;
    const row = payload.event.data.new;

    if (!row) {
      res.status(400).json({ ok: false, error: "Invalid payload: missing event.data.new" });
      return;
    }

    const eventData = await buildTradeCreatedEventData(row, cmcFeed);
    const msg = toSse("trade_created", eventData, payload.id);
    await broker.publishCampaign(row.campaign_id, msg);

    res.json({ ok: true, tradeId: row.id, campaignId: row.campaign_id });
  } catch (error: any) {
    logger.error("Failed to handle trade webhook", {
      error: error.message,
      body: req.body,
    });
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * Format data as SSE message.
 */
function toSse(eventName: string, data: any, eventId?: string): string {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  const lines: string[] = [];
  if (eventId) {
    lines.push(`id: ${eventId}`);
  }
  lines.push(`event: ${eventName}`);
  lines.push(`data: ${payload}`);
  return lines.join("\n") + "\n\n";
}
