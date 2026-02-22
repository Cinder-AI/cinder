import type { FeeAmount } from "reactor-sdk-ts";
import type { AppConfig } from "../config.js";
import { logger } from "../logger.js";
import type { CampaignUpdatedSseData } from "../types.js";
import { IndexerGraphqlClient } from "./indexerGraphqlClient.js";
import { ReactorDexService } from "./reactorDexService.js";

function toDecimalAmount(raw: string, decimals: number): number {
  const value = BigInt(raw);
  if (value < 0n) {
    throw new Error(`Negative amount is not allowed: ${raw}`);
  }

  if (decimals < 0) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }

  const base = 10n ** BigInt(decimals);
  const integer = value / base;
  const fractional = value % base;
  const composed = Number(integer) + Number(fractional) / Number(base);

  if (!Number.isFinite(composed) || composed <= 0) {
    throw new Error(`Amount conversion failed for value=${raw}, decimals=${decimals}`);
  }

  return composed;
}

export class MigrationProcessor {
  private readonly processedSignalIds = new Set<string>();
  private readonly processedCampaignIds = new Set<string>();

  constructor(
    private readonly config: AppConfig,
    private readonly indexerClient: IndexerGraphqlClient,
    private readonly reactorDex: ReactorDexService,
  ) {}

  async processCampaignSignal(signal: CampaignUpdatedSseData, signalId?: string): Promise<void> {
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
      fee: String(this.config.feeTier),
    });

    if (existingPool) {
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

    const tokenAmount = toDecimalAmount(migration.token_reserve, campaign.token_decimals ?? 0);
    const baseAmount = Number(migration.base_reserve);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      throw new Error(`Invalid base reserve for campaign=${signal.campaignId}: ${migration.base_reserve}`);
    }

    await this.reactorDex.createPoolAndSeedLiquidity({
      tokenAssetId: campaign.token_asset_id,
      quoteAssetId: this.config.baseAssetId,
      tokenDecimals: campaign.token_decimals ?? 0,
      quoteDecimals: 9,
      tokenAmount,
      quoteAmount: baseAmount,
      feeTier: this.config.feeTier as FeeAmount,
      priceLower: this.config.migrationPriceLower,
      priceUpper: this.config.migrationPriceUpper,
    });

    this.processedCampaignIds.add(signal.campaignId);
    if (signalId) this.processedSignalIds.add(signalId);
    logger.info("Migration signal processed successfully", { campaignId: signal.campaignId });
  }
}
