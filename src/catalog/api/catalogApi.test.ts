import { apiClient } from 'shell/apiClient';
import { describe, expect, it, vi } from 'vitest';
import type { Page, Product } from '../model/product';
import { getProduct, listProducts } from './catalogApi';

const dogFood: Product = {
  id: '3f0b6c7e-0000-4000-8000-000000000001',
  sku: 'SKU-399d',
  name: 'Dog food 3 kg',
  description: '',
  category: 'FOOD',
  price: 189_000,
  priceFormatted: '$ 189.000',
  stockQuantity: 24,
  inStock: true,
  imageUrl: 'https://example.test/a.png',
};

describe('listProducts', () => {
  it('asks the shell for the page, with a relative path: only the shell knows where the gateway is', async () => {
    const page: Page<Product> = { data: [dogFood], meta: { page: 2, limit: 12, total: 13, totalPages: 2 } };
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: page, location: null });

    const result = await listProducts({ page: 2, limit: 12 });

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/products?page=2&limit=12', {});
    expect(result).toEqual(page);
  });

  it('passes the signal on, so a newer request can cancel this one', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } }, location: null });
    const controller = new AbortController();

    await listProducts({ page: 1, limit: 12 }, controller.signal);

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/products?page=1&limit=12', { signal: controller.signal });
  });

  it('lets a failure of the shell reach the screen as it is', async () => {
    const failure = { status: 503, userMessage: 'El servicio no está disponible. Inténtalo más tarde.', traceId: 't-1' };
    vi.mocked(apiClient.get).mockRejectedValue(failure);
    await expect(listProducts({ page: 1, limit: 12 })).rejects.toBe(failure);
  });
});

describe('getProduct', () => {
  it('asks for one product by its id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: dogFood, location: null });
    const result = await getProduct(dogFood.id);
    expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/products/${dogFood.id}`, {});
    expect(result).toEqual(dogFood);
  });

  it('encodes the id, so nothing typed in the address can change the path that is asked', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: dogFood, location: null });
    await getProduct('../../internal/products/reserve-stock');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/products/..%2F..%2Finternal%2Fproducts%2Freserve-stock', {});
  });
});
