import { describe, expect, it } from 'vitest';
import { product } from '../../test/fixtures';
import { CATEGORIES, categoryLabel, matchesFilters, normalize, parseCategory } from './filters';

const croquetas = product({ id: '1', name: 'Croquetas Adulto Salmón 15kg', description: 'Alimento seco para perros', category: 'FOOD', sku: 'FOOD-001' });
const juguete = product({ id: '2', name: 'Pelota Interactiva', description: 'Juego mental', category: 'TOYS', sku: 'TOY-004' });

describe('normalize', () => {
  it('ignores case and accents, so "salmon" finds "Salmón"', () => {
    expect(normalize('Salmón')).toBe('salmon');
    expect(normalize('  PELOTA  ')).toBe('pelota');
    expect(normalize('Ñandú')).toBe('nandu');
  });
});

describe('matchesFilters', () => {
  it('lets everything through when nothing is asked', () => {
    expect(matchesFilters(croquetas, { q: '', category: null })).toBe(true);
  });

  it('finds the text in the name, the description or the code, whatever the case or the accents', () => {
    expect(matchesFilters(croquetas, { q: 'SALMON', category: null })).toBe(true);
    expect(matchesFilters(croquetas, { q: 'perros', category: null })).toBe(true);
    expect(matchesFilters(croquetas, { q: 'food-001', category: null })).toBe(true);
    expect(matchesFilters(croquetas, { q: 'gato', category: null })).toBe(false);
  });

  it('needs every word, in any order', () => {
    expect(matchesFilters(croquetas, { q: 'salmon croquetas', category: null })).toBe(true);
    expect(matchesFilters(croquetas, { q: 'salmon pelota', category: null })).toBe(false);
  });

  it('filters by category, and combines it with the text', () => {
    expect(matchesFilters(juguete, { q: '', category: 'TOYS' })).toBe(true);
    expect(matchesFilters(juguete, { q: '', category: 'FOOD' })).toBe(false);
    expect(matchesFilters(juguete, { q: 'pelota', category: 'TOYS' })).toBe(true);
    expect(matchesFilters(juguete, { q: 'pelota', category: 'FOOD' })).toBe(false);
  });
});

describe('categories', () => {
  it('are the five the service accepts, with the name a person reads', () => {
    expect(CATEGORIES.map((c) => c.value)).toEqual(['FOOD', 'ACCESSORIES', 'HYGIENE', 'MEDICATION', 'TOYS']);
    expect(categoryLabel('FOOD')).toBe('Alimento');
    expect(categoryLabel('TOYS')).toBe('Juguetes');
  });

  it('shows an unknown category as it came instead of hiding the product', () => {
    expect(categoryLabel('PETS')).toBe('PETS');
  });

  it('reads a category from the address and ignores anything else', () => {
    expect(parseCategory('FOOD')).toBe('FOOD');
    expect(parseCategory('food')).toBeNull();
    expect(parseCategory('PETS')).toBeNull();
    expect(parseCategory(null)).toBeNull();
  });
});
