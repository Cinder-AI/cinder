import type { BigNumberish } from 'fuels';

/**
 * Default test constants
 */
export const TEST_CONSTANTS = {
  // Default amounts for wallet funding
  DEFAULT_FUEL_AMOUNT: 1_000_000_000_000 as BigNumberish,
  DEFAULT_CIN_AMOUNT: 1_000_000_000_000 as BigNumberish,
  DEFAULT_BASE_ASSET_AMOUNT: 1_000_000_000_000 as BigNumberish,
  
  // Campaign defaults
  MIGRATION_TARGET: 1_000_000n,
  INITIAL_SUPPLY: 1_000_000_000n,
  CURVE_SUPPLY_PERCENT: 80,
  MAX_PLEDGE: 20_000n,
  
  // Test tolerances
  TOLERANCE: 1_000n,
  
  // Default decimals
  DEFAULT_DECIMALS: 9,
};

/**
 * Default token metadata for testing
 */
export const DEFAULT_TOKEN_PARAMS = {
  name: 'Test Token',
  ticker: 'TEST',
  description: 'Test Description',
  image: 'https://test.com/image.png',
} as const;

/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
  /** Number of wallets to create */
  walletCount: number;
  /** FUEL tokens per wallet */
  fuelAmount?: BigNumberish;
  /** CIN tokens per wallet */
  cinAmount?: BigNumberish;
  /** Base asset per wallet */
  baseAssetAmount?: BigNumberish;
}

/**
 * Campaign creation parameters
 */
export interface CreateCampaignParams {
  name: string;
  ticker: string;
  description: string;
  image: string;
}

/**
 * Boost campaign parameters
 */
export interface BoostCampaignParams {
  assetId: string;
  burnAmount: BigNumberish;
}

/**
 * Default test configuration
 */
export const DEFAULT_TEST_CONFIG: TestEnvironmentConfig = {
  walletCount: 5,
  fuelAmount: TEST_CONSTANTS.DEFAULT_FUEL_AMOUNT,
  cinAmount: TEST_CONSTANTS.DEFAULT_CIN_AMOUNT,
  baseAssetAmount: TEST_CONSTANTS.DEFAULT_BASE_ASSET_AMOUNT,
};

/**
 * Generate random pledge amounts for testing
 */
export function buildRandomPledges(
  usersCount: number,
  maxPledge: number,
  targetTotal: number
): bigint[] {
  if (usersCount <= 0) throw new Error('usersCount must be > 0');
  
  const minTotal = usersCount;
  const maxTotal = usersCount * maxPledge;
  
  if (targetTotal < minTotal) throw new Error('targetTotal too small');
  if (targetTotal > maxTotal) throw new Error('targetTotal too large');
  
  const pledges: bigint[] = new Array(usersCount).fill(1n);
  let remaining = BigInt(targetTotal - usersCount);
  
  for (let i = 0; i < usersCount; i++) {
    const maxAdd = BigInt(Math.min(maxPledge - 1, Number(remaining)));
    const add = i === usersCount - 1 
      ? remaining 
      : BigInt(Math.floor(Math.random() * (Number(maxAdd) + 1)));
    pledges[i] += add;
    remaining -= add;
  }
  
  return pledges;
}

/**
 * Calculate bonding curve cost
 */
export function bondingCurveCost(
  base: bigint,
  slope: bigint,
  s: bigint,
  delta: bigint,
  scale: bigint = 1_000_000_000n
): bigint {
  const sAfter = s + delta;
  const costScaled = base * delta + (slope * (sAfter * sAfter - s * s)) / 2n;
  return costScaled / scale;
}
