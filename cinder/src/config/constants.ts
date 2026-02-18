/**
 * Application-wide static constants
 * Add your static configuration values here
 */

export const APP_CONFIG = {
  /**
   * Owner wallet address for the dApp
   * TODO: Replace with actual owner wallet address
   */
  OWNER_WALLET: '',

  /**
   * API base URL for backend services
   * TODO: Replace with actual API URL
   */
  API_BASE_URL: '',

  /**
   * IPFS gateway URL for fetching metadata
   */
  IPFS_GATEWAY: 'https://ipfs.io/ipfs/',

  /**
   * Default sub ID for Fuel transactions
   */
  DEFAULT_SUB_ID: '0x0000000000000000000000000000000000000000000000000000000000000000',
} as const;

/**
 * Token configuration
 */
export const TOKEN_CONFIG = {
  /**
   * Maximum supply for tokens
   */
  MAX_SUPPLY: 1_000_000,

  /**
   * Default decimals for tokens
   */
  DECIMALS: 9,
} as const;

/**
 * UI configuration
 */
export const UI_CONFIG = {
  /**
   * Number of items per page
   */
  ITEMS_PER_PAGE: 10,

  /**
   * Toast notification duration in milliseconds
   */
  TOAST_DURATION: 5000,
} as const;
