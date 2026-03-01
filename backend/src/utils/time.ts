/**
 * Time utilities.
 * Ported from sse-service/app/utils.py
 */

/**
 * Return current UTC timestamp in ISO format.
 */
export function nowIso(): string {
  return new Date().toISOString();
}
