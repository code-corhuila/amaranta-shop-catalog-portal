import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from 'shell/apiClient';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { deferred, ok, pageOf, product } from '../../test/fixtures';
import { CatalogPage } from './CatalogPage';

/** Mounted the way the shell mounts the portal: under /catalog, with the router the shell owns. */
function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/catalog/*" element={<Routes><Route index element={<CatalogPage />} /></Routes>} />
      </Routes>
    </MemoryRouter>,
  );
}

const croquetas = product({ id: 'p-1', name: 'Croquetas 3 kg', priceFormatted: '$ 189.000', stockQuantity: 24, description: 'Para perros adultos' });
const juguete = product({ id: 'p-2', name: 'Juguete para gato', priceFormatted: '$ 8.500', stockQuantity: 0, inStock: false });

describe('the four states of the list', () => {
  it('says it is loading while it waits', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => undefined));
    renderAt('/catalog');
    expect(screen.getByRole('status')).toHaveTextContent(/cargando productos/i);
  });

  it('draws placeholders in the shape of the cards while it loads, hidden from a screen reader that already has the status', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => undefined));
    const { container } = renderAt('/catalog');
    const placeholders = container.querySelectorAll('.skeleton');
    expect(placeholders.length).toBeGreaterThanOrEqual(6);
    expect(placeholders[0]?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveClass('sr-only');
  });

  it('shows the products with their formatted price, as the service sent it', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok(pageOf([croquetas, juguete])));
    renderAt('/catalog');
    expect(await screen.findByRole('link', { name: 'Croquetas 3 kg' })).toHaveAttribute('href', '/catalog/products/p-1');
    expect(screen.getByText('$ 189.000')).toBeInTheDocument();
    expect(screen.getByText('Para perros adultos')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says a product is out of stock instead of hiding it', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok(pageOf([croquetas, juguete])));
    renderAt('/catalog');
    const item = (await screen.findByRole('link', { name: 'Juguete para gato' })).closest('li') as HTMLElement;
    expect(within(item).getByText('Agotado')).toBeInTheDocument();
    const inStock = screen.getByRole('link', { name: 'Croquetas 3 kg' }).closest('li') as HTMLElement;
    expect(within(inStock).getByText(/24 disponibles/)).toBeInTheDocument();
  });

  it('says there is nothing, instead of leaving the screen blank', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok(pageOf([])));
    renderAt('/catalog');
    expect(await screen.findByText(/no hay productos disponibles/i)).toBeInTheDocument();
  });

  it('shows the way back when the page asked for is past the last one', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok(pageOf([], { page: 9, total: 13, totalPages: 2 })));
    renderAt('/catalog?page=9');
    expect(await screen.findByText(/no hay productos en esta página/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /primera página/i })).toHaveAttribute('href', '/catalog?page=1');
  });

  it('says what went wrong, with the reference, and tries again when asked', async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce({ status: 503, userMessage: 'El servicio no está disponible. Inténtalo más tarde.', traceId: 'trace-7' })
      .mockResolvedValueOnce(ok(pageOf([croquetas])));
    renderAt('/catalog');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El servicio no está disponible. Inténtalo más tarde.');
    expect(alert).toHaveTextContent('Referencia: trace-7');

    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('link', { name: 'Croquetas 3 kg' })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('gives a neutral message, and no reference, for a failure that did not come from the shell', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('TypeError: x is undefined at catalog.js:1'));
    renderAt('/catalog');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ocurrió un error inesperado. Inténtalo de nuevo.');
    expect(alert).not.toHaveTextContent(/TypeError|Referencia/);
  });
});

describe('the page of the list', () => {
  const threePages = (page: number) => pageOf([croquetas], { page, limit: 12, total: 30, totalPages: 3 });

  it('asks for the page the address names, and for the first one when the address is nonsense', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok(threePages(2)));
    renderAt('/catalog?page=2');
    await screen.findByRole('link', { name: 'Croquetas 3 kg' });
    expect(vi.mocked(apiClient.get).mock.calls[0]?.[0]).toBe('/api/v1/products?page=2&limit=12');

    vi.mocked(apiClient.get).mockClear();
    for (const bad of ['abc', '0', '-3', '2.5']) {
      renderAt(`/catalog?page=${bad}`);
      await screen.findAllByRole('link', { name: 'Croquetas 3 kg' });
      expect(vi.mocked(apiClient.get).mock.calls.at(-1)?.[0]).toBe('/api/v1/products?page=1&limit=12');
    }
  });

  it('says where the person is, and moves one page at a time', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => ok(threePages(Number(new URL(path, 'http://x').searchParams.get('page')))));
    renderAt('/catalog');
    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anterior/i })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(await screen.findByText('Página 3 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled();
  });

  it('does not offer pages when everything fits in one', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok(pageOf([croquetas])));
    renderAt('/catalog');
    await screen.findByRole('link', { name: 'Croquetas 3 kg' });
    expect(screen.queryByRole('navigation', { name: /paginación/i })).not.toBeInTheDocument();
  });
});

/** The navigation of the shell, or the back button: it changes the address while the list is still waiting for an answer. */
function renderWithJumps(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <nav aria-label="Salto externo">
        <Link to="/catalog?page=1">ir a la 1</Link>
        <Link to="/catalog?page=2">ir a la 2</Link>
      </nav>
      <Routes>
        <Route path="/catalog/*" element={<Routes><Route index element={<CatalogPage />} /></Routes>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('a newer request replaces the older one (Annex H)', () => {
  it('keeps the page the person is on when the answer of the page they left arrives late', async () => {
    const slowFirst = deferred<ReturnType<typeof ok>>();
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      const page = Number(new URL(path, 'http://x').searchParams.get('page'));
      return page === 1 ? slowFirst.promise : Promise.resolve(ok(pageOf([juguete], { page: 2, total: 24, totalPages: 2 })));
    });
    renderWithJumps('/catalog?page=1');
    expect(screen.getByRole('status')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'ir a la 2' }));
    expect(await screen.findByRole('link', { name: 'Juguete para gato' })).toBeInTheDocument();

    // The slow answer of page 1 arrives now. Without the rule, it would overwrite page 2.
    slowFirst.resolve(ok(pageOf([croquetas], { page: 1, total: 24, totalPages: 2 })));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole('link', { name: 'Juguete para gato' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Croquetas 3 kg' })).not.toBeInTheDocument();
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
  });

  it('cancels the request of the page it leaves', async () => {
    const signals: AbortSignal[] = [];
    vi.mocked(apiClient.get).mockImplementation((_path: string, options?: { signal?: AbortSignal }) => {
      if (options?.signal) signals.push(options.signal);
      return new Promise(() => undefined);
    });
    renderWithJumps('/catalog?page=1');
    await userEvent.click(screen.getByRole('link', { name: 'ir a la 2' }));
    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });

  it('does not show a request it cancelled as an error', async () => {
    vi.mocked(apiClient.get).mockImplementation(
      (_path: string, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    );
    renderWithJumps('/catalog?page=1');
    await userEvent.click(screen.getByRole('link', { name: 'ir a la 2' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
