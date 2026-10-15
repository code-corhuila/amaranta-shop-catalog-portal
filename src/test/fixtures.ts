import type { Page, Product } from '../catalog/model/product';

export function product(overrides: Partial<Product> & Pick<Product, 'id' | 'name'>): Product {
  return {
    sku: `SKU-${overrides.id}`,
    description: '',
    category: 'FOOD',
    price: 10_000,
    priceFormatted: '$ 10.000',
    stockQuantity: 5,
    inStock: true,
    imageUrl: null,
    ...overrides,
  };
}

export function pageOf(products: Product[], meta: Partial<Page<Product>['meta']> = {}): Page<Product> {
  return { data: products, meta: { page: 1, limit: 12, total: products.length, totalPages: products.length === 0 ? 0 : 1, ...meta } };
}

export const ok = <T>(data: T) => ({ status: 200, data, location: null });

/** A promise the test settles by hand, to decide which of two requests answers first. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
