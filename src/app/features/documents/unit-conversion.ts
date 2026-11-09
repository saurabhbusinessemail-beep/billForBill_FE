const SCALE = 100000000n;
function decimal(value: string, zero = false): bigint {
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(value)) throw new Error('INVALID_CONVERSION');
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, '0'));
  if (!zero && result <= 0n) throw new Error('INVALID_CONVERSION');
  return result;
}
function represent(numerator: bigint, denominator: bigint, maximum = 10000000000n): string {
  const scaled = numerator * SCALE;
  if (scaled % denominator) throw new Error('INVALID_CONVERSION');
  const result = scaled / denominator;
  if (result % 100n || result > maximum * SCALE) throw new Error('INVALID_CONVERSION');
  return `${result / SCALE}.${String(result % SCALE).padStart(8, '0')}`.replace(/\.?0+$/, '');
}
export function convertLineUnit(quantity: string, price: string, oldFactor: string, newFactor: string): { quantity: string; unitPrice: string } {
  const old = decimal(oldFactor); const next = decimal(newFactor);
  return { quantity: represent(decimal(quantity) * old, next * SCALE), unitPrice: represent(decimal(price, true) * next, old * SCALE, 999999999999n) };
}
export function scalePrice(price: string, factor: string): string { return represent(decimal(price, true) * decimal(factor), SCALE * SCALE, 999999999999n); }
