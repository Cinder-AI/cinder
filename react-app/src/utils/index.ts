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