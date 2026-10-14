import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { deleteProduct, listAdminProducts, setActive } from '../api/adminApi';
import { FailureNotice } from '../components/FailureNotice';
import { Pager } from '../components/Pager';
import { useRequest } from '../hooks/useRequest';
import { describeFailure, isCancelled, type FailureView } from '../model/failure';
import { categoryLabel } from '../model/filters';
import type { AdminProduct } from '../model/product';

const PAGE_SIZE = 20;

function parsePage(raw: string | null): number {
  return raw !== null && /^[1-9]\d*$/.test(raw) ? Number(raw) : 1;
}

/**
 * The administration of the catalog: every product, the inactive ones too, with what the service lets an ADMIN do to each.
 * The screen is behind RequireRole, and the service checks the role again on every request.
 */
export function AdminListPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get('page'));
  const { state, retry } = useRequest((signal) => listAdminProducts({ page, limit: PAGE_SIZE }, signal), `admin:${page}`);

  // What the person did on this screen, on top of what the service listed: a row changed (a product) or gone (null).
  const [overrides, setOverrides] = useState<Record<string, AdminProduct | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [problem, setProblem] = useState<FailureView | null>(null);
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);

  // A new answer from the service replaces what was done on top of the old one.
  useEffect(() => {
    setOverrides({});
    setConfirming(null);
  }, [state]);

  async function act(id: string, run: () => Promise<AdminProduct | null>, done: string) {
    setBusy(id);
    setProblem(null);
    setNotice(null);
    setConfirming(null);
    try {
      const result = await run();
      setOverrides((current) => ({ ...current, [id]: result }));
      setNotice(done);
    } catch (failure) {
      if (!isCancelled(failure)) setProblem(describeFailure(failure));
    } finally {
      setBusy(null);
    }
  }

  const rows = state.status === 'success' ? state.data.data.flatMap((p) => (p.id in overrides ? [overrides[p.id] ?? null] : [p])).filter((p): p is AdminProduct => p !== null) : [];
  const deletedSome = Object.values(overrides).some((value) => value === null);

  return (
    <section>
      <h2>Administrar catálogo</h2>
      <p className="admin-links">
        <Link to="new" className="btn btn-primary">
          Nuevo producto
        </Link>{' '}
        <Link to=".." relative="path">
          Volver al catálogo
        </Link>
      </p>

      {notice && (
        <p role="status" className="notice-success">
          {notice}
        </p>
      )}
      {problem && (
        <div role="alert">
          <p>{problem.message}</p>
          {problem.reference && <p>Referencia: {problem.reference}</p>}
        </div>
      )}

      {state.status === 'loading' && <p role="status">Cargando productos…</p>}
      {state.status === 'error' && <FailureNotice failure={state.failure} onRetry={retry} />}

      {state.status === 'success' && rows.length === 0 && (
        <div>
          {deletedSome ? (
            <p>No quedan productos en esta página.</p>
          ) : (
            <>
              <p>Todavía no hay productos.</p>
              <Link to="new">Crear el primero</Link>
            </>
          )}
        </div>
      )}

      {state.status === 'success' && rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <caption>Productos del catálogo, con los inactivos</caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Código</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Existencias</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const working = busy === product.id;
                  return (
                    <tr key={product.id}>
                      <th scope="row">{product.name}</th>
                      <td>{product.sku}</td>
                      <td>{categoryLabel(product.category)}</td>
                      <td>{product.priceFormatted}</td>
                      <td>{product.stockQuantity > 0 ? product.stockQuantity : 'Agotado'}</td>
                      <td>{product.isActive ? 'Activo' : 'Inactivo'}</td>
                      <td>
                        {confirming === product.id ? (
                          <div role="group" aria-label={`Confirmar la eliminación de ${product.name}`}>
                            <p>{`¿Eliminar «${product.name}»? Esta acción no se puede deshacer.`}</p>
                            <button type="button" className="btn-danger" disabled={working} onClick={() => void act(product.id, async () => (await deleteProduct(product.id), null), 'Producto eliminado.')}>
                              Sí, eliminar
                            </button>{' '}
                            <button type="button" disabled={working} onClick={() => setConfirming(null)}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="row-actions">
                            <Link to={`${encodeURIComponent(product.id)}/edit`} aria-label={`Editar ${product.name}`}>
                              Editar
                            </Link>
                            <button
                              type="button"
                              disabled={working}
                              aria-label={`${product.isActive ? 'Desactivar' : 'Activar'} ${product.name}`}
                              onClick={() => void act(product.id, () => setActive(product.id, !product.isActive), product.isActive ? 'Producto desactivado.' : 'Producto activado.')}
                            >
                              {product.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                            <button type="button" className="btn-danger" disabled={working} aria-label={`Eliminar ${product.name}`} onClick={() => setConfirming(product.id)}>
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager current={state.data.meta.page} totalPages={state.data.meta.totalPages} onPage={(next) => setParams(next > 1 ? { page: String(next) } : {})} />
        </>
      )}
    </section>
  );
}
