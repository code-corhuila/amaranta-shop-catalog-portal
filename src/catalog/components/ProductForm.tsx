import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { NewProduct, ProductChanges } from '../api/adminApi';
import { describeFailure, isCancelled } from '../model/failure';
import { CATEGORIES } from '../model/filters';
import type { AdminProduct } from '../model/product';
import { emptyForm, formFromProduct, serverIssues, validateChanges, validateNewProduct, type FieldName, type FormErrors, type FormValues } from '../model/productForm';

type Props =
  | { readonly mode: 'create'; readonly onCreate: (product: NewProduct) => Promise<void> }
  | { readonly mode: 'edit'; readonly product: AdminProduct; readonly onUpdate: (changes: ProductChanges) => Promise<void> };

/** The order the fields are in on the screen: the first one that is wrong gets the cursor. */
const ORDER: readonly FieldName[] = ['sku', 'name', 'description', 'category', 'price', 'stockQuantity', 'imageUrl'];

interface FieldProps {
  readonly name: FieldName;
  readonly label: string;
  readonly hint?: string;
  readonly error: string | undefined;
  readonly children: (aria: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode;
}

/** A label, the field, and what is wrong with it beside it, joined for a screen reader (Annex H). */
function Field({ name, label, hint, error, children }: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children({ id: name, 'aria-invalid': error !== undefined, 'aria-describedby': error ? errorId : hint ? hintId : undefined })}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Creates a product or edits one. It validates first, says what is wrong beside each field, and sends once. */
export function ProductForm(props: Props) {
  const editing = props.mode === 'edit';
  const [values, setValues] = useState<FormValues>(props.mode === 'edit' ? formFromProduct(props.product) : emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [general, setGeneral] = useState<{ message: string; reference: string | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fields = useRef<Partial<Record<FieldName, HTMLElement | null>>>({});

  const set = (name: FieldName) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const register = (name: FieldName) => (element: HTMLElement | null) => {
    fields.current[name] = element;
  };

  function show(next: FormErrors) {
    setErrors(next);
    const first = ORDER.find((name) => next[name] !== undefined);
    if (first) fields.current[first]?.focus();
  }

  async function save(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
      setErrors({});
    } catch (failure) {
      if (isCancelled(failure)) return;
      const view = describeFailure(failure);
      const issues = serverIssues(view);
      show(issues.fields);
      setGeneral({ message: issues.general ?? 'Revisa los campos marcados.', reference: view.reference });
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setGeneral(null);
    setNotice(null);

    if (props.mode === 'create') {
      const checked = validateNewProduct(values);
      if (!checked.ok) return show(checked.errors);
      setErrors({});
      await save(() => props.onCreate(checked.product));
      return;
    }

    const checked = validateChanges(values, props.product);
    if (!checked.ok) return show(checked.errors);
    setErrors({});
    if (Object.keys(checked.changes).length === 0) return setNotice('No hay cambios para guardar.');
    await save(() => props.onUpdate(checked.changes));
  }

  return (
    <form onSubmit={submit} noValidate className="product-form">
      {general && (
        <div role="alert">
          <p>{general.message}</p>
          {general.reference && <p>Referencia: {general.reference}</p>}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}

      {editing ? (
        <p>
          Código: <strong>{props.product.sku}</strong>
        </p>
      ) : (
        <Field name="sku" label="Código" hint="Único en el catálogo, de 2 a 50 caracteres." error={errors.sku}>
          {(aria) => <input {...aria} ref={register('sku')} value={values.sku} onChange={set('sku')} autoComplete="off" />}
        </Field>
      )}

      <Field name="name" label="Nombre" error={errors.name}>
        {(aria) => <input {...aria} ref={register('name')} value={values.name} onChange={set('name')} autoComplete="off" />}
      </Field>

      <Field name="description" label="Descripción" error={errors.description}>
        {(aria) => <textarea {...aria} ref={register('description')} rows={3} value={values.description} onChange={set('description')} />}
      </Field>

      <Field name="category" label="Categoría" error={errors.category}>
        {(aria) => (
          <select {...aria} ref={register('category')} value={values.category} onChange={set('category')}>
            <option value="">Elige una categoría</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field name="price" label="Precio" hint="En pesos enteros, por ejemplo 189.000." error={errors.price}>
        {(aria) => <input {...aria} ref={register('price')} value={values.price} onChange={set('price')} inputMode="numeric" autoComplete="off" />}
      </Field>

      {!editing && (
        <Field name="stockQuantity" label="Existencias iniciales" error={errors.stockQuantity}>
          {(aria) => <input {...aria} ref={register('stockQuantity')} value={values.stockQuantity} onChange={set('stockQuantity')} inputMode="numeric" autoComplete="off" />}
        </Field>
      )}

      <Field name="imageUrl" label="Imagen" hint="Opcional. Una dirección que empiece por https://." error={errors.imageUrl}>
        {(aria) => <input {...aria} ref={register('imageUrl')} value={values.imageUrl} onChange={set('imageUrl')} inputMode="url" autoComplete="off" />}
      </Field>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear producto'}
      </button>
    </form>
  );
}
