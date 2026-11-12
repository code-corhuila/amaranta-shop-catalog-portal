import type { Product } from './product';

/** The five categories catalog-api accepts, with the name a person reads. */
export const CATEGORIES = [
  { value: 'FOOD', label: 'Alimento' },
  { value: 'ACCESSORIES', label: 'Accesorios' },
  { value: 'HYGIENE', label: 'Higiene' },
  { value: 'MEDICATION', label: 'Medicamentos' },
  { value: 'TOYS', label: 'Juguetes' },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]['value'];

/** A category the service sends that this portal does not know is shown as it came: the product is never hidden for it. */
export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function parseCategory(raw: string | null): CategoryValue | null {
  return CATEGORIES.find((c) => c.value === raw)?.value ?? null;
}

export interface Filters {
  readonly q: string;
  readonly category: CategoryValue | null;
}

/** The combining accents that NFD splits off a letter: U+0300 to U+036F. */
const ACCENTS = /[̀-ͯ]/g;

/** Lower case and without accents, so "salmon" finds "Salmón" and "NANDU" finds "Ñandú". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(ACCENTS, '').toLowerCase().trim();
}

/** Every word typed must appear in the name, the description or the code, in any order; and the category must be the one chosen. */
export function matchesFilters(product: Product, { q, category }: Filters): boolean {
  if (category !== null && product.category !== category) return false;
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(`${product.name} ${product.description} ${product.sku}`);
  return words.every((word) => haystack.includes(word));
}
