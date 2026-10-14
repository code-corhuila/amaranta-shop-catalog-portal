import { Link, useSearchParams } from 'react-router-dom';
import { listProducts } from '../api/catalogApi';
import { FailureNotice } from '../components/FailureNotice';
import { ProductCard } from '../components/ProductCard';
import { useRequest } from '../hooks/useRequest';

const PAGE_SIZE = 12;

/** The page the address asks for; anything that is not a whole number from 1 up is the first page. */
function parsePage(raw: string | null): number {
  return raw !== null && /^[1-9]\d*$/.test(raw) ? Number(raw) : 1;
}

/** The public list of products, with the four states of Annex H: loading, error with retry, empty, and data. */
export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get('page'));
  const { state, retry } = useRequest((signal) => listProducts({ page, limit: PAGE_SIZE }, signal), `list:${page}`);

  return (
    <section>
      <h2>Catálogo</h2>
      {state.status === 'loading' && <p role="status">Cargando productos…</p>}

      {state.status === 'error' && <FailureNotice failure={state.failure} onRetry={retry} />}

      {state.status === 'success' && state.data.data.length === 0 && (
        <div>
          <p>{page > 1 ? 'No hay productos en esta página.' : 'No hay productos disponibles por ahora.'}</p>
          {page > 1 && <Link to="?page=1">Ir a la primera página</Link>}
        </div>
      )}

      {state.status === 'success' && state.data.data.length > 0 && (
        <>
          <ul>
            {state.data.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ul>
          {state.data.meta.totalPages > 1 && (
            <nav aria-label="Paginación">
              <button type="button" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>
                Anterior
              </button>
              <p>{`Página ${state.data.meta.page} de ${state.data.meta.totalPages}`}</p>
              <button type="button" disabled={page >= state.data.meta.totalPages} onClick={() => setParams({ page: String(page + 1) })}>
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
