import { Link, useParams } from 'react-router-dom';
import { getProduct } from '../api/catalogApi';
import { FailureNotice } from '../components/FailureNotice';
import { useRequest } from '../hooks/useRequest';
import { AddToCartButton } from '../components/AddToCartButton';
import { categoryLabel } from '../model/filters';

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
        <article className="product-detail">
          {state.data.imageUrl && <img className="product-photo" src={state.data.imageUrl} alt={state.data.name} width={320} height={320} />}
          <div>
            <span className="chip chip-category">{categoryLabel(state.data.category)}</span>
            <h2>{state.data.name}</h2>
            {state.data.description && <p>{state.data.description}</p>}
            <p className="product-price">{state.data.priceFormatted}</p>
            {state.data.inStock ? <p className="chip chip-stock">{`${state.data.stockQuantity} disponibles`}</p> : <p className="chip chip-soldout">Agotado</p>}
            <p>Código: {state.data.sku}</p>
            <AddToCartButton product={state.data} />
          </div>
        </article>
      )}
    </section>
  );
}
