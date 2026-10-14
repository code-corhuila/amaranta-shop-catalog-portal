import { useState } from 'react';
import { MAX_QUANTITY, useCart } from 'shell/cart';
import type { Product } from '../model/product';

/**
 * Adds one unit of a product to the cart that the shell keeps, with the name and the price the person is looking at. It stops
 * offering more when the cart already holds all there is, or the 50 the service accepts for a line: the service refuses an order
 * with more stock than there is anyway, and this spares the person finding out at the checkout.
 */
export function AddToCartButton({ product }: { product: Product }) {
  const { items, add } = useCart();
  const [message, setMessage] = useState<string | null>(null);

  if (!product.inStock || product.stockQuantity <= 0) return null;

  const inCart = items.find((item) => item.productId === product.id)?.quantity ?? 0;
  const noMore = inCart >= product.stockQuantity || inCart >= MAX_QUANTITY;
  const reason = inCart >= product.stockQuantity ? 'Ya tienes todo lo disponible en tu carrito.' : `Ya tienes el máximo de ${MAX_QUANTITY} unidades en tu carrito.`;

  function onAdd() {
    const result = add(
      { productId: product.id, name: product.name, price: product.price, priceFormatted: product.priceFormatted, imageUrl: product.imageUrl || null },
      1,
    );
    setMessage(result.capped ? `Llegaste al máximo de ${MAX_QUANTITY} unidades de este producto.` : 'Agregado al carrito.');
  }

  return (
    <div className="add-to-cart">
      <button type="button" className="btn-add" disabled={noMore} onClick={onAdd} aria-label={`Agregar ${product.name} al carrito`}>
        Agregar
      </button>
      <div aria-live="polite">
        {noMore && <p className="cart-note">{reason}</p>}
        {message && !noMore && <p role="status" className="cart-note">{message}</p>}
      </div>
    </div>
  );
}
