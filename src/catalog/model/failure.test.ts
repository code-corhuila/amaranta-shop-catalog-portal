import { describe, expect, it } from 'vitest';
import { describeFailure, isCancelled } from './failure';

describe('describeFailure', () => {
  it('shows what the shell decided for the person, with the reference to give', () => {
    const failure = { status: 503, code: 'SERVICE_UNAVAILABLE', userMessage: 'El servicio no está disponible. Inténtalo más tarde.', traceId: 'trace-9' };
    expect(describeFailure(failure)).toEqual({ message: 'El servicio no está disponible. Inténtalo más tarde.', reference: 'trace-9', status: 503 });
  });

  it('has a neutral message for anything that did not come from the shell, and no reference', () => {
    expect(describeFailure(new Error('boom: stack trace here'))).toEqual({ message: 'Ocurrió un error inesperado. Inténtalo de nuevo.', reference: null, status: null });
    expect(describeFailure('x')).toEqual({ message: 'Ocurrió un error inesperado. Inténtalo de nuevo.', reference: null, status: null });
    expect(describeFailure(null).message).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
  });

  it('never shows the technical text of an unexpected error', () => {
    expect(JSON.stringify(describeFailure(new Error('NullPointerException at Order.java:42')))).not.toContain('NullPointer');
  });
});

describe('isCancelled', () => {
  it('recognises a request the screen cancelled on purpose, which is not a failure to show', () => {
    expect(isCancelled(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isCancelled(new Error('boom'))).toBe(false);
    expect(isCancelled({ status: 0, userMessage: 'x', traceId: 't' })).toBe(false);
  });
});
