import { describe, expect, it } from 'vitest';
import type { FailureView } from './failure';
import { emptyForm, formFromProduct, serverIssues, validateChanges, validateNewProduct, type FormValues } from './productForm';
import type { AdminProduct } from './product';

const valid: FormValues = {
  sku: 'FOOD-001',
  name: 'Croquetas Adulto',
  description: 'Para perros adultos',
  category: 'FOOD',
  price: '189.000',
  stockQuantity: '24',
  imageUrl: 'https://example.test/a.png',
};

const original: AdminProduct = {
  id: 'p-1',
  sku: 'FOOD-001',
  name: 'Croquetas Adulto',
  description: 'Para perros adultos',
  category: 'FOOD',
  price: 189_000,
  priceFormatted: '$ 189.000',
  stockQuantity: 24,
  inStock: true,
  imageUrl: 'https://example.test/a.png',
  isActive: true,
};

describe('validateNewProduct', () => {
  it('turns what was typed into what the service takes: whole pesos and a whole stock', () => {
    expect(validateNewProduct(valid)).toEqual({
      ok: true,
      product: { sku: 'FOOD-001', name: 'Croquetas Adulto', description: 'Para perros adultos', category: 'FOOD', price: 189_000, stockQuantity: 24, imageUrl: 'https://example.test/a.png' },
    });
  });

  it('trims what is typed, and lets the description and the picture be empty', () => {
    const result = validateNewProduct({ ...valid, sku: '  FOOD-001 ', name: ' Croquetas ', description: '', imageUrl: '' });
    expect(result).toMatchObject({ ok: true, product: { sku: 'FOOD-001', name: 'Croquetas', description: '', imageUrl: '' } });
  });

  it('names every field that is wrong at once, so the person fixes them in one go', () => {
    const result = validateNewProduct({ sku: '', name: '', description: '', category: '', price: '10.5', stockQuantity: '-1', imageUrl: '' });
    expect(result).toEqual({
      ok: false,
      errors: {
        sku: 'Escribe el código del producto.',
        name: 'Escribe el nombre.',
        category: 'Elige una categoría.',
        price: 'Escribe el precio en pesos enteros, por ejemplo 189000 o 189.000.',
        stockQuantity: 'Escribe un número entero, 0 o más.',
      },
    });
  });

  it('keeps to the lengths the service allows', () => {
    expect(validateNewProduct({ ...valid, sku: 'A' })).toMatchObject({ ok: false, errors: { sku: 'El código debe tener entre 2 y 50 caracteres.' } });
    expect(validateNewProduct({ ...valid, sku: 'A'.repeat(51) })).toMatchObject({ ok: false, errors: { sku: 'El código debe tener entre 2 y 50 caracteres.' } });
    expect(validateNewProduct({ ...valid, name: 'N'.repeat(121) })).toMatchObject({ ok: false, errors: { name: 'El nombre admite hasta 120 caracteres.' } });
    expect(validateNewProduct({ ...valid, description: 'D'.repeat(501) })).toMatchObject({ ok: false, errors: { description: 'La descripción admite hasta 500 caracteres.' } });
  });

  it('accepts only a category the service knows', () => {
    expect(validateNewProduct({ ...valid, category: 'PETS' })).toMatchObject({ ok: false, errors: { category: 'Elige una categoría.' } });
  });

  it('accepts a picture only as an http or https address', () => {
    for (const bad of ['javascript:alert(1)', 'ftp://x.test/a.png', 'a.png', 'https://']) {
      expect(validateNewProduct({ ...valid, imageUrl: bad })).toMatchObject({ ok: false, errors: { imageUrl: 'Escribe una dirección que empiece por http:// o https://.' } });
    }
    expect(validateNewProduct({ ...valid, imageUrl: 'HTTP://example.test/a.png' })).toMatchObject({ ok: true });
  });
});

describe('validateChanges: only what changed goes to the service', () => {
  it('sends nothing when nothing changed', () => {
    expect(validateChanges(formFromProduct(original), original)).toEqual({ ok: true, changes: {} });
  });

  it('sends only the fields that are different, with the price as whole pesos', () => {
    const values = { ...formFromProduct(original), name: 'Croquetas Premium', price: '200.000' };
    expect(validateChanges(values, original)).toEqual({ ok: true, changes: { name: 'Croquetas Premium', price: 200_000 } });
  });

  it('does not take a price written another way for a change', () => {
    expect(validateChanges({ ...formFromProduct(original), price: '189000' }, original)).toEqual({ ok: true, changes: {} });
  });

  it('names what is wrong in what was changed, and ignores what the edit does not touch (code and stock)', () => {
    const values = { ...formFromProduct(original), sku: '', stockQuantity: 'abc', name: '' };
    expect(validateChanges(values, original)).toEqual({ ok: false, errors: { name: 'Escribe el nombre.' } });
  });
});

describe('formFromProduct and emptyForm', () => {
  it('writes the price the way it is read back, and a missing picture as empty', () => {
    expect(formFromProduct({ ...original, imageUrl: null })).toMatchObject({ price: '189.000', imageUrl: '', stockQuantity: '24' });
  });

  it('starts empty, with nothing chosen', () => {
    expect(emptyForm()).toEqual({ sku: '', name: '', description: '', category: '', price: '', stockQuantity: '', imageUrl: '' });
  });
});

describe('serverIssues: what the service says is wrong, in the person\'s words, next to the field', () => {
  const failure = (overrides: Partial<FailureView>): FailureView => ({ message: 'Revisa los datos ingresados.', reference: 't-1', status: 400, code: 'VALIDATION_ERROR', details: [], ...overrides });

  it('puts the detail beside each field the service named', () => {
    const issues = serverIssues(failure({ details: [{ field: 'price', message: 'Input should be greater than or equal to 1' }, { field: 'name', message: 'String should have at least 1 character' }] }));
    expect(issues.fields).toEqual({ price: 'Revisa este campo.', name: 'Revisa este campo.' });
    expect(issues.general).toBeNull();
  });

  it('never shows the service\'s English text to the person', () => {
    const issues = serverIssues(failure({ details: [{ field: 'price', message: 'Input should be greater than or equal to 1' }] }));
    expect(JSON.stringify(issues)).not.toContain('Input should');
  });

  it('says that a code is already taken, beside the code', () => {
    const issues = serverIssues(failure({ status: 422, code: 'BUSINESS_RULE_VIOLATION', details: [{ field: 'rule', message: 'SKU_ALREADY_EXISTS' }] }));
    expect(issues.fields).toEqual({ sku: 'Ya existe un producto con este código.' });
  });

  it('leaves what it cannot place beside a field to the message of the whole form', () => {
    const issues = serverIssues(failure({ status: 503, code: 'SERVICE_UNAVAILABLE', message: 'El servicio no está disponible. Inténtalo más tarde.', details: [] }));
    expect(issues).toEqual({ fields: {}, general: 'El servicio no está disponible. Inténtalo más tarde.' });
  });

  it('keeps an unplaced rule for the whole form too', () => {
    const issues = serverIssues(failure({ status: 422, code: 'BUSINESS_RULE_VIOLATION', message: 'No se pudo completar la operación.', details: [{ field: 'rule', message: 'SOMETHING_ELSE' }] }));
    expect(issues).toEqual({ fields: {}, general: 'No se pudo completar la operación.' });
  });
});
