import type { NewProduct, ProductChanges } from '../api/adminApi';
import type { FailureView } from './failure';
import { CATEGORIES } from './filters';
import { formatPesos, parsePesos, parseStock, pesosMessage, stockMessage } from './numbers';
import type { AdminProduct } from './product';

/** Everything in a form is text until it is checked: money and quantities are read from it, never computed (Annex H). */
export interface FormValues {
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly price: string;
  readonly stockQuantity: string;
  readonly imageUrl: string;
}

export type FieldName = keyof FormValues;
export type FormErrors = Partial<Record<FieldName, string>>;

export function emptyForm(): FormValues {
  return { sku: '', name: '', description: '', category: '', price: '', stockQuantity: '', imageUrl: '' };
}

export function formFromProduct(product: AdminProduct): FormValues {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    price: formatPesos(product.price),
    stockQuantity: String(product.stockQuantity),
    imageUrl: product.imageUrl ?? '',
  };
}

const IMAGE_ADDRESS = /^https?:\/\/\S+$/i;
const NO_HOST = /^https?:\/\/$/i;

// Each check answers with the message for the person, or nothing when the value is fine.
const checks = {
  sku(value: string): string | null {
    if (value === '') return 'Escribe el código del producto.';
    return value.length < 2 || value.length > 50 ? 'El código debe tener entre 2 y 50 caracteres.' : null;
  },
  name(value: string): string | null {
    if (value === '') return 'Escribe el nombre.';
    return value.length > 120 ? 'El nombre admite hasta 120 caracteres.' : null;
  },
  description(value: string): string | null {
    return value.length > 500 ? 'La descripción admite hasta 500 caracteres.' : null;
  },
  category(value: string): string | null {
    return CATEGORIES.some((c) => c.value === value) ? null : 'Elige una categoría.';
  },
  imageUrl(value: string): string | null {
    if (value === '') return null;
    if (value.length > 500) return 'La dirección de la imagen admite hasta 500 caracteres.';
    return IMAGE_ADDRESS.test(value) && !NO_HOST.test(value) ? null : 'Escribe una dirección que empiece por http:// o https://.';
  },
};

function trimmed(values: FormValues) {
  return { ...values, sku: values.sku.trim(), name: values.name.trim(), description: values.description.trim(), imageUrl: values.imageUrl.trim() };
}

/** The fields both a new product and an edit have. */
function checkCommon(values: ReturnType<typeof trimmed>): { errors: FormErrors; price: number | null } {
  const errors: FormErrors = {};
  for (const field of ['name', 'description', 'category', 'imageUrl'] as const) {
    const message = checks[field](values[field]);
    if (message) errors[field] = message;
  }
  const price = parsePesos(values.price);
  if (!price.ok) errors.price = pesosMessage(price.error);
  return { errors, price: price.ok ? price.pesos : null };
}

export type NewProductResult = { readonly ok: true; readonly product: NewProduct } | { readonly ok: false; readonly errors: FormErrors };

export function validateNewProduct(input: FormValues): NewProductResult {
  const values = trimmed(input);
  const { errors, price } = checkCommon(values);
  const sku = checks.sku(values.sku);
  if (sku) errors.sku = sku;
  const stock = parseStock(values.stockQuantity);
  if (!stock.ok) errors.stockQuantity = stockMessage(stock.error);

  if (Object.keys(errors).length > 0 || price === null || !stock.ok) return { ok: false, errors };
  return {
    ok: true,
    product: { sku: values.sku, name: values.name, description: values.description, category: values.category, price, stockQuantity: stock.quantity, imageUrl: values.imageUrl },
  };
}

export type ChangesResult = { readonly ok: true; readonly changes: ProductChanges } | { readonly ok: false; readonly errors: FormErrors };

/** Only what is different from the product goes to the service. The code and the stock are not part of an edit. */
export function validateChanges(input: FormValues, original: AdminProduct): ChangesResult {
  const values = trimmed(input);
  const { errors, price } = checkCommon(values);
  if (Object.keys(errors).length > 0 || price === null) return { ok: false, errors };

  const changes: { -readonly [K in keyof ProductChanges]: ProductChanges[K] } = {};
  if (values.name !== original.name) changes.name = values.name;
  if (values.description !== original.description) changes.description = values.description;
  if (values.category !== original.category) changes.category = values.category;
  if (price !== original.price) changes.price = price;
  if (values.imageUrl !== (original.imageUrl ?? '')) changes.imageUrl = values.imageUrl;
  return { ok: true, changes };
}

export interface ServerIssues {
  /** Beside the field. */
  readonly fields: FormErrors;
  /** For the whole form, when the service said something that belongs to no field. */
  readonly general: string | null;
}

const FIELDS: readonly string[] = ['sku', 'name', 'description', 'category', 'price', 'stockQuantity', 'imageUrl'];

/**
 * What the service says is wrong, in the words of the person. The service writes for a developer (in English, naming
 * pydantic rules), so its text is never shown: the field it named gets a neutral line, and the rule it broke is translated.
 */
export function serverIssues(failure: FailureView): ServerIssues {
  const fields: FormErrors = {};
  for (const { field, message } of failure.details) {
    if (field === 'rule' && message === 'SKU_ALREADY_EXISTS') fields.sku = 'Ya existe un producto con este código.';
    else if (FIELDS.includes(field)) fields[field as FieldName] = 'Revisa este campo.';
  }
  return { fields, general: Object.keys(fields).length > 0 ? null : failure.message };
}
