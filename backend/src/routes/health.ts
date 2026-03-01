/**
 * Health check routes.
 */

import type { Request, Response } from "express";
import type { ReactorDexService } from "../services/reactorDexService.js";
import type { AppConfig } from "../config.js";

/**
 * Setup health routes.
 */
export function setupHealthRoutes(
  app: any,
  reactorDex: ReactorDexService,
  config: AppConfig
): void {
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      indexer_url: config.indexerUrl,
      wallet: reactorDex.getAddress(),
      watcherEnabled: config.watcherEnabled,
    });
  });
}
