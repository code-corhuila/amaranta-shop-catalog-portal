// Money and quantities are read from TEXT, with string operations: never multiplied, never a float (Annex H). `0.07 * 100`
// is 7.000000000000001, and "10.5" read by a lenient parser becomes 105 or 10. catalog-api takes whole pesos and refuses 10.5,
// so the portal refuses it first, next to the field, and says how to write it.

export type PesosError = 'EMPTY' | 'INVALID' | 'ZERO' | 'TOO_BIG';
export type PesosResult = { readonly ok: true; readonly pesos: number } | { readonly ok: false; readonly error: PesosError };

/** A whole number written plainly, or with a dot for every thousand: 189000, 189.000 and "$ 189.000" are the same. */
const PLAIN = /^[1-9]\d*$/;
const GROUPED = /^[1-9]\d{0,2}(\.\d{3})+$/;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export function parsePesos(text: string): PesosResult {
  // One leading "$" may be typed, and the spaces around it; a space INSIDE the digits is a mistake, not a separator.
  const written = text.trim().replace(/^\$\s*/, '').trim();
  if (written === '') return { ok: false, error: 'EMPTY' };
  if (/^0+$/.test(written)) return { ok: false, error: 'ZERO' };
  if (!PLAIN.test(written) && !GROUPED.test(written)) return { ok: false, error: 'INVALID' };

  const digits = written.replaceAll('.', '');
  if (BigInt(digits) > MAX_SAFE) return { ok: false, error: 'TOO_BIG' };
  return { ok: true, pesos: Number(digits) };
}

/** Whole pesos as the form shows them to be edited: dots for thousands and no symbol, so parsePesos reads it back. */
export function formatPesos(pesos: number): string {
  return String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function pesosMessage(error: PesosError): string {
  switch (error) {
    case 'EMPTY':
      return 'Escribe el precio.';
    case 'INVALID':
      return 'Escribe el precio en pesos enteros, por ejemplo 189000 o 189.000.';
    case 'ZERO':
      return 'El precio debe ser mayor que cero.';
    case 'TOO_BIG':
      return 'El precio es demasiado grande.';
  }
}

export type StockError = 'EMPTY' | 'INVALID';
export type StockResult = { readonly ok: true; readonly quantity: number } | { readonly ok: false; readonly error: StockError };

/** A quantity in stock: a whole number, zero or more. */
export function parseStock(text: string): StockResult {
  const written = text.trim();
  if (written === '') return { ok: false, error: 'EMPTY' };
  if (!/^(0|[1-9]\d*)$/.test(written) || BigInt(written) > MAX_SAFE) return { ok: false, error: 'INVALID' };
  return { ok: true, quantity: Number(written) };
}

export function stockMessage(error: StockError): string {
  return error === 'EMPTY' ? 'Escribe la cantidad en existencia.' : 'Escribe un número entero, 0 o más.';
}
