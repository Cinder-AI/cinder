/**
 * Application-wide static constants
 * Add your static configuration values here
 */

const nodeEnv = typeof process !== 'undefined' ? process.env : {};
const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
const ENV = { ...nodeEnv, ...metaEnv };

export const APP_CONFIG = {
  OWNER_WALLET: ENV.VITE_OWNER_WALLET || ENV.OWNER_WALLET || '',
  API_BASE_URL: ENV.API_BASE_URL || '',
  STORAGE_URL: ENV.VITE_STORAGE_URL || ENV.STORAGE_URL || '',
  SSE_URL: ENV.VITE_SSE_URL || ENV.SSE_URL || '',
  INDEXER_URL: ENV.VITE_INDEXER_URL || ENV.INDEXER_URL || '',
  DEFAULT_SUB_ID:
    '0x0000000000000000000000000000000000000000000000000000000000000000',
} as const;

export const TOKEN_CONFIG = {
  MAX_SUPPLY: 1_000_000,
  DECIMALS: 9,
} as const;

export const UI_CONFIG = {
  ITEMS_PER_PAGE: 10,
  TOAST_DURATION: 5000,
} as const;