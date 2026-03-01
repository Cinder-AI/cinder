import "dotenv/config";
import { FeeAmount } from "reactor-sdk-ts";
import { Provider, Wallet, BN } from "fuels";
import { CreatePoolWithLiquidityLoader } from "./scripts/CreatePoolWithLiquidityLoader.js";
import { ReactorDexService } from "./services/reactorDexService.js";

const reactorDexService = new ReactorDexService({
  providerUrl: process.env.FUEL_PROVIDER_URL!,
  ownerPrivateKey: process.env.REACTOR_OWNER_PRIVATE_KEY!,
  reactorPoolContractId: process.env.REACTOR_POOL_CONTRACT_ID!,
  slippageBps: 100,
  deadlineBlocks: 1000000,
});


// Babylonian sqrt для bigint
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

const INDENT = 1n << 63n; // 0x8000000000000000

function toI64(n: number): { underlying: BN } {
  const underlying = n >= 0
    ? INDENT + BigInt(n)
    : INDENT - BigInt(-n);
  return { underlying: new BN(underlying.toString()) };
}

// Округление тика до ближайшего кратного spacing
function snapToSpacing(tick: number, spacing: number): number {
  return Math.round(tick / spacing) * spacing;
}

const provider = new Provider(process.env.FUEL_PROVIDER_URL!);
const wallet = Wallet.fromPrivateKey(process.env.REACTOR_OWNER_PRIVATE_KEY!, provider);
const loader = new CreatePoolWithLiquidityLoader(wallet);

loader.setConfigurableConstants({
  REACTOR_POOL_CONTRACT_ID: { bits: process.env.REACTOR_POOL_CONTRACT_ID! },
});

const tokenAmount = new BN("200000000000000000");
const quoteAmount = new BN("1000000000000000");

const feeTier = FeeAmount.MEDIUM;
console.log("feeTier value:", feeTier);

// tick_spacing зависит от fee:
// 500   -> 10
// 3000  -> 60
// 3500  -> 60
// 10000 -> 200
const TICK_SPACING_MAP: Record<number, number> = {
  100: 1,
  500: 10,
  1000: 10,
  3000: 60,
  3500: 60,
  10000: 200,
  10500: 200,
};

const tickSpacing = TICK_SPACING_MAP[feeTier];
if (!tickSpacing) throw new Error(`Unknown feeTier: ${feeTier}`);
console.log("tickSpacing:", tickSpacing);

// Снапаем тики к spacing и логируем
const priceLower = snapToSpacing(-53040, tickSpacing);
const priceUpper = snapToSpacing(-52920, tickSpacing);

console.log("priceLower:", priceLower, "% tickSpacing =", priceLower % tickSpacing);
console.log("priceUpper:", priceUpper, "% tickSpacing =", priceUpper % tickSpacing);
console.log("toI64(priceLower):", toI64(priceLower));
console.log("toI64(priceUpper):", toI64(priceUpper));

const sqrtPriceX96 = priceToSqrtPriceX96(quoteAmount, tokenAmount);
const recipient = { Address: { bits: wallet.address.toB256() } };
const quoteAsset = { bits: "0x60cf8cfde5ea5885829caafdcc3583114c90f74816254c75af8cedca050b0d0d" };
const tokenAsset  = { bits: "0xf254815c599f8cb60691c05ae1c9d746fa80146b434a40b1e856fdb2e492c801" };
const deadline = 600000000;

console.log("tokenAsset", tokenAsset);
console.log("quoteAsset", quoteAsset);
console.log("feeTier", feeTier);
console.log("sqrtPriceX96", sqrtPriceX96);
console.log("priceLower", priceLower);
console.log("priceUpper", priceUpper);
console.log("tokenAmount", tokenAmount);
console.log("quoteAmount", quoteAmount);
console.log("recipient", recipient);
console.log("deadline", deadline);
const scope = loader.functions.main(
  quoteAsset,
  tokenAsset,
  feeTier,
  sqrtPriceX96,
  toI64(priceLower),
  toI64(priceUpper),
  quoteAmount,
  tokenAmount,
  new BN(0),
  new BN(0),
  recipient,
  deadline,
)
.txParams({ variableOutputs: 4 })
.assembleTxParams({
  feePayerAccount: wallet,
  accountCoinQuantities: [
    {
      amount: tokenAmount,
      assetId: tokenAsset.bits,
      account: wallet,
      changeOutputAccount: wallet,
    },
    {
      amount: quoteAmount,
      assetId: quoteAsset.bits,
      account: wallet,
      changeOutputAccount: wallet,
    },
  ],
});

const { waitForResult } = await scope.call();
const result = await waitForResult();
console.log("result", result);