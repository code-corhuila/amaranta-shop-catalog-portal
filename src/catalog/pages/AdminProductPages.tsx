import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createProduct, listAllAdminProducts, setStock, updateProduct } from '../api/adminApi';
import { FailureNotice } from '../components/FailureNotice';
import { ProductForm } from '../components/ProductForm';
import { StockForm } from '../components/StockForm';
import { useRequest } from '../hooks/useRequest';
import type { AdminProduct } from '../model/product';

export function NewProductPage() {
  const navigate = useNavigate();
  return (
    <section>
      <h2>Nuevo producto</h2>
      <p>
        <Link to=".." relative="path">
          Volver a la administración
        </Link>
      </p>
      <ProductForm
        mode="create"
        onCreate={async (product) => {
          await createProduct(product);
          // The list is /catalog/admin, one segment above /catalog/admin/new: the portal does not know its own prefix.
          void navigate('..', { relative: 'path', state: { notice: 'Producto creado.' } });
        }}
      />
    </section>
  );
}

/**
 * Edits one product. The administration has no route for one product (the public one answers 404 for an inactive product), so
 * it is found in the administration list.
 */
export function EditProductPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state, retry } = useRequest((signal) => listAllAdminProducts(signal), 'admin:all');
  // The product after its stock was set here: the rest of the list does not know yet.
  const [restocked, setRestocked] = useState<AdminProduct | null>(null);

  const found = state.status === 'success' ? (restocked?.id === id ? restocked : (state.data.find((p) => p.id === id) ?? null)) : null;

  return (
    <section>
      <h2>Editar producto</h2>
      <p>
        <Link to="../.." relative="path">
          Volver a la administración
        </Link>
      </p>

      {state.status === 'loading' && <p role="status">Cargando producto…</p>}
      {state.status === 'error' && <FailureNotice failure={state.failure} onRetry={retry} />}
      {state.status === 'success' && found === null && (
        <div role="alert">
          <p>No encontramos este producto.</p>
        </div>
      )}

      {found && (
        <>
          <ProductForm
            key={found.id}
            mode="edit"
            product={found}
            onUpdate={async (changes) => {
              await updateProduct(found.id, changes);
              void navigate('../..', { relative: 'path', state: { notice: 'Cambios guardados.' } });
            }}
          />
          <h3>Existencias</h3>
          <StockForm
            current={found.stockQuantity}
            onSave={async (quantity) => {
              setRestocked(await setStock(found.id, quantity));
            }}
          />
        </>
      )}
    </section>
  );
}
