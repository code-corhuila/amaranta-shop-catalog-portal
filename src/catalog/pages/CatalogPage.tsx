import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSessionInfo } from 'shell/auth';
import { listAllProducts, listProducts } from '../api/catalogApi';
import { FailureNotice } from '../components/FailureNotice';
import { FilterBar } from '../components/FilterBar';
import { Pager } from '../components/Pager';
import { ProductCard } from '../components/ProductCard';
import { useRequest } from '../hooks/useRequest';
import { matchesFilters, parseCategory, type CategoryValue } from '../model/filters';
import type { Page, Product } from '../model/product';

const PAGE_SIZE = 12;

/** The page the address asks for; anything that is not a whole number from 1 up is the first page. */
function parsePage(raw: string | null): number {
  return raw !== null && /^[1-9]\d*$/.test(raw) ? Number(raw) : 1;
}

/** What the screen draws from: the page the service gave, or the whole catalog when a filter needs all of it. */
type Source = { readonly kind: 'page'; readonly page: Page<Product> } | { readonly kind: 'all'; readonly products: readonly Product[] };

/**
 * The public list of products, with the four states of Annex H: loading, error with retry, empty, and data.
 *
 * Without a filter the service pages. The service does not filter, so with one the whole catalog is loaded ONCE (it is the
 * same request whatever is typed) and filtered here, then paged here: typing a letter does not ask the service again.
 */
export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = parseCategory(params.get('category'));
  const filtering = q.trim() !== '' || category !== null;
  const page = parsePage(params.get('page'));
  const { role } = useSessionInfo();

  const { state, retry } = useRequest<Source>(
    (signal) =>
      filtering
        ? listAllProducts(signal).then((products): Source => ({ kind: 'all', products }))
        : listProducts({ page, limit: PAGE_SIZE }, signal).then((answer): Source => ({ kind: 'page', page: answer })),
    filtering ? 'all' : `list:${page}`,
  );

  const view = useMemo(() => {
    if (state.status !== 'success') return null;
    if (state.data.kind === 'page') {
      return { items: state.data.page.data, current: state.data.page.meta.page, totalPages: state.data.page.meta.totalPages };
    }
    const found = state.data.products.filter((p) => matchesFilters(p, { q, category }));
    return { items: found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), current: page, totalPages: Math.ceil(found.length / PAGE_SIZE) };
  }, [state, q, category, page]);

  function go(next: { q?: string; category?: CategoryValue | null; page?: number }) {
    const merged = new URLSearchParams(params);
    const apply = (key: string, value: string | null | undefined) => (value ? merged.set(key, value) : merged.delete(key));
    if (next.q !== undefined) apply('q', next.q);
    if (next.category !== undefined) apply('category', next.category);
    // A new filter starts again at the first page; a page change keeps the filter.
    apply('page', next.page !== undefined && next.page > 1 ? String(next.page) : null);
    // Typing must not fill the history with one entry per letter; moving between pages may.
    setParams(merged, { replace: next.page === undefined });
  }

  return (
    <section>
      <h2>Catálogo</h2>
      {role === 'ADMIN' && (
        <p>
          <Link to="admin">Administrar catálogo</Link>
        </p>
      )}
      <FilterBar
        q={q}
        category={category}
        active={filtering}
        onChange={(next) => go({ q: next.q, category: next.category })}
        onClear={() => go({ q: '', category: null })}
      />

      {state.status === 'loading' && (
        <>
          <p role="status" className="sr-only">
            Cargando productos…
          </p>
          <ul className="product-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="skeleton product-skeleton" />
            ))}
          </ul>
        </>
      )}

      {state.status === 'error' && <FailureNotice failure={state.failure} onRetry={retry} />}

      {view && view.items.length === 0 && (
        <div>
          {filtering ? (
            <p>No encontramos productos con esos filtros.</p>
          ) : (
            <>
              <p>{page > 1 ? 'No hay productos en esta página.' : 'No hay productos disponibles por ahora.'}</p>
              {page > 1 && <Link to="?page=1">Ir a la primera página</Link>}
            </>
          )}
        </div>
      )}

      {view && view.items.length > 0 && (
        <>
          <ul className="product-grid">
            {view.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ul>
          <Pager current={view.current} totalPages={view.totalPages} onPage={(next) => go({ page: next })} />
        </>
      )}
    </section>
  );
}
