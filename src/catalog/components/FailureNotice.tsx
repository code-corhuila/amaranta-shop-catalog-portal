import type { FailureView } from '../model/failure';

/** The error state of a screen: what happened for a person, the reference to give, and a way to try again. */
export function FailureNotice({ failure, onRetry }: { failure: FailureView; onRetry: () => void }) {
  return (
    <div role="alert">
      <p>{failure.message}</p>
      {failure.reference && <p>Referencia: {failure.reference}</p>}
      <button type="button" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
