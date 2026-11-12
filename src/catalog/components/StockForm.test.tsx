import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { deferred } from '../../test/fixtures';
import { StockForm } from './StockForm';

describe('the stock of a product', () => {
  it('shows the stock it has, with a label', () => {
    render(<StockForm current={24} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Existencias')).toHaveValue('24');
  });

  it('sets the stock exactly, as a whole number', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<StockForm current={24} onSave={onSave} />);
    const field = screen.getByLabelText('Existencias');
    await userEvent.clear(field);
    await userEvent.type(field, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar existencias' }));
    expect(onSave).toHaveBeenCalledWith(0);
    expect(await screen.findByRole('status')).toHaveTextContent('Existencias guardadas.');
  });

  it('refuses a stock that is not a whole number, beside the field', async () => {
    const onSave = vi.fn();
    render(<StockForm current={24} onSave={onSave} />);
    const field = screen.getByLabelText('Existencias');
    await userEvent.clear(field);
    await userEvent.type(field, '2.5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar existencias' }));
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Escribe un número entero, 0 o más.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('disables the button while it saves', async () => {
    const pending = deferred<void>();
    render(<StockForm current={24} onSave={vi.fn().mockReturnValue(pending.promise)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar existencias' }));
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    pending.resolve();
    expect(await screen.findByRole('button', { name: 'Guardar existencias' })).toBeEnabled();
  });

  it('says what went wrong, with the reference, and keeps what was typed', async () => {
    const onSave = vi.fn().mockRejectedValue({ status: 403, code: 'FORBIDDEN', userMessage: 'No tienes permiso para hacer esto.', traceId: 'trace-3' });
    render(<StockForm current={24} onSave={onSave} />);
    const field = screen.getByLabelText('Existencias');
    await userEvent.clear(field);
    await userEvent.type(field, '9');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar existencias' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No tienes permiso para hacer esto.');
    expect(alert).toHaveTextContent('Referencia: trace-3');
    expect(field).toHaveValue('9');
  });

  it('follows the stock when it changes somewhere else', () => {
    const { rerender } = render(<StockForm current={24} onSave={vi.fn()} />);
    rerender(<StockForm current={3} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Existencias')).toHaveValue('3');
  });
});
