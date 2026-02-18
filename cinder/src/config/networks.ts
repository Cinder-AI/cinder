import type { DappEnvironment, NetworkConfig } from './types';

/**
 * Network configuration for each environment
 */
export const NETWORKS: Record<DappEnvironment, NetworkConfig> = {
  local: {
    chainId: 0,
    url: 'http://127.0.0.1:4000/v1/graphql',
  },
  testnet: {
    chainId: 0,
    url: 'https://testnet.fuel.network/v1/graphql',
  },
  mainnet: {
    chainId: 0,
    url: 'https://mainnet.fuel.network/v1/graphql',
  },
} as const;

/**
 * Environment configuration
 * Change this to switch between environments
 * Using type assertion to allow TypeScript to understand this can be any DappEnvironment
 */
export const ENVIRONMENT: DappEnvironment = 'testnet' as DappEnvironment;

/**
 * Helper booleans for environment checks
 */
export const isLocal = ENVIRONMENT === 'local';
export const isTestnet = ENVIRONMENT === 'testnet';
export const isMainnet = ENVIRONMENT === 'mainnet';

/**
 * Current network configuration based on environment
 */
export const currentNetwork = NETWORKS[ENVIRONMENT];