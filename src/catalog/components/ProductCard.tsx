import { Link } from 'react-router-dom';
import { categoryLabel } from '../model/filters';
import type { Product } from '../model/product';

/** One product of the list. The price is shown as the service formatted it: the portal never does arithmetic with money. */
export function ProductCard({ product }: { product: Product }) {
  return (
    <li className="product-card">
      {product.imageUrl && <img className="product-photo" src={product.imageUrl} alt="" loading="lazy" width={240} height={240} />}
      <span className="chip chip-category">{categoryLabel(product.category)}</span>
      <h3>
        <Link to={`products/${encodeURIComponent(product.id)}`}>{product.name}</Link>
      </h3>
      {product.description && <p>{product.description}</p>}
      <p className="product-price">{product.priceFormatted}</p>
      {product.inStock ? <p className="chip chip-stock">{`${product.stockQuantity} disponibles`}</p> : <p className="chip chip-soldout">Agotado</p>}
    </li>
  );
}
