import { FeeAmount } from "reactor-sdk-ts";

type AppConfig = {
  port: number;
  providerUrl: string;
  indexerUrl: string;
  sseUrl: string;
  ownerPrivateKey: string;
  reactorPoolContractId: string;
  baseAssetId: string;
  feeTier: FeeAmount;
  slippageBps: number;
  deadlineBlocks: number;
  migrationPriceLower: number;
  migrationPriceUpper: number;
  watcherEnabled: boolean;
  watcherIntervalMs: number;
  deadWindowMs: number;
  minDeadVolume: bigint;
  minDeadSwaps: number;
  minDeadUniqueTraders: number;
  recycleDryRun: boolean;
};

function getRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }
  return value;
}

function getInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer env ${name}: ${raw}`);
  }
  return parsed;
}

function getBigInt(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    return BigInt(raw);
  } catch {
    throw new Error(`Invalid bigint env ${name}: ${raw}`);
  }
}

function getBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function loadConfig(): AppConfig {
  const feeTier = parseFeeAmount(process.env.REACTOR_POOL_FEE);

  return {
    port: getInt("REACTOR_PORT", 8000),
    providerUrl: process.env.FUEL_PROVIDER_URL || "http://fuel-core:4000/v1/graphql",
    indexerUrl: process.env.INDEXER_URL || "http://graphql-engine:8080/v1/graphql",
    sseUrl: process.env.SSE_URL || "http://sse-service:8000/sse",
    ownerPrivateKey: getRequired("REACTOR_OWNER_PRIVATE_KEY"),
    reactorPoolContractId: getRequired("REACTOR_POOL_CONTRACT_ID"),
    baseAssetId: getRequired("BASE_ASSET_ID"),
    feeTier,
    slippageBps: getInt("REACTOR_SLIPPAGE_BPS", 100),
    deadlineBlocks: getInt("REACTOR_DEADLINE_BLOCKS", 1000),
    migrationPriceLower: getInt("REACTOR_MIGRATION_PRICE_LOWER", 1),
    migrationPriceUpper: getInt("REACTOR_MIGRATION_PRICE_UPPER", 1000),
    watcherEnabled: getBool("REACTOR_WATCHER_ENABLED", true),
    watcherIntervalMs: getInt("REACTOR_WATCHER_INTERVAL_MS", 300000),
    deadWindowMs: getInt("REACTOR_DEAD_WINDOW_MS", 5 * 24 * 60 * 60 * 1000),
    minDeadVolume: getBigInt("REACTOR_DEAD_MIN_VOLUME", 1_000_000_000n),
    minDeadSwaps: getInt("REACTOR_DEAD_MIN_SWAPS", 3),
    minDeadUniqueTraders: getInt("REACTOR_DEAD_MIN_UNIQUE_TRADERS", 2),
    recycleDryRun: getBool("REACTOR_RECYCLE_DRY_RUN", true),
  };
}

function parseFeeAmount(raw?: string): FeeAmount {
  if (!raw || raw.trim() === "") return FeeAmount.MEDIUM;

  const value = raw.trim().toUpperCase();

  if (value === "LOW") return FeeAmount.LOW;
  if (value === "MEDIUM") return FeeAmount.MEDIUM;
  if (value === "HIGH") return FeeAmount.HIGH;

  const asInt = Number.parseInt(value, 10);
  if (!Number.isNaN(asInt)) {
    // support both enum indexes and common bps notation
    if (asInt === 500) return FeeAmount.LOW;
    if (asInt === 3000) return FeeAmount.MEDIUM;
    if (asInt === 10000) return FeeAmount.HIGH;

    if ([FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH].includes(asInt as FeeAmount)) {
      return asInt as FeeAmount;
    }
  }

  throw new Error(`Unsupported REACTOR_POOL_FEE: ${raw}`);
}

export type { AppConfig };
