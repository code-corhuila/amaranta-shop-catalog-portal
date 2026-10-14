import { useEffect, useState, type FormEvent } from 'react';
import { describeFailure, isCancelled, type FailureView } from '../model/failure';
import { parseStock, stockMessage } from '../model/numbers';

interface Props {
  readonly current: number;
  readonly onSave: (quantity: number) => Promise<void>;
}

/** Sets the stock of a product exactly. It is its own form because the service has its own route for it. */
export function StockForm({ current, onSave }: Props) {
  const [text, setText] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<FailureView | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  // The stock can change somewhere else (another admin, a sale): the field follows it.
  useEffect(() => setText(String(current)), [current]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setSaved(false);
    setFailure(null);

    const parsed = parseStock(text);
    if (!parsed.ok) return setError(stockMessage(parsed.error));
    setError(null);

    setPending(true);
    try {
      await onSave(parsed.quantity);
      setSaved(true);
    } catch (cause) {
      if (!isCancelled(cause)) setFailure(describeFailure(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="stock-form">
      {failure && (
        <div role="alert">
          <p>{failure.message}</p>
          {failure.reference && <p>Referencia: {failure.reference}</p>}
        </div>
      )}
      {saved && <p role="status">Existencias guardadas.</p>}
      <div className="field">
        <label htmlFor="stock">Existencias</label>
        <input
          id="stock"
          value={text}
          onChange={(event) => setText(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={error !== null}
          aria-describedby={error ? 'stock-error' : undefined}
        />
        {error && (
          <p id="stock-error" className="field-error">
            {error}
          </p>
        )}
      </div>
      <button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar existencias'}
      </button>
    </form>
  );
}
