import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from 'shell/apiClient';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { authState } from '../../test/shellAuthStub';
import { adminProduct, deferred, ok, pageOf } from '../../test/fixtures';
import type { AdminProduct } from '../model/product';

/** Mounted the way the shell mounts the portal: under /catalog, with the router the shell owns. */
function renderAt(url: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: url.split('?')[0] as string, search: url.includes('?') ? `?${url.split('?')[1]}` : '', state }]}>
      <Routes>
        <Route path="/catalog/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
}

const croquetas = adminProduct({ id: 'p-1', name: 'Croquetas Adulto', sku: 'FOOD-001', category: 'FOOD', priceFormatted: '$ 189.000', price: 189_000, stockQuantity: 24 });
const juguete = adminProduct({ id: 'p-2', name: 'Juguete para gato', sku: 'TOY-001', category: 'TOYS', priceFormatted: '$ 8.500', price: 8_500, stockQuantity: 0, inStock: false, isActive: false });

/** The service pages the administration list, whatever `limit` is asked. */
function serve(all: AdminProduct[]) {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    const params = new URL(path, 'http://x').searchParams;
    const page = Number(params.get('page'));
    const limit = Number(params.get('limit'));
    return ok(pageOf(all.slice((page - 1) * limit, page * limit), { page, limit, total: all.length, totalPages: Math.ceil(all.length / limit) }));
  });
}

afterEach(() => {
  authState.signedIn = true;
  authState.role = 'ADMIN';
});

describe('who may enter the administration', () => {
  it('asks a visitor to sign in, without asking the service for anything', () => {
    authState.signedIn = false;
    renderAt('/catalog/admin');
    expect(screen.getByRole('alert')).toHaveTextContent('Inicia sesión');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('tells a customer they have no permission, without asking the service for anything', () => {
    authState.role = 'CUSTOMER';
    renderAt('/catalog/admin');
    expect(screen.getByRole('alert')).toHaveTextContent('No tienes permiso');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('offers the way in from the public catalog to an admin only', async () => {
    serve([croquetas]);
    authState.role = 'CUSTOMER';
    const { unmount } = renderAt('/catalog');
    await screen.findByRole('link', { name: 'Croquetas Adulto' });
    expect(screen.queryByRole('link', { name: /administrar catálogo/i })).not.toBeInTheDocument();
    unmount();

    authState.role = 'ADMIN';
    renderAt('/catalog');
    expect(await screen.findByRole('link', { name: /administrar catálogo/i })).toHaveAttribute('href', '/catalog/admin');
  });
});

describe('the list of the administration', () => {
  it('says it is loading while it waits', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => undefined));
    renderAt('/catalog/admin');
    expect(screen.getByRole('status')).toHaveTextContent(/cargando productos/i);
  });

  it('shows every product in a table, the inactive ones too, and says it in words and not only in colour', async () => {
    serve([croquetas, juguete]);
    renderAt('/catalog/admin');
    const table = await screen.findByRole('table', { name: /productos del catálogo/i });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Nombre', 'Código', 'Categoría', 'Precio', 'Existencias', 'Estado', 'Acciones']);

    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0] as HTMLElement).getByText('Croquetas Adulto')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('Alimento')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('$ 189.000')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('24')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('Activo')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('Inactivo')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('Agotado')).toBeInTheDocument();
  });

  it('asks the service for a page of 20 of the administration route', async () => {
    serve([croquetas]);
    renderAt('/catalog/admin');
    await screen.findByRole('table');
    expect(vi.mocked(apiClient.get).mock.calls[0]?.[0]).toBe('/api/v1/admin/products?page=1&limit=20');
  });

  it('says there is nothing yet, and offers to create the first one', async () => {
    serve([]);
    renderAt('/catalog/admin');
    expect(await screen.findByText(/todavía no hay productos/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /crear el primero/i })).toHaveAttribute('href', '/catalog/admin/new');
  });

  it('says what went wrong, with the reference, and tries again when asked', async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce({ status: 403, code: 'FORBIDDEN', userMessage: 'No tienes permiso para hacer esto.', traceId: 'trace-1' })
      .mockResolvedValueOnce(ok(pageOf([croquetas])));
    renderAt('/catalog/admin');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No tienes permiso para hacer esto.');
    expect(alert).toHaveTextContent('Referencia: trace-1');
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('offers to create a product, to edit one, and to go back to the public catalog', async () => {
    serve([croquetas]);
    renderAt('/catalog/admin');
    await screen.findByRole('table');
    expect(screen.getByRole('link', { name: 'Nuevo producto' })).toHaveAttribute('href', '/catalog/admin/new');
    expect(screen.getByRole('link', { name: 'Editar Croquetas Adulto' })).toHaveAttribute('href', '/catalog/admin/p-1/edit');
    expect(screen.getByRole('link', { name: /volver al catálogo/i })).toHaveAttribute('href', '/catalog');
  });

  it('shows what the previous screen wanted to say, such as that a product was created', async () => {
    serve([croquetas]);
    renderAt('/catalog/admin', { notice: 'Producto creado.' });
    expect(await screen.findByText('Producto creado.')).toBeInTheDocument();
  });

  it('pages: 20 at a time, from the address', async () => {
    const many = Array.from({ length: 45 }, (_, i) => adminProduct({ id: `m-${i}`, name: `Producto ${String(i).padStart(2, '0')}` }));
    serve(many);
    renderAt('/catalog/admin?page=3');
    expect(await screen.findByText('Página 3 de 3')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1 + 5);
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled();
  });
});

