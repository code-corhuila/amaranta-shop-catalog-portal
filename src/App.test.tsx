import { render, screen } from '@testing-library/react';
import { apiClient } from 'shell/apiClient';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App, the component the shell mounts under /catalog', () => {
  it('shows the catalog at the route the shell mounted it on', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => undefined));
    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <Routes>
          <Route path="/catalog/*" element={<App />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/products?page=1&limit=12', expect.anything());
  });
});
