import { useState, type MouseEvent } from 'react';
import { MAX_QUANTITY, useCart } from 'shell/cart';
import { flyToCart } from '../animation/flyToCart';
import type { Product } from '../model/product';

/**
 * Adds one unit of a product to the cart that the shell keeps, with the name and the price the person is looking at. It stops
 * offering more when the cart already holds all there is, or the 50 the service accepts for a line: the service refuses an order
 * with more stock than there is anyway, and this spares the person finding out at the checkout.
 *
 * The confirmation is the product itself jumping into the cart: the picture flies to the cart link and the unit is added when it
 * lands, so the number in the cart changes at the moment the eyes arrive. The words "Agregado al carrito." stay only for a screen
 * reader, which cannot see the flight.
 */
export function AddToCartButton({ product }: { product: Product }) {
  const { items, add } = useCart();
  const [message, setMessage] = useState<string | null>(null);
  const [flying, setFlying] = useState(false);

  if (!product.inStock || product.stockQuantity <= 0) return null;

  const inCart = items.find((item) => item.productId === product.id)?.quantity ?? 0;
  const noMore = inCart >= product.stockQuantity || inCart >= MAX_QUANTITY;
  const reason = inCart >= product.stockQuantity ? 'Ya tienes todo lo disponible en tu carrito.' : `Ya tienes el máximo de ${MAX_QUANTITY} unidades en tu carrito.`;

  async function onAdd(event: MouseEvent<HTMLButtonElement>) {
    if (flying) return;
    // The picture of the card the button is on; the button itself when it is used somewhere else (the detail page).
    const button = event.currentTarget;
    const source = button.closest('.product-card')?.querySelector('.product-photo') ?? button;

    setFlying(true);
    setMessage(null);
    await flyToCart(source, product.imageUrl || null);
    const result = add(
      { productId: product.id, name: product.name, price: product.price, priceFormatted: product.priceFormatted, imageUrl: product.imageUrl || null },
      1,
    );
    setMessage(result.capped ? `Llegaste al máximo de ${MAX_QUANTITY} unidades de este producto.` : 'Agregado al carrito.');
    setFlying(false);
  }

  const capped = message !== null && message.startsWith('Llegaste');

  return (
    <div className="add-to-cart">
      <button type="button" className="btn-add" disabled={noMore || flying} onClick={onAdd} aria-label={`Agregar ${product.name} al carrito`}>
        Agregar
      </button>
      <div aria-live="polite">
        {noMore && <p className="cart-note">{reason}</p>}
        {message && !noMore && (
          <p role="status" className={capped ? 'cart-note' : 'sr-only'}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
