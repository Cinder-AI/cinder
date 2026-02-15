import {
  FeeAmount,
  createPoolWithLiquidityDecimalized,
  getPoolState,
  quoteExactIn,
  swapExactIn,
} from 'reactor-sdk-ts';

type PoolId = [string, string, FeeAmount];

const applySlippage = (quotedOut: bigint, slippageBps: number): bigint => {
  const bps = BigInt(Math.max(0, Math.min(10_000, slippageBps)));
  return (quotedOut * (10_000n - bps)) / 10_000n;
};

export type ReactorSwapParams = {
  wallet: any;
  reactorPoolContractId: string;
  poolId: PoolId;
  tokenInId: string;
  tokenOutId: string;
  amountIn: bigint;
  slippageBps?: number;
  deadlineBlocks?: number;
};

export async function swapExactInWithQuote(params: ReactorSwapParams) {
  const {
    wallet,
    reactorPoolContractId,
    poolId,
    tokenInId,
    tokenOutId,
    amountIn,
    slippageBps = 100,
    deadlineBlocks = 1000,
  } = params;

  const quotedOutRaw = await quoteExactIn(
    reactorPoolContractId,
    wallet,
    poolId,
    tokenInId,
    tokenOutId,
    amountIn.toString(),
    '0',
    '0',
    deadlineBlocks,
  );

  const quotedOut = BigInt(String(quotedOutRaw));
  if (quotedOut <= 0n) {
    throw new Error('Reactor quote returned zero output');
  }

  const minOut = applySlippage(quotedOut, slippageBps);

  return swapExactIn(
    reactorPoolContractId,
    wallet,
    poolId,
    tokenInId,
    tokenOutId,
    amountIn.toString(),
    minOut.toString(),
    '0',
    deadlineBlocks,
  );
}

export type CreateMigrationPoolParams = {
  wallet: any;
  reactorPoolContractId: string;
  tokenAssetId: string;
  quoteAssetId: string;
  tokenDecimals: number;
  quoteDecimals: number;
  tokenAmount: number;
  quoteAmount: number;
  feeTier: FeeAmount;
  priceLower: number;
  priceUpper: number;
  deadlineBlocks?: number;
};

export async function createPoolAndSeedLiquidity(params: CreateMigrationPoolParams) {
  const {
    wallet,
    reactorPoolContractId,
    tokenAssetId,
    quoteAssetId,
    tokenDecimals,
    quoteDecimals,
    tokenAmount,
    quoteAmount,
    feeTier,
    priceLower,
    priceUpper,
    deadlineBlocks = 1000,
  } = params;

  return createPoolWithLiquidityDecimalized(
    reactorPoolContractId,
    wallet,
    tokenAssetId,
    quoteAssetId,
    tokenDecimals,
    quoteDecimals,
    tokenAmount,
    quoteAmount,
    feeTier,
    priceLower,
    priceUpper,
    deadlineBlocks,
  );
}

export async function readPoolState(params: {
  wallet: any;
  reactorPoolContractId: string;
  token0: string;
  token1: string;
  feeTier: FeeAmount;
}) {
  const { wallet, reactorPoolContractId, token0, token1, feeTier } = params;
  return getPoolState(reactorPoolContractId, wallet, [token0, token1, feeTier]);
}
