import { describe, expect, it } from 'vitest';
import { formatPesos, parsePesos, parseStock, pesosMessage, stockMessage } from './numbers';

describe('parsePesos: money comes from the text, never from a float', () => {
  it.each([
    ['189000', 189_000],
    ['189.000', 189_000],
    ['$ 189.000', 189_000],
    ['$ 8.500', 8_500],
    ['8.500', 8_500],
    ['1.234.567', 1_234_567],
    ['  12  ', 12],
    ['1', 1],
  ])('reads %j as %i pesos', (text, pesos) => {
    expect(parsePesos(text)).toEqual({ ok: true, pesos });
  });

  it('does not turn a decimal point into thousands: 10.5 is refused, never 105 and never 10', () => {
    expect(parsePesos('10.5')).toEqual({ ok: false, error: 'INVALID' });
    expect(parsePesos('10,5')).toEqual({ ok: false, error: 'INVALID' });
    expect(parsePesos('0.07')).toEqual({ ok: false, error: 'INVALID' });
    expect(parsePesos('1.5000')).toEqual({ ok: false, error: 'INVALID' });
    expect(parsePesos('1.000.00')).toEqual({ ok: false, error: 'INVALID' });
  });

  it.each(['abc', '12abc', '-5', '+5', '1e3', '1 000', '007', '1..000'])('refuses %j', (text) => {
    expect(parsePesos(text)).toEqual({ ok: false, error: 'INVALID' });
  });

  it('asks for the price when there is none, and for more than zero', () => {
    expect(parsePesos('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parsePesos('   ')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parsePesos('$')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parsePesos('0')).toEqual({ ok: false, error: 'ZERO' });
  });

  it('refuses a number too big to keep exact', () => {
    expect(parsePesos('9007199254740993')).toEqual({ ok: false, error: 'TOO_BIG' });
    expect(parsePesos('9.007.199.254.740.991')).toEqual({ ok: true, pesos: Number.MAX_SAFE_INTEGER });
  });
});

describe('formatPesos', () => {
  it.each([
    [5, '5'],
    [999, '999'],
    [8_500, '8.500'],
    [189_000, '189.000'],
    [1_234_567, '1.234.567'],
  ])('writes %i as %j, with dots for thousands and no symbol', (pesos, text) => {
    expect(formatPesos(pesos)).toBe(text);
  });

  it('writes what parsePesos reads back, for any amount', () => {
    for (const pesos of [1, 10, 100, 1_000, 12_345, 999_999, 1_000_000, 123_456_789]) {
      expect(parsePesos(formatPesos(pesos))).toEqual({ ok: true, pesos });
    }
  });
});

describe('pesosMessage: what the person reads beside the field', () => {
  it('says how to write the price, not just that it is wrong', () => {
    expect(pesosMessage('EMPTY')).toBe('Escribe el precio.');
    expect(pesosMessage('INVALID')).toBe('Escribe el precio en pesos enteros, por ejemplo 189000 o 189.000.');
    expect(pesosMessage('ZERO')).toBe('El precio debe ser mayor que cero.');
    expect(pesosMessage('TOO_BIG')).toBe('El precio es demasiado grande.');
  });
});

describe('parseStock: a whole number, zero or more', () => {
  it.each([
    ['0', 0],
    ['24', 24],
    [' 7 ', 7],
  ])('reads %j as %i', (text, quantity) => {
    expect(parseStock(text)).toEqual({ ok: true, quantity });
  });

  it.each(['2.5', '2,5', '-1', 'abc', '01', '1 0'])('refuses %j', (text) => {
    expect(parseStock(text)).toEqual({ ok: false, error: 'INVALID' });
  });

  it('asks for the quantity when there is none', () => {
    expect(parseStock('')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('says how to write it', () => {
    expect(stockMessage('EMPTY')).toBe('Escribe la cantidad en existencia.');
    expect(stockMessage('INVALID')).toBe('Escribe un número entero, 0 o más.');
  });
});
