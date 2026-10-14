import { Route, Routes } from 'react-router-dom';
import { CatalogPage } from './catalog/pages/CatalogPage';

/**
 * What the shell mounts under /catalog (it exposes this as `./App`). The shell owns the router: the routes here are
 * relative to where the shell mounted the portal, so the portal does not know its own prefix.
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<CatalogPage />} />
    </Routes>
  );
}
