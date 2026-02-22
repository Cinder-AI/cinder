import {
  createPoolWithLiquidityDecimalized,
  type FeeAmount,
  getPoolState,
  quoteExactIn,
  swapExactIn,
} from "reactor-sdk-ts";
import { Provider, Wallet } from "fuels";
import { logger } from "../logger.js";

type PoolId = [string, string, FeeAmount];

type ReactorServiceConfig = {
  providerUrl: string;
  ownerPrivateKey: string;
  reactorPoolContractId: string;
  slippageBps: number;
  deadlineBlocks: number;
};

type CreateMigrationPoolParams = {
  tokenAssetId: string;
  quoteAssetId: string;
  tokenDecimals: number;
  quoteDecimals: number;
  tokenAmount: number;
  quoteAmount: number;
  feeTier: FeeAmount;
  priceLower: number;
  priceUpper: number;
};

type SwapParams = {
  poolId: PoolId;
  tokenInId: string;
  tokenOutId: string;
  amountIn: bigint;
  slippageBps?: number;
  deadlineBlocks?: number;
};

const applySlippage = (quotedOut: bigint, slippageBps: number): bigint => {
  const bps = BigInt(Math.max(0, Math.min(10_000, slippageBps)));
  return (quotedOut * (10_000n - bps)) / 10_000n;
};

export class ReactorDexService {
  private readonly provider: Provider;
  private readonly wallet: Wallet;

  constructor(private readonly config: ReactorServiceConfig) {
    this.provider = new Provider(config.providerUrl);
    this.wallet = Wallet.fromPrivateKey(config.ownerPrivateKey, this.provider);
  }

  getAddress(): string {
    return this.wallet.address.toB256();
  }

  async readPoolState(token0: string, token1: string, feeTier: FeeAmount): Promise<unknown> {
    return getPoolState(this.config.reactorPoolContractId, this.wallet, [token0, token1, feeTier]);
  }

  async createPoolAndSeedLiquidity(params: CreateMigrationPoolParams): Promise<unknown> {
    logger.info("Creating reactor pool and seeding liquidity", {
      tokenAssetId: params.tokenAssetId,
      quoteAssetId: params.quoteAssetId,
      tokenAmount: params.tokenAmount,
      quoteAmount: params.quoteAmount,
      feeTier: params.feeTier,
    });

    return createPoolWithLiquidityDecimalized(
      this.config.reactorPoolContractId,
      this.wallet,
      params.tokenAssetId,
      params.quoteAssetId,
      params.tokenDecimals,
      params.quoteDecimals,
      params.tokenAmount,
      params.quoteAmount,
      params.feeTier,
      params.priceLower,
      params.priceUpper,
      this.config.deadlineBlocks,
    );
  }

  async swapExactInWithQuote(params: SwapParams): Promise<unknown> {
    const quotedOutRaw = await quoteExactIn(
      this.config.reactorPoolContractId,
      this.wallet,
      params.poolId,
      params.tokenInId,
      params.tokenOutId,
      params.amountIn.toString(),
      "0",
      "0",
      params.deadlineBlocks ?? this.config.deadlineBlocks,
    );

    const quotedOut = BigInt(String(quotedOutRaw));
    if (quotedOut <= 0n) {
      throw new Error("Reactor quote returned zero output");
    }

    const minOut = applySlippage(quotedOut, params.slippageBps ?? this.config.slippageBps);
    return swapExactIn(
      this.config.reactorPoolContractId,
      this.wallet,
      params.poolId,
      params.tokenInId,
      params.tokenOutId,
      params.amountIn.toString(),
      minOut.toString(),
      "0",
      params.deadlineBlocks ?? this.config.deadlineBlocks,
    );
  }

  async pullLiquidityForRecycle(input: {
    campaignId: string;
    poolId: string;
    dryRun: boolean;
  }): Promise<void> {
    if (input.dryRun) {
      logger.info("Dead-pool recycle dry-run hit", {
        campaignId: input.campaignId,
        poolId: input.poolId,
      });
      return;
    }

    throw new Error(
      "Liquidity recycle requires per-position parameters (tick range + liquidity). " +
        "Enable REACTOR_RECYCLE_DRY_RUN or implement position resolver.",
    );
  }
}
