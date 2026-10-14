import { apiClient, type ShellRequestOptions } from 'shell/apiClient';
import type { AdminProduct, Page } from '../model/product';
import type { PageRequest } from './catalogApi';
import { collectAll } from './pages';

const BASE = '/api/v1/admin/products';

function options(signal: AbortSignal | undefined): ShellRequestOptions {
  return signal ? { signal } : {};
}

/** What the service takes to create a product. `price` is whole pesos and `stockQuantity` a whole number. */
export interface NewProduct {
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly price: number;
  readonly stockQuantity: number;
  readonly imageUrl: string;
}

/** What may change in a product: only the fields given. The code and the stock have their own way. */
export type ProductChanges = Partial<Pick<NewProduct, 'name' | 'description' | 'category' | 'price' | 'imageUrl'>>;

/**
 * The administration of the catalog. Every route needs a signed-in ADMIN: the gateway refuses a request with no credential,
 * and the service refuses another role. The ids come from the address bar, so they are encoded in every path.
 */
export async function listAdminProducts({ page, limit }: PageRequest, signal?: AbortSignal): Promise<Page<AdminProduct>> {
  const response = await apiClient.get<Page<AdminProduct>>(`${BASE}?page=${page}&limit=${limit}`, options(signal));
  return response.data;
}

export function listAllAdminProducts(signal?: AbortSignal): Promise<readonly AdminProduct[]> {
  return collectAll((page, limit) => listAdminProducts({ page, limit }, signal));
}

export async function createProduct(product: NewProduct, signal?: AbortSignal): Promise<AdminProduct> {
  return (await apiClient.post<AdminProduct>(BASE, product, options(signal))).data;
}

export async function updateProduct(id: string, changes: ProductChanges, signal?: AbortSignal): Promise<AdminProduct> {
  return (await apiClient.patch<AdminProduct>(`${BASE}/${encodeURIComponent(id)}`, changes, options(signal))).data;
}

export async function setStock(id: string, stockQuantity: number, signal?: AbortSignal): Promise<AdminProduct> {
  return (await apiClient.patch<AdminProduct>(`${BASE}/${encodeURIComponent(id)}/stock`, { stockQuantity }, options(signal))).data;
}

export async function setActive(id: string, active: boolean, signal?: AbortSignal): Promise<AdminProduct> {
  const action = active ? 'activate' : 'deactivate';
  return (await apiClient.post<AdminProduct>(`${BASE}/${encodeURIComponent(id)}/${action}`, undefined, options(signal))).data;
}

export async function deleteProduct(id: string, signal?: AbortSignal): Promise<void> {
  await apiClient.delete(`${BASE}/${encodeURIComponent(id)}`, options(signal));
}
