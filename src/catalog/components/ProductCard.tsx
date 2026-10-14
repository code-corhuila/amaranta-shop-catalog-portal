import { Link } from 'react-router-dom';
import type { Product } from '../model/product';

/** One product of the list. The price is shown as the service formatted it: the portal never does arithmetic with money. */
export function ProductCard({ product }: { product: Product }) {
  return (
    <li>
      {product.imageUrl && <img src={product.imageUrl} alt="" loading="lazy" width={96} height={96} />}
      <h3>
        <Link to={`products/${encodeURIComponent(product.id)}`}>{product.name}</Link>
      </h3>
      {product.description && <p>{product.description}</p>}
      <p>{product.priceFormatted}</p>
      <p>{product.inStock ? `${product.stockQuantity} disponibles` : 'Agotado'}</p>
    </li>
  );
}
