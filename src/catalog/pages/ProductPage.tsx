import { Link, useParams } from 'react-router-dom';
import { getProduct } from '../api/catalogApi';
import { FailureNotice } from '../components/FailureNotice';
import { useRequest } from '../hooks/useRequest';

/** A 404 (it does not exist) or a 400 (the address is not an id): asking again would get the same answer. */
const NOTHING_TO_RETRY = new Set([400, 404]);

/** One product, with the four states of Annex H (it has no "empty": a product exists or it is a 404). */
export function ProductPage() {
  const { id = '' } = useParams();
  const { state, retry } = useRequest((signal) => getProduct(id, signal), `product:${id}`);

  return (
    <section>
      <p>
        <Link to="..">Volver al catálogo</Link>
      </p>

      {state.status === 'loading' && <p role="status">Cargando producto…</p>}

      {state.status === 'error' && <FailureNotice failure={state.failure} onRetry={retry} retryable={!NOTHING_TO_RETRY.has(state.failure.status ?? -1)} />}

      {state.status === 'success' && (
        <article>
          <h2>{state.data.name}</h2>
          {state.data.imageUrl && <img src={state.data.imageUrl} alt={state.data.name} width={320} height={320} />}
          {state.data.description && <p>{state.data.description}</p>}
          <p>{state.data.priceFormatted}</p>
          <p>{state.data.inStock ? `${state.data.stockQuantity} disponibles` : 'Agotado'}</p>
          <p>
            Categoría: {state.data.category} · Código: {state.data.sku}
          </p>
        </article>
      )}
    </section>
  );
}
