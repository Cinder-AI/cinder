const TEN = 10n;

export const BASE_ASSET_DECIMALS = 9;

export const toHuman = (amount: bigint, decimals: number) => {
  if (decimals <= 0) {
    return amount;
  }
  return amount / TEN ** BigInt(decimals);
};
