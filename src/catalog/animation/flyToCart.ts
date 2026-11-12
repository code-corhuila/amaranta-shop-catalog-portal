/** How long the product is in the air. Long enough to follow with the eyes, short enough not to make the person wait. */
const FLIGHT_MS = 750;
/** How high the arc rises above the straight line from the product to the cart, in pixels. */
const ARC_HEIGHT = 110;
/** The largest the flying copy is, in pixels: a big card must not send a big picture across the page. */
const MAX_SIZE = 96;
/** How long the cart link keeps its bump class: the length of its animation in the shell's base styles. */
const BUMP_MS = 500;

function prefersLessMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Flies a copy of the product's picture from where it is on the screen to the cart link of the shell (the element marked
 * `data-cart-target`), along an arc, and resolves when it lands. The cart link then gives a little bump.
 *
 * It resolves AT ONCE, without drawing anything, when there is nothing to fly to, when the browser cannot animate, or when the
 * person asked for less motion: adding to the cart never waits for an animation that cannot play, and never fails because of one.
 */
export async function flyToCart(source: Element | null, imageUrl: string | null): Promise<void> {
  const target = document.querySelector('[data-cart-target]');
  if (!source || !target || typeof Element.prototype.animate !== 'function' || prefersLessMotion()) return;

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.max(32, Math.min(from.width, from.height, MAX_SIZE));
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const dx = to.left + to.width / 2 - startX;
  const dy = to.top + to.height / 2 - startY;

  const flyer = document.createElement('div');
  flyer.className = 'fly-item';
  flyer.setAttribute('aria-hidden', 'true');
  flyer.style.width = `${size}px`;
  flyer.style.height = `${size}px`;
  flyer.style.left = `${startX - size / 2}px`;
  flyer.style.top = `${startY - size / 2}px`;
  if (imageUrl) {
    const picture = document.createElement('img');
    picture.src = imageUrl;
    picture.alt = '';
    flyer.append(picture);
  }
  document.body.append(flyer);

  const done = () => flyer.remove();
  try {
    await flyer.animate(
      [
        { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
        // The middle of the flight rises above the straight line, so the product jumps instead of sliding.
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - ARC_HEIGHT}px) scale(0.8) rotate(-14deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.18) rotate(18deg)`, opacity: 0.7, offset: 1 },
      ],
      { duration: FLIGHT_MS, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'forwards' },
    ).finished;
    target.classList.add('cart-bump');
    window.setTimeout(() => target.classList.remove('cart-bump'), BUMP_MS);
  } catch {
    // A cancelled animation (the page changed under it) is not an error: the product is added all the same.
  } finally {
    done();
  }
}
