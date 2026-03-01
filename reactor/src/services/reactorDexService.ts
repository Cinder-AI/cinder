import { Provider, Wallet, BN } from "fuels";
import { logger } from "../logger.js";
import { CreatePoolWithLiquidityLoader } from "../scripts/CreatePoolWithLiquidityLoader.js";
import { RemoveLiquidity } from "../scripts/RemoveLiquidity.js";
import { FeeAmount } from "reactor-sdk-ts";

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
  tokenAmount: string;
  quoteAmount: string;
  feeTier: FeeAmount;
  priceLower: number;
  priceUpper: number;
};

type RemoveLiquidityParams = {
  poolId: [string, string, FeeAmount];
  recipient: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0Min: string;
  amount1Min: string;
  deadline: number;
};

// Конвертация чисел в формат i64 для скриптов
const INDENT = 1n << 63n;
function toI64(n: number): { underlying: BN } {
  const underlying = n >= 0
    ? INDENT + BigInt(n)
    : INDENT - BigInt(-n);
  return { underlying: new BN(underlying.toString()) };
}

// Снап тиков к spacing
const TICK_SPACING_MAP: Record<number, number> = {
  100: 1,
  500: 10,
  1000: 10,
  3000: 60,
  3500: 60,
  10000: 200,
  10500: 200,
};

function sqrtBigInt(value: bigint): bigint {
  if (value < 0n) throw new Error("negative");
  if (value < 2n) return value;
  let x0 = value / 2n;
  let x1 = (x0 + value / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

function priceToSqrtPriceX96(amountToken1: BN, amountToken0: BN): BN {
  if (amountToken0.eq(new BN(0))) throw new Error("division by zero");
  const Q96 = new BN(2).pow(new BN(96));
  const priceX192 = amountToken1.mul(Q96).mul(Q96).div(amountToken0);
  const sqrt = sqrtBigInt(BigInt(priceX192.toString()));
  return new BN(sqrt.toString());
}

function sortAssets(a: string, b: string) {
  const aNorm = a.toLowerCase();
  const bNorm = b.toLowerCase();

  if (aNorm < bNorm) {
    return {
      token0: a,
      token1: b,
      reversed: false
    };
  }

  return {
    token0: b,
    token1: a,
    reversed: true
  };
}


export class ReactorDexService {
  private readonly provider: Provider;
  private readonly wallet: Wallet;
  private readonly config: ReactorServiceConfig;

  constructor(config: ReactorServiceConfig) {
    this.config = config;
    this.provider = new Provider(config.providerUrl);
    this.wallet = Wallet.fromPrivateKey(config.ownerPrivateKey, this.provider);
  }

  getAddress(): string {
    return this.wallet.address.toB256();
  }

  getWallet(): Wallet {
    return this.wallet;
  }

  async createPoolAndSeedLiquidity(params: CreateMigrationPoolParams): Promise<unknown> {
    logger.info("Creating reactor pool and seeding liquidity", params);

    const loader = new CreatePoolWithLiquidityLoader(this.wallet);
    loader.setConfigurableConstants({
      REACTOR_POOL_CONTRACT_ID: { bits: this.config.reactorPoolContractId },
    });

    const { token0, token1, reversed } = sortAssets(params.tokenAssetId, params.quoteAssetId);

    const tokenAmount = new BN(params.tokenAmount);
    const quoteAmount = new BN(params.quoteAmount);
    const tickSpacing = TICK_SPACING_MAP[params.feeTier];
    if (!tickSpacing) throw new Error(`Unknown feeTier: ${params.feeTier}`);

    const priceLower = Math.round(params.priceLower / tickSpacing) * tickSpacing;
    const priceUpper = Math.round(params.priceUpper / tickSpacing) * tickSpacing;

    const sqrtPriceX96 = priceToSqrtPriceX96(quoteAmount, tokenAmount);

    const recipient = { Address: { bits: this.wallet.address.toB256() } };
    const tokenAsset = { bits: params.tokenAssetId };
    const quoteAsset = { bits: params.quoteAssetId };
    const deadline = 60000000;

    const scope = loader.functions.main(
      tokenAsset,
      quoteAsset,
      params.feeTier,
      sqrtPriceX96,
      toI64(priceLower),
      toI64(priceUpper),
      tokenAmount,
      quoteAmount,
      new BN(0),
      new BN(0),
      recipient,
      deadline,
    )
      .txParams({ variableOutputs: 4 })
      .assembleTxParams({
        feePayerAccount: this.wallet,
        accountCoinQuantities: [
          {
            amount: tokenAmount,
            assetId: tokenAsset.bits,
            account: this.wallet,
            changeOutputAccount: this.wallet,
          },
          {
            amount: quoteAmount,
            assetId: quoteAsset.bits,
            account: this.wallet,
            changeOutputAccount: this.wallet,
          },
        ],
      });

    const { waitForResult } = await scope.call();
    try {
      return await waitForResult();
    } catch (e: any) {
      console.error("REVERT RECEIPTS:", JSON.stringify(e.receipts, null, 2));
      throw e;
    }
  }

  async removeLiquidity(params: RemoveLiquidityParams): Promise<unknown> {
    logger.info("Removing liquidity from reactor pool", params);

    const script = new RemoveLiquidity(this.wallet);
    script.setConfigurableConstants({
      REACTOR_POOL_CONTRACT_ID: { bits: this.config.reactorPoolContractId },
    });

    const [token0, token1, feeTier] = params.poolId;
    const poolId = [
      { bits: token0 },
      { bits: token1 },
      params.poolId[2],
    ];

    const recipient = { Address: { bits: params.recipient } };
    const scope = script.functions.main(
      poolId,
      recipient,
      toI64(params.tickLower),
      toI64(params.tickUpper),
      new BN(params.liquidity),
      new BN(params.amount0Min),
      new BN(params.amount1Min),
      new BN(params.deadline),
    )
      .txParams({ variableOutputs: 2 })
      .assembleTxParams({
        feePayerAccount: this.wallet,
      });

    const { waitForResult } = await scope.call();
    return await waitForResult();
  }
}