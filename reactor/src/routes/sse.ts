/**
 * SSE routes for event streaming.
 */

import type { Request, Response } from "express";
import type { SSEBroker } from "../services/sseBroker.js";
import { SubscriberQueue } from "../services/sseBroker.js";
import { logger } from "../logger.js";
import { nowIso } from "../utils/time.js";

/**
 * Setup SSE routes.
 */
export function setupSseRoutes(
  app: any,
  broker: SSEBroker,
  heartbeatSeconds: number = 15
): void {
  app.get("/sse", async (req: Request, res: Response) => {
    const campaignId = req.query.campaignId as string | undefined;
    const channel = campaignId || "*";

    const queue = new SubscriberQueue(200);
    await broker.subscribe(channel, queue);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const sendEvent = (eventName: string, data: any, eventId?: string) => {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      let message = "";
      if (eventId) {
        message += `id: ${eventId}\n`;
      }
      message += `event: ${eventName}\n`;
      message += `data: ${payload}\n\n`;
      res.write(message);
    };

    // Send ready event
    sendEvent("ready", { channel, connectedAt: nowIso() });

    const heartbeatInterval = setInterval(() => {
      sendEvent("heartbeat", { channel, ts: nowIso() });
    }, heartbeatSeconds * 1000);

    const cleanup = async () => {
      clearInterval(heartbeatInterval);
      await broker.unsubscribe(channel, queue);
      res.end();
    };

    req.on("close", cleanup);
    req.on("disconnected", cleanup);

    // Consume messages from queue
    (async () => {
      try {
        while (true) {
          const msg = await queue.get();
          if (res.writableEnded) break;
          res.write(msg);
        }
      } catch (error) {
        logger.error("SSE stream error", { error });
      } finally {
        await cleanup();
      }
    })();
  });

  // Broker stats endpoint
  app.get("/broker_stats", async (req: Request, res: Response) => {
    try {
      const stats = await broker.stats();
      res.json({ ok: true, subscriptions: stats });
    } catch (error: any) {
      logger.error("Failed to get broker stats", { error: error.message });
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}
