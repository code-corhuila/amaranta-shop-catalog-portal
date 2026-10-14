import { apiClient } from 'shell/apiClient';
import { describe, expect, it, vi } from 'vitest';
import type { AdminProduct } from '../model/product';
import { createProduct, deleteProduct, listAllAdminProducts, listAdminProducts, setActive, setStock, updateProduct } from './adminApi';

const product: AdminProduct = {
  id: 'p-1',
  sku: 'FOOD-001',
  name: 'Croquetas',
  description: '',
  category: 'FOOD',
  price: 189_000,
  priceFormatted: '$ 189.000',
  stockQuantity: 24,
  inStock: true,
  imageUrl: '',
  isActive: true,
};

const reply = <T>(data: T, status = 200, location: string | null = null) => ({ status, data, location });

describe('the administration calls of the catalog', () => {
  it('lists the products with the inactive ones, a page at a time', async () => {
    const page = { data: [product], meta: { page: 2, limit: 20, total: 21, totalPages: 2 } };
    vi.mocked(apiClient.get).mockResolvedValue(reply(page));
    await expect(listAdminProducts({ page: 2, limit: 20 })).resolves.toEqual(page);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/products?page=2&limit=20', {});
  });

  it('lists all of them, in pages of 100, for a screen that needs to find one', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(reply({ data: [product], meta: { page: 1, limit: 100, total: 2, totalPages: 2 } }))
      .mockResolvedValueOnce(reply({ data: [{ ...product, id: 'p-2' }], meta: { page: 2, limit: 100, total: 2, totalPages: 2 } }));
    const all = await listAllAdminProducts();
    expect(all.map((p) => p.id)).toEqual(['p-1', 'p-2']);
    expect(vi.mocked(apiClient.get).mock.calls.map((c) => c[0])).toEqual(['/api/v1/admin/products?page=1&limit=100', '/api/v1/admin/products?page=2&limit=100']);
  });

  it('creates a product and gives back what the service made', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(reply(product, 201, '/api/v1/admin/products/p-1'));
    const body = { sku: 'FOOD-001', name: 'Croquetas', description: '', category: 'FOOD', price: 189_000, stockQuantity: 24, imageUrl: '' };
    await expect(createProduct(body)).resolves.toEqual(product);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/admin/products', body, {});
  });

  it('changes only the fields it is given', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(reply({ ...product, price: 50_000 }));
    await updateProduct('p-1', { price: 50_000 });
    expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/admin/products/p-1', { price: 50_000 }, {});
  });

  it('sets the stock exactly', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(reply({ ...product, stockQuantity: 0 }));
    await setStock('p-1', 0);
    expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/admin/products/p-1/stock', { stockQuantity: 0 }, {});
  });

  it('activates and deactivates', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(reply(product));
    await setActive('p-1', true);
    await setActive('p-1', false);
    expect(vi.mocked(apiClient.post).mock.calls.map((c) => c[0])).toEqual(['/api/v1/admin/products/p-1/activate', '/api/v1/admin/products/p-1/deactivate']);
  });

  it('deletes', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(reply(undefined, 204));
    await deleteProduct('p-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/admin/products/p-1', {});
  });

  it('encodes the id in every path, so nothing typed in the address can name another route', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(reply(undefined, 204));
    vi.mocked(apiClient.patch).mockResolvedValue(reply(product));
    vi.mocked(apiClient.post).mockResolvedValue(reply(product));
    await deleteProduct('../x');
    await updateProduct('../x', { name: 'n' });
    await setStock('../x', 1);
    await setActive('../x', true);
    const paths = [
      ...vi.mocked(apiClient.delete).mock.calls.map((c) => c[0]),
      ...vi.mocked(apiClient.patch).mock.calls.map((c) => c[0]),
      ...vi.mocked(apiClient.post).mock.calls.map((c) => c[0]),
    ];
    for (const path of paths) expect(path).toContain('..%2Fx');
  });

  it('passes the signal on, and lets a failure reach the screen as it is', async () => {
    const failure = { status: 403, userMessage: 'No tienes permiso para hacer esto.', traceId: 't' };
    vi.mocked(apiClient.patch).mockRejectedValue(failure);
    const controller = new AbortController();
    await expect(setStock('p-1', 3, controller.signal)).rejects.toBe(failure);
    expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/admin/products/p-1/stock', { stockQuantity: 3 }, { signal: controller.signal });
  });
});
