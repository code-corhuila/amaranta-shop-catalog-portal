import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { deferred } from '../../test/fixtures';
import type { AdminProduct } from '../model/product';
import { ProductForm } from './ProductForm';

const original: AdminProduct = {
  id: 'p-1',
  sku: 'FOOD-001',
  name: 'Croquetas Adulto',
  description: 'Para perros adultos',
  category: 'FOOD',
  price: 189_000,
  priceFormatted: '$ 189.000',
  stockQuantity: 24,
  inStock: true,
  imageUrl: 'https://example.test/a.png',
  isActive: true,
};

async function fillNewProduct(overrides: Partial<Record<string, string>> = {}) {
  const values: Record<string, string> = { Código: 'FOOD-009', Nombre: 'Collar ajustable', Descripción: 'Talla M', Precio: '32.000', 'Existencias iniciales': '7', Imagen: '', ...overrides };
  for (const [label, value] of Object.entries(values)) {
    const field = screen.getByLabelText(new RegExp(`^${label}`));
    await userEvent.clear(field);
    if (value !== '') await userEvent.type(field, value);
  }
  await userEvent.selectOptions(screen.getByLabelText(/^Categoría/), overrides['Categoría'] ?? 'Accesorios');
}

describe('the form of a new product', () => {
  it('has a label for every field', () => {
    render(<ProductForm mode="create" onCreate={vi.fn()} />);
    for (const label of [/^Código/, /^Nombre/, /^Descripción/, /^Categoría/, /^Precio/, /^Existencias iniciales/, /^Imagen/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Crear producto' })).toBeEnabled();
  });

  it('sends what the service takes: the price as whole pesos and the stock as a number', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<ProductForm mode="create" onCreate={onCreate} />);
    await fillNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({ sku: 'FOOD-009', name: 'Collar ajustable', description: 'Talla M', category: 'ACCESSORIES', price: 32_000, stockQuantity: 7, imageUrl: '' });
  });

  it('says what is wrong beside each field, joins it to the field for a screen reader, and sends nothing', async () => {
    const onCreate = vi.fn();
    render(<ProductForm mode="create" onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    const name = screen.getByLabelText(/^Nombre/);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Escribe el nombre.');
    expect(screen.getByLabelText(/^Código/)).toHaveAccessibleDescription('Escribe el código del producto.');
    expect(screen.getByLabelText(/^Categoría/)).toHaveAccessibleDescription('Elige una categoría.');
    expect(screen.getByLabelText(/^Precio/)).toHaveAccessibleDescription('Escribe el precio.');
    expect(screen.getByLabelText(/^Descripción/)).not.toHaveAttribute('aria-invalid', 'true');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('puts the cursor in the first field that is wrong', async () => {
    render(<ProductForm mode="create" onCreate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    expect(screen.getByLabelText(/^Código/)).toHaveFocus();
  });

  it('tells how to write a price that is not whole pesos, and never sends 10.5 as 105', async () => {
    const onCreate = vi.fn();
    render(<ProductForm mode="create" onCreate={onCreate} />);
    await fillNewProduct({ Precio: '10.5' });
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    expect(screen.getByLabelText(/^Precio/)).toHaveAccessibleDescription('Escribe el precio en pesos enteros, por ejemplo 189000 o 189.000.');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('disables the button while the request is pending, so a double click cannot create two', async () => {
    const pending = deferred<void>();
    const onCreate = vi.fn().mockReturnValue(pending.promise);
    render(<ProductForm mode="create" onCreate={onCreate} />);
    await fillNewProduct();

    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    const button = screen.getByRole('button', { name: 'Guardando…' });
    expect(button).toBeDisabled();
    await userEvent.dblClick(button);
    expect(onCreate).toHaveBeenCalledTimes(1);

    pending.resolve();
    expect(await screen.findByRole('button', { name: 'Crear producto' })).toBeEnabled();
  });

  it('keeps what was typed and shows what the service refused, beside the field, with the reference', async () => {
    const onCreate = vi.fn().mockRejectedValue({
      status: 400,
      code: 'VALIDATION_ERROR',
      userMessage: 'Revisa los datos ingresados.',
      traceId: 'trace-77',
      details: [{ field: 'price', message: 'Input should be greater than or equal to 1' }],
    });
    render(<ProductForm mode="create" onCreate={onCreate} />);
    await fillNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    expect(await screen.findByLabelText(/^Precio/)).toHaveAccessibleDescription('Revisa este campo.');
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Collar ajustable');
    expect(screen.getByRole('button', { name: 'Crear producto' })).toBeEnabled();
    expect(screen.queryByText(/Input should/)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Referencia: trace-77');
  });

  it('says that the code is already taken, beside the code', async () => {
    const onCreate = vi.fn().mockRejectedValue({
      status: 422,
      code: 'BUSINESS_RULE_VIOLATION',
      userMessage: 'No se pudo completar la operación.',
      traceId: 't',
      details: [{ field: 'rule', message: 'SKU_ALREADY_EXISTS' }],
    });
    render(<ProductForm mode="create" onCreate={onCreate} />);
    await fillNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    expect(await screen.findByLabelText(/^Código/)).toHaveAccessibleDescription('Ya existe un producto con este código.');
  });

  it('shows what belongs to no field for the whole form', async () => {
    const onCreate = vi.fn().mockRejectedValue({ status: 503, code: 'SERVICE_UNAVAILABLE', userMessage: 'El servicio no está disponible. Inténtalo más tarde.', traceId: 't-5' });
    render(<ProductForm mode="create" onCreate={onCreate} />);
    await fillNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El servicio no está disponible. Inténtalo más tarde.');
    expect(alert).toHaveTextContent('Referencia: t-5');
  });

  it('clears the errors when the person corrects them and sends again', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<ProductForm mode="create" onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    expect(screen.getByLabelText(/^Nombre/)).toHaveAttribute('aria-invalid', 'true');

    await fillNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/^Nombre/)).not.toHaveAttribute('aria-invalid', 'true');
  });
});

describe('the form of an existing product', () => {
  it('shows the code as text that cannot be edited, and the other fields filled in', () => {
    render(<ProductForm mode="edit" product={original} onUpdate={vi.fn()} />);
    expect(screen.queryByLabelText(/^Código/)).not.toBeInTheDocument();
    expect(screen.getByText(/FOOD-001/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Croquetas Adulto');
    expect(screen.getByLabelText(/^Precio/)).toHaveValue('189.000');
    expect(screen.getByLabelText(/^Categoría/)).toHaveValue('FOOD');
    expect(screen.queryByLabelText(/^Existencias/)).not.toBeInTheDocument();
  });

  it('sends only what changed', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<ProductForm mode="edit" product={original} onUpdate={onUpdate} />);
    const price = screen.getByLabelText(/^Precio/);
    await userEvent.clear(price);
    await userEvent.type(price, '200.000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onUpdate).toHaveBeenCalledWith({ price: 200_000 });
  });

  it('says there is nothing to save instead of sending an empty edit', async () => {
    const onUpdate = vi.fn();
    render(<ProductForm mode="edit" product={original} onUpdate={onUpdate} />);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(within(screen.getByRole('status')).getByText('No hay cambios para guardar.')).toBeInTheDocument();
  });
});
