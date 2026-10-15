import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flyToCart } from './flyToCart';

/** An element that reports the rectangle a browser would, which jsdom does not lay out. */
function placed(left: number, top: number, width: number, height: number, tag = 'div'): HTMLElement {
  const element = document.createElement(tag);
  element.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
  return element;
}

function cartTarget(): HTMLElement {
  const target = placed(800, 20, 80, 30, 'a');
  target.setAttribute('data-cart-target', '');
  document.body.append(target);
  return target;
}

const animate = vi.fn((_keyframes: Keyframe[], _options: KeyframeAnimationOptions) => ({ finished: Promise.resolve() }));

beforeEach(() => {
  animate.mockClear();
  Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true });
});

afterEach(() => {
  delete (Element.prototype as { animate?: unknown }).animate;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('the flight of a product to the cart', () => {
  it('flies a copy of the picture to the center of the cart link, along an arc, and gives the cart a bump when it lands', async () => {
    const target = cartTarget();
    const source = placed(100, 200, 100, 100);
    document.body.append(source);

    await flyToCart(source, 'https://example.test/croquetas.png');

    expect(animate).toHaveBeenCalledTimes(1);
    const keyframes = animate.mock.calls[0]?.[0] ?? [];
    expect(keyframes).toHaveLength(3);
    // From the center of the picture (150, 250) to the center of the link (840, 35): 690 right, 215 up.
    expect(String(keyframes[2]?.transform)).toContain('translate(690px, -215px)');
    // The middle of the arc rises above the straight line.
    expect(String(keyframes[1]?.transform)).toMatch(/translate\(\d+(\.\d+)?px, -\d+(\.\d+)?px\)/);
    expect(target.classList.contains('cart-bump')).toBe(true);
  });

  it('carries the picture of the product and leaves nothing behind once it landed', async () => {
    cartTarget();
    const source = placed(0, 0, 80, 80);
    document.body.append(source);
    const seen: string[] = [];
    animate.mockImplementationOnce(() => {
      const flyer = document.querySelector('.fly-item');
      seen.push(flyer?.querySelector('img')?.getAttribute('src') ?? 'none');
      return { finished: Promise.resolve() };
    });

    await flyToCart(source, 'https://example.test/a.png');

    expect(seen).toEqual(['https://example.test/a.png']);
    expect(document.querySelector('.fly-item')).toBeNull();
  });

  it('flies a plain disc when the product has no picture', async () => {
    cartTarget();
    const source = placed(0, 0, 80, 80);
    document.body.append(source);
    const seen: (string | null)[] = [];
    animate.mockImplementationOnce(() => {
      seen.push(document.querySelector('.fly-item img') === null ? null : 'img');
      return { finished: Promise.resolve() };
    });

    await flyToCart(source, null);

    expect(seen).toEqual([null]);
  });

  it('does not wait for an animation that cannot play: no cart link to fly to', async () => {
    const source = placed(0, 0, 80, 80);
    document.body.append(source);
    await flyToCart(source, 'https://example.test/a.png');
    expect(animate).not.toHaveBeenCalled();
    expect(document.querySelector('.fly-item')).toBeNull();
  });

  it('does not wait for an animation that cannot play: a browser without the Web Animations API', async () => {
    delete (Element.prototype as { animate?: unknown }).animate;
    cartTarget();
    const source = placed(0, 0, 80, 80);
    document.body.append(source);
    await flyToCart(source, 'https://example.test/a.png');
    expect(document.querySelector('.fly-item')).toBeNull();
  });

  it('does not fly for a person who asked for less motion', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);
    cartTarget();
    const source = placed(0, 0, 80, 80);
    document.body.append(source);
    await flyToCart(source, 'https://example.test/a.png');
    expect(animate).not.toHaveBeenCalled();
    // @ts-expect-error jsdom has no matchMedia: put things back the way they were.
    delete window.matchMedia;
  });

  it('cleans up and still resolves when the animation is cancelled', async () => {
    cartTarget();
    const source = placed(0, 0, 80, 80);
    document.body.append(source);
    animate.mockImplementationOnce(() => ({ finished: Promise.reject(new DOMException('cancelled', 'AbortError')) }));
    await expect(flyToCart(source, 'https://example.test/a.png')).resolves.toBeUndefined();
    expect(document.querySelector('.fly-item')).toBeNull();
  });
});
