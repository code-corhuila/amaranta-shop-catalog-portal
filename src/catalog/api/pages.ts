import type { Page } from '../model/product';

/** The service allows at most this many in one answer. */
export const MAX_LIMIT = 100;
/** A guard: a catalog of 5000 products is not loaded into a browser, whatever the service says. */
const MAX_PAGES = 50;

/** Every page of a listing, page by page, until the last one the service names. */
export async function collectAll<T>(fetchPage: (page: number, limit: number) => Promise<Page<T>>): Promise<readonly T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const answer = await fetchPage(page, MAX_LIMIT);
    items.push(...answer.data);
    if (page >= answer.meta.totalPages) break;
  }
  return items;
}
