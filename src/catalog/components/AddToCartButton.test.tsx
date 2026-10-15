import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cart } from '../../test/shellCartStub';
import { product } from '../../test/fixtures';
import { AddToCartButton } from './AddToCartButton';

const croquetas = product({ id: 'p-1', name: 'Croquetas Adulto', price: 189_000, priceFormatted: '$ 189.000', stockQuantity: 24, imageUrl: 'https://example.test/a.png' });

afterEach(() => {
  cart.items = [];
  cart.add = vi.fn(() => ({ capped: false }));
});

describe('the "Agregar" button', () => {
  it('names the product, for a screen reader that reads a list of buttons', () => {
    render(<AddToCartButton product={croquetas} />);
    expect(screen.getByRole('button', { name: 'Agregar Croquetas Adulto al carrito' })).toBeEnabled();
  });

  it('adds one unit of what the person saw: the name and the price of this moment, and says it was added', async () => {
    render(<AddToCartButton product={croquetas} />);
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }));
    expect(cart.add).toHaveBeenCalledWith({ productId: 'p-1', name: 'Croquetas Adulto', price: 189_000, priceFormatted: '$ 189.000', imageUrl: 'https://example.test/a.png' }, 1);
    expect(screen.getByRole('status')).toHaveTextContent('Agregado al carrito.');
  });

  it('sends an empty picture as none', async () => {
    render(<AddToCartButton product={{ ...croquetas, imageUrl: '' }} />);
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }));
    expect(cart.add).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: null }), 1);
  });

  it('is not offered for a product that is out of stock', () => {
    render(<AddToCartButton product={{ ...croquetas, stockQuantity: 0, inStock: false }} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('stops offering more when the cart already holds all there is, and says why', () => {
    cart.items = [{ productId: 'p-1', quantity: 24 }];
    render(<AddToCartButton product={croquetas} />);
    expect(screen.getByRole('button', { name: /agregar croquetas adulto al carrito/i })).toBeDisabled();
    expect(screen.getByText('Ya tienes todo lo disponible en tu carrito.')).toBeInTheDocument();
  });

  it('keeps offering while there is stock the cart does not hold', () => {
    cart.items = [{ productId: 'p-1', quantity: 23 }];
    render(<AddToCartButton product={croquetas} />);
    expect(screen.getByRole('button', { name: /agregar/i })).toBeEnabled();
  });

  it('counts only this product in the cart', () => {
    cart.items = [{ productId: 'other', quantity: 99 }];
    render(<AddToCartButton product={croquetas} />);
    expect(screen.getByRole('button', { name: /agregar/i })).toBeEnabled();
  });

  it('says when a line reached the limit of 50 that the service accepts', async () => {
    cart.add = vi.fn(() => ({ capped: true }));
    render(<AddToCartButton product={{ ...croquetas, stockQuantity: 200 }} />);
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Llegaste al máximo de 50 unidades de este producto.');
  });

  it('stops offering at 50 even when the stock is larger', () => {
    cart.items = [{ productId: 'p-1', quantity: 50 }];
    render(<AddToCartButton product={{ ...croquetas, stockQuantity: 200 }} />);
    expect(screen.getByRole('button', { name: /agregar/i })).toBeDisabled();
    expect(screen.getByText('Ya tienes el máximo de 50 unidades en tu carrito.')).toBeInTheDocument();
  });
});