describe('activating, deactivating and deleting', () => {
  it('deactivates a product, and the row says so', async () => {
    serve([croquetas]);
    vi.mocked(apiClient.post).mockResolvedValue(ok({ ...croquetas, isActive: false }));
    renderAt('/catalog/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar Croquetas Adulto' }));

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/admin/products/p-1/deactivate', undefined, {});
    expect(await screen.findByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activar Croquetas Adulto' })).toBeInTheDocument();
  });

  it('disables that row while the request is pending, so it is not sent twice', async () => {
    serve([croquetas]);
    const pending = deferred<ReturnType<typeof ok>>();
    vi.mocked(apiClient.post).mockReturnValue(pending.promise);
    renderAt('/catalog/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar Croquetas Adulto' }));
    expect(screen.getByRole('button', { name: 'Desactivar Croquetas Adulto' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar Croquetas Adulto' })).toBeDisabled();
    pending.resolve(ok({ ...croquetas, isActive: false }));
    expect(await screen.findByRole('button', { name: 'Activar Croquetas Adulto' })).toBeEnabled();
  });

  it('says what went wrong when the service refuses, and leaves the row as it was', async () => {
    serve([croquetas]);
    vi.mocked(apiClient.post).mockRejectedValue({ status: 404, code: 'NOT_FOUND', userMessage: 'No encontramos lo que buscas.', traceId: 'trace-2' });
    renderAt('/catalog/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar Croquetas Adulto' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No encontramos lo que buscas.');
    expect(alert).toHaveTextContent('Referencia: trace-2');
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('asks before deleting, and does nothing if the person changes their mind', async () => {
    serve([croquetas]);
    renderAt('/catalog/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Croquetas Adulto' }));
    expect(screen.getByText(/¿Eliminar «Croquetas Adulto»\? Esta acción no se puede deshacer\./)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText(/¿Eliminar/)).not.toBeInTheDocument();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it('deletes after the person confirms, and the row goes away', async () => {
    serve([croquetas, juguete]);
    vi.mocked(apiClient.delete).mockResolvedValue(ok(undefined));
    renderAt('/catalog/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Croquetas Adulto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/admin/products/p-1', {});
    expect(await screen.findByText('Producto eliminado.')).toBeInTheDocument();
    expect(screen.queryByText('Croquetas Adulto')).not.toBeInTheDocument();
    expect(screen.getByText('Juguete para gato')).toBeInTheDocument();
  });
});

describe('creating a product', () => {
  it('sends the product and brings the person back to the list, saying it was created', async () => {
    serve([]);
    vi.mocked(apiClient.post).mockResolvedValue(ok(croquetas));
    renderAt('/catalog/admin/new');
    expect(screen.getByRole('heading', { name: 'Nuevo producto' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^Código/), 'FOOD-001');
    await userEvent.type(screen.getByLabelText(/^Nombre/), 'Croquetas Adulto');
    await userEvent.selectOptions(screen.getByLabelText(/^Categoría/), 'Alimento');
    await userEvent.type(screen.getByLabelText(/^Precio/), '189.000');
    await userEvent.type(screen.getByLabelText(/^Existencias iniciales/), '24');
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/admin/products',
      { sku: 'FOOD-001', name: 'Croquetas Adulto', description: '', category: 'FOOD', price: 189_000, stockQuantity: 24, imageUrl: '' },
      {},
    );
    expect(await screen.findByText('Producto creado.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Administrar catálogo' })).toBeInTheDocument();
  });

  it('offers to go back without saving', () => {
    renderAt('/catalog/admin/new');
    expect(screen.getByRole('link', { name: /volver a la administración/i })).toHaveAttribute('href', '/catalog/admin');
  });
});

describe('editing a product', () => {
  it('shows the product in the form, and saves only what changed', async () => {
    serve([croquetas, juguete]);
    vi.mocked(apiClient.patch).mockResolvedValue(ok({ ...croquetas, price: 200_000 }));
    renderAt('/catalog/admin/p-1/edit');
    expect(await screen.findByRole('heading', { name: 'Editar producto' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Croquetas Adulto');

    const price = screen.getByLabelText(/^Precio/);
    await userEvent.clear(price);
    await userEvent.type(price, '200.000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/admin/products/p-1', { price: 200_000 }, {});
    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Administrar catálogo' })).toBeInTheDocument();
  });

  it('finds an inactive product too: the public route would say it does not exist', async () => {
    serve([croquetas, juguete]);
    renderAt('/catalog/admin/p-2/edit');
    expect(await screen.findByLabelText(/^Nombre/)).toHaveValue('Juguete para gato');
    expect(vi.mocked(apiClient.get).mock.calls[0]?.[0]).toBe('/api/v1/admin/products?page=1&limit=100');
  });

  it('sets the stock apart from the rest, and shows the new one', async () => {
    serve([croquetas]);
    vi.mocked(apiClient.patch).mockResolvedValue(ok({ ...croquetas, stockQuantity: 5 }));
    renderAt('/catalog/admin/p-1/edit');
    const stock = await screen.findByLabelText('Existencias');
    expect(stock).toHaveValue('24');

    await userEvent.clear(stock);
    await userEvent.type(stock, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar existencias' }));

    expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/admin/products/p-1/stock', { stockQuantity: 5 }, {});
    expect(await screen.findByText('Existencias guardadas.')).toBeInTheDocument();
    expect(screen.getByLabelText('Existencias')).toHaveValue('5');
  });

  it('says the product does not exist, and offers the list, instead of an empty form', async () => {
    serve([croquetas]);
    renderAt('/catalog/admin/nope/edit');
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos este producto.');
    expect(screen.queryByLabelText(/^Nombre/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a la administración/i })).toHaveAttribute('href', '/catalog/admin');
  });

  it('says what went wrong when it cannot load, and tries again when asked', async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce({ status: 503, code: 'SERVICE_UNAVAILABLE', userMessage: 'El servicio no está disponible. Inténtalo más tarde.', traceId: 'trace-9' })
      .mockResolvedValueOnce(ok(pageOf([croquetas])));
    renderAt('/catalog/admin/p-1/edit');
    expect(await screen.findByRole('alert')).toHaveTextContent('Referencia: trace-9');
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByLabelText(/^Nombre/)).toHaveValue('Croquetas Adulto');
  });
});
