import { Link, Route, Routes } from 'react-router-dom';
import { CatalogPage } from './catalog/pages/CatalogPage';
import { ProductPage } from './catalog/pages/ProductPage';

function NotFound() {
  return (
    <section>
      <h2>No encontramos esta página del catálogo</h2>
      <Link to="..">Volver al catálogo</Link>
    </section>
  );
}

/**
 * What the shell mounts under /catalog (it exposes this as `./App`). The shell owns the router: the routes here are
 * relative to where the shell mounted the portal, so the portal does not know its own prefix.
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<CatalogPage />} />
      <Route path="products/:id" element={<ProductPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
