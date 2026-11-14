import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from 'shell/apiClient';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { deferred, ok, product } from '../../test/fixtures';

/** Mounted the way the shell mounts the portal: under /catalog, with the router the shell owns. */
function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <nav aria-label="Salto externo">
        <Link to="/catalog/products/p-1">ir al 1</Link>
        <Link to="/catalog/products/p-2">ir al 2</Link>
      </nav>
      <Routes>
        <Route path="/catalog/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
}

const croquetas = product({
  id: 'p-1',
  name: 'Croquetas 3 kg',
  description: 'Para perros adultos',
  category: 'FOOD',
  sku: 'SKU-399d',
  priceFormatted: '$ 189.000',
  stockQuantity: 24,
  imageUrl: 'https://example.test/a.png',
});

describe('the detail of a product', () => {
  it('says it is loading while it waits', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => undefined));
    renderAt('/catalog/products/p-1');
    expect(screen.getByRole('status')).toHaveTextContent(/cargando producto/i);
  });

  it('asks for the product the address names', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok(croquetas));
    renderAt('/catalog/products/p-1');
    await screen.findByRole('heading', { name: 'Croquetas 3 kg' });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/products/p-1', expect.anything());
  });

  it('shows what there is to know about it, and the way back to the list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok(croquetas));
    renderAt('/catalog/products/p-1');
    expect(await screen.findByRole('heading', { name: 'Croquetas 3 kg' })).toBeInTheDocument();
    expect(screen.getByText('Para perros adultos')).toBeInTheDocument();
    expect(screen.getByText('$ 189.000')).toBeInTheDocument();
    expect(screen.getByText(/24 disponibles/)).toBeInTheDocument();
    expect(screen.getByText(/SKU-399d/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Croquetas 3 kg' })).toHaveAttribute('src', 'https://example.test/a.png');
    expect(screen.getByRole('link', { name: /volver al catálogo/i })).toHaveAttribute('href', '/catalog');
  });

  it('says a product is out of stock', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok(product({ id: 'p-2', name: 'Juguete', stockQuantity: 0, inStock: false })));
    renderAt('/catalog/products/p-2');
    expect(await screen.findByText('Agotado')).toBeInTheDocument();
  });

  it('shows no picture when the product has none, instead of a broken one', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok(product({ id: 'p-2', name: 'Juguete', imageUrl: null })));
    renderAt('/catalog/products/p-2');
    await screen.findByRole('heading', { name: 'Juguete' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('says the product does not exist, and offers the list, not a retry that cannot help', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ status: 404, userMessage: 'No encontramos lo que buscas.', traceId: 'trace-4' });
    renderAt('/catalog/products/nope');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No encontramos lo que buscas.');
    expect(alert).toHaveTextContent('Referencia: trace-4');
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver al catálogo/i })).toHaveAttribute('href', '/catalog');
  });

  it('treats an id that is not an id the same way: nothing to retry', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ status: 400, userMessage: 'Revisa los datos ingresados.', traceId: 't' });
    renderAt('/catalog/products/not-a-uuid');
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });

  it('offers to try again when the failure may pass, and shows the product when it does', async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce({ status: 503, userMessage: 'El servicio no está disponible. Inténtalo más tarde.', traceId: 'trace-5' })
      .mockResolvedValueOnce(ok(croquetas));
    renderAt('/catalog/products/p-1');
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio no está disponible');
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('heading', { name: 'Croquetas 3 kg' })).toBeInTheDocument();
  });

  it('keeps the product the person is on when the answer of the one they left arrives late', async () => {
    const slowFirst = deferred<ReturnType<typeof ok>>();
    vi.mocked(apiClient.get).mockImplementation((path: string) =>
      path.endsWith('/p-1') ? slowFirst.promise : Promise.resolve(ok(product({ id: 'p-2', name: 'Juguete para gato' }))),
    );
    renderAt('/catalog/products/p-1');
    await userEvent.click(screen.getByRole('link', { name: 'ir al 2' }));
    expect(await screen.findByRole('heading', { name: 'Juguete para gato' })).toBeInTheDocument();

    slowFirst.resolve(ok(croquetas));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole('heading', { name: 'Juguete para gato' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Croquetas 3 kg' })).not.toBeInTheDocument();
  });
});

describe('a route of the catalog that does not exist', () => {
  it('says so and offers the list', () => {
    renderAt('/catalog/nada/por/aqui');
    expect(screen.getByRole('heading', { name: /no encontramos esta página/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver al catálogo/i })).toHaveAttribute('href', '/catalog');
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
