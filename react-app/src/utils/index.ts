export function formatNumber(num: number, useSymbol: boolean = true): string {
  if (num === 0) return '0';
  
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1000000000) {
    return sign + (absNum / 1000000000).toFixed(1).replace(/\.0$/, '') + (useSymbol ? 'B' : '');
  }
  
  if (absNum >= 1000000) {
    return sign + (absNum / 1000000).toFixed(1).replace(/\.0$/, '') + (useSymbol ? 'M' : '');
  }
  
  if (absNum >= 1000) {
    return sign + (absNum / 1000).toFixed(1).replace(/\.0$/, '') + (useSymbol ? 'K' : '');
  }
  
  return sign + absNum.toString();
}

const TEN = 10n;

export const toBaseUnits = (value: number | string, decimals: number = 9) => {
  const raw = String(value).trim();
  if (!raw) return 0n;
  const [whole, fraction = ''] = raw.split('.');
  const sanitizedWhole = whole.replace(/_/g, '') || '0';
  const paddedFraction = (fraction + '0'.repeat(decimals)).slice(0, decimals);
  const base = BigInt(sanitizedWhole) * TEN ** BigInt(decimals);
  const fractional = paddedFraction ? BigInt(paddedFraction) : 0n;
  return base + fractional;
};

export const fromBaseUnits = (value: bigint | string | number, decimals: number = 9) => {
  const amount = typeof value === 'bigint' ? value : BigInt(value || 0);
  if (decimals <= 0) return Number(amount);
  const factor = TEN ** BigInt(decimals);
  const whole = amount / factor;
  const fraction = amount % factor;
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return Number(fractionStr ? `${whole.toString()}.${fractionStr}` : whole.toString());
};