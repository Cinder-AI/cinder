/**
 * Mathematical utilities for parsing and converting numeric values.
 * Ported from sse-service/app/utils.py
 */

/**
 * Parse value to int with default fallback.
 */
export function parseIntValue(value: string | number | null | undefined, defaultValue: number = 0): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'number') {
    return value;
  }
  try {
    return global.parseInt(value, 10);
  } catch {
    return defaultValue;
  }
}

/**
 * Parse value to float with default fallback.
 */
export function parseFloatValue(value: string | number | null | undefined, defaultValue: number = 0.0): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'number') {
    return value;
  }
  try {
    return parseFloat(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Convert scaled price (1e9) to human-readable float.
 * In the system, prices are stored as scaled integers (multiplied by 1e9).
 */
export function scaledToPrice(priceScaled: string | null | undefined): number {
  if (!priceScaled) {
    return 0.0;
  }
  try {
    // Using Decimal for precision, but we can also use simple division
    // Since we're in Node.js, we can use the global Decimal if available
    // For simplicity, we'll use Number division
    return Number(priceScaled) / 1_000_000_000;
  } catch {
    return 0.0;
  }
}

/**
 * Convert FUEL amount to USD.
 */
export function toUsd(amountInFuel: number | null | undefined, fuelUsd: number | null | undefined): number | null {
  if (amountInFuel === null || amountInFuel === undefined || fuelUsd === null || fuelUsd === undefined) {
    return null;
  }
  return roundTo(amountInFuel * fuelUsd, 12);
}

/**
 * Round a number to a specific number of decimal places.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
