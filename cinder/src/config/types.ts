/**
 * Environment types for the dApp
 */
export type DappEnvironment = 'local' | 'testnet' | 'mainnet';

/**
 * Contract IDs for all deployed contracts
 */
export type ContractIds = {
  CINDER: string;
  LAUNCHPAD: string;
  FUEL: string;
};

/**
 * Network configuration
 */
export type NetworkConfig = {
  chainId: number;
  url: string;
};
