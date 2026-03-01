import "dotenv/config";
import express from "express";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { DeadPoolWatcher } from "./services/deadPoolWatcher.js";
import { IndexerGraphqlClient } from "./services/indexerGraphqlClient.js";
import { MigrationProcessor } from "./services/migrationProcessor.js";
import { ReactorDexService } from "./services/reactorDexService.js";
import { FuelPriceFeed } from "./services/fuelPriceFeed.js";
import { SSEBroker } from "./services/sseBroker.js";
import { setupWebhookRoutes } from "./routes/webhooks.js";
import { setupSseRoutes } from "./routes/sse.js";
import { setupChartRoutes } from "./routes/chart.js";
import { setupCampaignRoutes } from "./routes/campaign.js";
import { setupHealthRoutes } from "./routes/health.js";

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
  const deadPoolWatcher = new DeadPoolWatcher(config, indexerClient, reactorDex);

  // Initialize Fuel price feed
  const fuelPriceFeed = new FuelPriceFeed();

  // Initialize SSE broker
  const sseBroker = SSEBroker.instance();

  const app = express();
  app.use(express.json());

  // Setup routes
  setupHealthRoutes(app, reactorDex, config);
  setupWebhookRoutes(app, sseBroker, fuelPriceFeed);
  setupSseRoutes(app, sseBroker, config.sseHeartbeatSeconds);
  setupChartRoutes(app, indexerClient, fuelPriceFeed, config.chartDefaultWindowSec, config.chartDefaultIntervalSec);
  setupCampaignRoutes(app, indexerClient, fuelPriceFeed);

  const server = app.listen(config.port, "0.0.0.0", () => {
    logger.info("Reactor service started", {
      port: config.port,
      indexerUrl: config.indexerUrl,
      sseUrl: config.sseUrl,
      providerUrl: config.providerUrl,
      wallet: reactorDex.getAddress(),
    });
  });

  // Start background services
  await fuelPriceFeed.start();
  deadPoolWatcher.start();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Shutdown signal received", { signal });
    deadPoolWatcher.stop();
    await fuelPriceFeed.stop();
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
