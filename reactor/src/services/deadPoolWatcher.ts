import type { AppConfig } from "../config.js";
import { logger } from "../logger.js";
import { IndexerGraphqlClient } from "./indexerGraphqlClient.js";
import { ReactorDexService } from "./reactorDexService.js";

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function safeBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

type PoolMetrics = {
  swapCount: number;
  uniqueTraders: number;
  totalVolume: bigint;
};

function evaluateDeadPool(metrics: PoolMetrics, config: AppConfig): boolean {
  return (
    metrics.totalVolume < config.minDeadVolume &&
    metrics.swapCount < config.minDeadSwaps &&
    metrics.uniqueTraders < config.minDeadUniqueTraders
  );
}

export class DeadPoolWatcher {
  private interval: NodeJS.Timeout | null = null;
  private running = false;
  private readonly recycledPoolIds = new Set<string>();

  constructor(
    private readonly config: AppConfig,
    private readonly indexerClient: IndexerGraphqlClient,
    private readonly reactorDex: ReactorDexService,
  ) {}

  start(): void {
    if (!this.config.watcherEnabled || this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.tick();
    }, this.config.watcherIntervalMs);

    void this.tick();
    logger.info("Dead-pool watcher started", { intervalMs: this.config.watcherIntervalMs });
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      logger.warn("Dead-pool watcher tick skipped due to ongoing execution");
      return;
    }

    this.running = true;
    try {
      const campaigns = await this.indexerClient.getMigratedCampaigns();
      if (!campaigns.length) {
        return;
      }

      const nowMs = BigInt(Date.now());
      const sinceTs = nowMs - BigInt(this.config.deadWindowMs);
      for (const campaign of campaigns) {
        const pool = await this.indexerClient.getPoolForTokenPair({
          tokenAssetId: campaign.token_asset_id,
          baseAssetId: this.config.baseAssetId,
          fee: String(this.config.feeTier),
        });
        if (!pool) {
          continue;
        }

        const swaps = await this.indexerClient.getPoolSwapsSince(pool.pool_id, sinceTs);
        const uniqueTraders = new Set(swaps.map((swap) => swap.recipient_id)).size;
        const totalVolume = swaps.reduce((acc, swap) => {
          return (
            acc +
            absBigInt(safeBigInt(swap.asset_0_in)) +
            absBigInt(safeBigInt(swap.asset_1_in)) +
            absBigInt(safeBigInt(swap.asset_0_out)) +
            absBigInt(safeBigInt(swap.asset_1_out))
          );
        }, 0n);

        const metrics: PoolMetrics = {
          swapCount: swaps.length,
          uniqueTraders,
          totalVolume,
        };

        const isDead = evaluateDeadPool(metrics, this.config);
        logger.info("Pool health evaluated", {
          campaignId: campaign.id,
          poolId: pool.pool_id,
          isDead,
          swapCount: metrics.swapCount,
          uniqueTraders: metrics.uniqueTraders,
          totalVolume: metrics.totalVolume.toString(),
        });

        if (!isDead) {
          continue;
        }
        if (this.recycledPoolIds.has(pool.pool_id)) {
          continue;
        }

        await this.reactorDex.pullLiquidityForRecycle({
          campaignId: campaign.id,
          poolId: pool.pool_id,
          dryRun: this.config.recycleDryRun,
        });
        this.recycledPoolIds.add(pool.pool_id);
      }
    } catch (error) {
      logger.error("Dead-pool watcher tick failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }
}
