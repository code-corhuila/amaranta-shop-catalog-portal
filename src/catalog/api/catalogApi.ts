import { apiClient, type ShellRequestOptions } from 'shell/apiClient';
import type { Page, Product } from '../model/product';
import { collectAll } from './pages';

export interface PageRequest {
  readonly page: number;
  readonly limit: number;
}

function options(signal: AbortSignal | undefined): ShellRequestOptions {
  return signal ? { signal } : {};
}

/**
 * The calls of this domain. They go through the shell's client and name only relative paths: the gateway, the token, the
 * correlation id, the time limit and the shape of every failure are the shell's (Annex H).
 */
export async function listProducts({ page, limit }: PageRequest, signal?: AbortSignal): Promise<Page<Product>> {
  const response = await apiClient.get<Page<Product>>(`/api/v1/products?page=${page}&limit=${limit}`, options(signal));
  return response.data;
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  // The id comes from the address bar: encoded, it can only ever name one product, never another path.
  const response = await apiClient.get<Product>(`/api/v1/products/${encodeURIComponent(id)}`, options(signal));
  return response.data;
}

/**
 * The whole catalog, page by page. The service pages and does not filter, so a screen that filters needs all of it. Every
 * request carries the same signal: cancelling it cancels the one in flight and stops the loop.
 */
export function listAllProducts(signal?: AbortSignal): Promise<readonly Product[]> {
  return collectAll((page, limit) => listProducts({ page, limit }, signal));
}
