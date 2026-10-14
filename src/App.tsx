import { Link, Outlet, Route, Routes } from 'react-router-dom';
import { RequireRole } from 'shell/auth';
import './catalog/catalog.css';
import { CatalogPage } from './catalog/pages/CatalogPage';
import { ProductPage } from './catalog/pages/ProductPage';
import { AdminListPage } from './catalog/pages/AdminListPage';
import { EditProductPage, NewProductPage } from './catalog/pages/AdminProductPages';

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
 *
 * The administration needs an ADMIN. RequireRole (lent by the shell) sends a visitor to the sign-in and tells another role
 * it has no permission, so no screen is shown whose every request would fail; the services check the role again anyway.
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<CatalogPage />} />
      <Route path="products/:id" element={<ProductPage />} />
      <Route
        path="admin"
        element={
          <RequireRole role="ADMIN">
            <Outlet />
          </RequireRole>
        }
      >
        <Route index element={<AdminListPage />} />
        <Route path="new" element={<NewProductPage />} />
        <Route path=":id/edit" element={<EditProductPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
