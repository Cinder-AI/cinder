/**
 * Central configuration export
 * Import from this file for all configuration needs
 * 
 * @example
 * import { APP_CONFIG, NETWORKS, CONTRACT_ADDRESSES, ENVIRONMENT } from '@/config';
 */

// Types
export type { DappEnvironment, ContractIds, NetworkConfig } from './types';

// Constants
export { APP_CONFIG, TOKEN_CONFIG, UI_CONFIG } from './constants';

// Network configuration
export { NETWORKS, ENVIRONMENT, isLocal, isTestnet, isMainnet, currentNetwork } from './networks';

// Contract addresses
export { CONTRACT_ADDRESSES, type LocalRegistry } from './contracts';
