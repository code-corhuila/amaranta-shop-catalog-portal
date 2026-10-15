import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from 'shell/apiClient';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ok, pageOf, product } from '../../test/fixtures';
import { CatalogPage } from './CatalogPage';

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/catalog/*" element={<Routes><Route index element={<CatalogPage />} /></Routes>} />
      </Routes>
    </MemoryRouter>,
  );
}

const croquetas = product({ id: 'p-1', name: 'Croquetas Adulto Salmón', category: 'FOOD', description: 'Para perros' });
const pelota = product({ id: 'p-2', name: 'Pelota Interactiva', category: 'TOYS' });
const rascador = product({ id: 'p-3', name: 'Rascador Torre', category: 'ACCESSORIES' });

/** The service pages; these answers behave like it, whatever `limit` is asked. */
function serve(all: ReturnType<typeof product>[]) {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    const params = new URL(path, 'http://x').searchParams;
    const page = Number(params.get('page'));
    const limit = Number(params.get('limit'));
    const slice = all.slice((page - 1) * limit, page * limit);
    return ok(pageOf(slice, { page, limit, total: all.length, totalPages: Math.ceil(all.length / limit) }));
  });
}

describe('the filters of the catalog', () => {
  it('offers a search and a category, each with its label', async () => {
    serve([croquetas, pelota]);
    renderAt('/catalog');
    await screen.findByRole('link', { name: 'Pelota Interactiva' });
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    const category = screen.getByLabelText('Categoría');
    expect(within(category).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todas', 'Alimento', 'Accesorios', 'Higiene', 'Medicamentos', 'Juguetes']);
  });

  it('does not ask for the whole catalog while nobody filters: the service pages', async () => {
    serve([croquetas, pelota]);
    renderAt('/catalog');
    await screen.findByRole('link', { name: 'Pelota Interactiva' });
    expect(vi.mocked(apiClient.get).mock.calls.map((c) => c[0])).toEqual(['/api/v1/products?page=1&limit=12']);
  });

  it('finds a product by what is typed, ignoring case and accents, and keeps the field as typed', async () => {
    serve([croquetas, pelota, rascador]);
    renderAt('/catalog');
    await screen.findByRole('link', { name: 'Pelota Interactiva' });

    await userEvent.type(screen.getByLabelText('Buscar'), 'SALMON');
    expect(await screen.findByRole('link', { name: 'Croquetas Adulto Salmón' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pelota Interactiva' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toHaveValue('SALMON');
  });

  it('filters by category', async () => {
    serve([croquetas, pelota, rascador]);
    renderAt('/catalog');
    await screen.findByRole('link', { name: 'Pelota Interactiva' });

    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Juguetes');
    expect(await screen.findByRole('link', { name: 'Pelota Interactiva' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Rascador Torre' })).not.toBeInTheDocument();
  });

  it('starts filtered when the address says so, so a filtered view can be shared', async () => {
    serve([croquetas, pelota, rascador]);
    renderAt('/catalog?category=ACCESSORIES&q=torre');
    expect(await screen.findByRole('link', { name: 'Rascador Torre' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pelota Interactiva' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toHaveValue('torre');
    expect(screen.getByLabelText('Categoría')).toHaveValue('ACCESSORIES');
  });

  it('looks through the whole catalog when it filters, not only the page on screen', async () => {
    const many = Array.from({ length: 150 }, (_, i) => product({ id: `m-${i}`, name: `Producto ${i}` }));
    many.push(product({ id: 'needle', name: 'Aguja escondida' }));
    serve(many);
    renderAt('/catalog?q=aguja');

    expect(await screen.findByRole('link', { name: 'Aguja escondida' })).toBeInTheDocument();
    expect(vi.mocked(apiClient.get).mock.calls.map((c) => c[0])).toEqual(['/api/v1/products?page=1&limit=100', '/api/v1/products?page=2&limit=100']);
  });

  it('does not ask again for every letter typed', async () => {
    serve([croquetas, pelota, rascador]);
    renderAt('/catalog?q=p');
    await screen.findByRole('link', { name: 'Pelota Interactiva' });
    vi.mocked(apiClient.get).mockClear();

    await userEvent.type(screen.getByLabelText('Buscar'), 'elota');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('says nothing matched, and takes the filters off when asked', async () => {
    serve([croquetas, pelota]);
    renderAt('/catalog?q=zzz');
    expect(await screen.findByText(/no encontramos productos con esos filtros/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /quitar filtros/i }));
    expect(await screen.findByRole('link', { name: 'Pelota Interactiva' })).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toHaveValue('');
  });

  it('pages what it found, twelve at a time', async () => {
    const dogs = Array.from({ length: 15 }, (_, i) => product({ id: `d-${i}`, name: `Perro ${String(i).padStart(2, '0')}`, category: 'FOOD' }));
    serve([...dogs, pelota]);
    renderAt('/catalog?category=FOOD');
    await screen.findByRole('link', { name: 'Perro 00' });
    expect(screen.getAllByRole('link', { name: /^Perro/ })).toHaveLength(12);
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Perro/ })).toHaveLength(3);
  });

  it('goes back to the first page when the filter changes', async () => {
    const dogs = Array.from({ length: 15 }, (_, i) => product({ id: `d-${i}`, name: `Perro ${String(i).padStart(2, '0')}`, category: 'FOOD' }));
    serve(dogs);
    renderAt('/catalog?category=FOOD&page=2');
    await screen.findByText('Página 2 de 2');

    await userEvent.type(screen.getByLabelText('Buscar'), 'perro');
    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
  });
});
