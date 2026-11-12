import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dog3D from './Dog3D';

// jsdom has no 3D context and says so on the console every time it is asked for one: it is asked, and answered "none", on purpose.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('the 3D dog', () => {
  it('is a picture for a screen reader, and says what it does', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Dog3D />);
    expect(screen.getByRole('img', { name: /perrito/i })).toBeInTheDocument();
  });

  it('shows a plain dog instead of failing when the browser cannot draw in 3D', () => {
    // jsdom cannot make a WebGL context, which is what an old browser or a locked-down one looks like.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(<Dog3D />);
    expect(container.querySelector('.dog3d-fallback')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('leaves nothing behind when it is removed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount, container } = render(<Dog3D />);
    unmount();
    expect(container.innerHTML).toBe('');
  });
});
