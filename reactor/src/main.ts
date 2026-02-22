import "dotenv/config";
import express from "express";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { DeadPoolWatcher } from "./services/deadPoolWatcher.js";
import { IndexerGraphqlClient } from "./services/indexerGraphqlClient.js";
import { MigrationProcessor } from "./services/migrationProcessor.js";
import { ReactorDexService } from "./services/reactorDexService.js";
import { SseSubscriber } from "./services/sseSubscriber.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const indexerClient = new IndexerGraphqlClient(config.indexerUrl);
  const reactorDex = new ReactorDexService({
    providerUrl: config.providerUrl,
    ownerPrivateKey: config.ownerPrivateKey,
    reactorPoolContractId: config.reactorPoolContractId,
    slippageBps: config.slippageBps,
    deadlineBlocks: config.deadlineBlocks,
  });

  const migrationProcessor = new MigrationProcessor(config, indexerClient, reactorDex);
  const sseSubscriber = new SseSubscriber(`${config.sseUrl}?campaignId=*`, migrationProcessor);
  const deadPoolWatcher = new DeadPoolWatcher(config, indexerClient, reactorDex);

  const app = express();
  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      wallet: reactorDex.getAddress(),
      watcherEnabled: config.watcherEnabled,
    });
  });

  const server = app.listen(config.port, "0.0.0.0", () => {
    logger.info("Reactor service started", {
      port: config.port,
      indexerUrl: config.indexerUrl,
      sseUrl: config.sseUrl,
      providerUrl: config.providerUrl,
      wallet: reactorDex.getAddress(),
    });
  });

  sseSubscriber.start();
  deadPoolWatcher.start();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Shutdown signal received", { signal });
    sseSubscriber.stop();
    deadPoolWatcher.stop();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error) => {
  logger.error("Fatal startup error", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
