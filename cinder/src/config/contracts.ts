import type { DappEnvironment, ContractIds } from './types';

/**
 * Contract addresses for each environment
 * 
 * For local environment, addresses are loaded dynamically from
 * /fuel-contracts.local.json (see hooks/useContracts.tsx)
 */
export const CONTRACT_ADDRESSES: Record<DappEnvironment, ContractIds> = {
  local: {
    // These are placeholders - actual addresses loaded from /fuel-contracts.local.json
    CINDER: '',
    LAUNCHPAD: '',
    FUEL: '',
  },
  testnet: {
    CINDER: '0xd3bcd74f5b94bf797430b887ac1413c4d9d71b634f2080a2f8ea6193028c9e3a',
    LAUNCHPAD: '0xf9877f27adf45934199405c7367f59bb026b0b13c2dfc0f87e6c4428a6b7f325',
    FUEL: '0x3b3e04f181faba12392a348cd8ad9363af0e5e23dc44ef66a316e90dde7a5ca5',
  },
  // TODO: Fill in mainnet addresses when deployed
  mainnet: {
    CINDER: '',
    LAUNCHPAD: '',
    FUEL: '',
  },
} as const;

/**
 * Type for local registry JSON structure
 */
export type LocalRegistry = {
  contracts: Record<string, { contract_id: string }>;
};
