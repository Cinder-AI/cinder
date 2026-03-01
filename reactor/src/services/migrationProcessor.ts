import type { FeeAmount } from "reactor-sdk-ts";
import type { AppConfig } from "../config.js";
import { logger } from "../logger.js";
import type { CampaignMigrationSignal } from "../types.js";
import { IndexerGraphqlClient } from "./indexerGraphqlClient.js";
import { ReactorDexService } from "./reactorDexService.js";
import { BN } from "fuels";

export class MigrationProcessor {
  private readonly processedSignalIds = new Set<string>();
  private readonly processedCampaignIds = new Set<string>();

  constructor(
    private readonly config: AppConfig,
    private readonly indexerClient: IndexerGraphqlClient,
    private readonly reactorDex: ReactorDexService,
  ) {}

  async processCampaignSignal(signal: CampaignMigrationSignal, signalId?: string): Promise<void> {
    if (signal.status !== "Migrated") {
      return;
    }

    if (signalId && this.processedSignalIds.has(signalId)) {
      logger.debug("Skip duplicate migration signal by event id", { signalId });
      return;
    }

    if (this.processedCampaignIds.has(signal.campaignId)) {
      logger.debug("Skip duplicate migration signal by campaign id", { campaignId: signal.campaignId });
      return;
    }

    const campaign = await this.indexerClient.getCampaignById(signal.campaignId);
    if (!campaign) {
      logger.warn("Campaign from SSE signal not found in indexer", { campaignId: signal.campaignId });
      return;
    }

    const existingPool = await this.indexerClient.getPoolForTokenPair({
      tokenAssetId: campaign.token_asset_id,
      baseAssetId: this.config.baseAssetId,
      fee: this.config.feeTier,
    });    if (existingPool) {
      this.processedCampaignIds.add(signal.campaignId);
      if (signalId) this.processedSignalIds.add(signalId);
      logger.info("Pool already exists for migrated campaign, skipping creation", {
        campaignId: signal.campaignId,
        poolId: existingPool.pool_id,
      });
      return;
    }

    const migration = await this.indexerClient.getLatestCampaignMigrationEvent(signal.campaignId);
    if (!migration) {
      logger.warn("Migration event missing for migrated campaign", { campaignId: signal.campaignId });
      return;
    }

    // Clean and validate numeric strings before creating BN instances
    const cleanTokenReserve = String(migration.token_reserve).trim().replace(/[^0-9]/g, '');
    const cleanFuelReserve = String(migration.fuel_reserve).trim().replace(/[^0-9]/g, '');

    logger.info("Migration reserves cleaned values", {
      cleanTokenReserve,
      cleanFuelReserve,
    });

    if (!/^\d+$/.test(cleanTokenReserve) || !/^\d+$/.test(cleanFuelReserve)) {
      throw new Error(`Invalid reserve values for campaign=${signal.campaignId}: token=${cleanTokenReserve}, fuel=${cleanFuelReserve}`);
    }

    const tokenAmount = new BN(cleanTokenReserve);
    const fuelAmount = new BN(cleanFuelReserve);
    if (fuelAmount.isZero()) {
      throw new Error(`Invalid fuel reserve for campaign=${signal.campaignId}: ${migration.fuel_reserve}`);
    }

    const priceLower = -53040;
    const priceUpper = -52920;

    await this.reactorDex.createPoolAndSeedLiquidity({
      tokenAssetId: campaign.token_asset_id,
      quoteAssetId: this.config.baseAssetId,
      tokenAmount: tokenAmount.toString(),
      quoteAmount: fuelAmount.toString(),
      feeTier: this.config.feeTier as FeeAmount,
      priceLower: priceLower,
      priceUpper: priceUpper,
    });

    this.processedCampaignIds.add(signal.campaignId);
    if (signalId) this.processedSignalIds.add(signalId);
    logger.info("Migration signal processed successfully", { campaignId: signal.campaignId });
  }
}
