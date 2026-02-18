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
    CINDER: '0xdabf826821330da6d59b8941a1596969dfb5a677b5d2f451b5edb896406a7d0b',
    LAUNCHPAD: '0x4b1c92d54ceee13893586790c6231b7e27065d66b0bcea2a4fdfa3b46485c00d',
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
