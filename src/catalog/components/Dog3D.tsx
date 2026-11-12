import { useEffect, useRef, useState } from 'react';
import { mountDog } from './dog';

/**
 * A 3D puppy that looks at the pointer and wags its tail when the pointer is over it. It is the only part of the portal that needs
 * the 3D library, so the catalog loads it apart (`lazy`) and the list of products never waits for it. Where the browser cannot draw
 * in 3D it shows a plain picture instead: it is decoration, and its absence must never break the page.
 */
export default function Dog3D() {
  const host = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    try {
      return mountDog(element);
    } catch {
      setUnavailable(true);
      return undefined;
    }
  }, []);

  if (unavailable) {
    return (
      <div className="dog3d dog3d-fallback" role="img" aria-label="Perrito de Amaranta">
        🐶
      </div>
    );
  }
  return <div ref={host} className="dog3d" role="img" aria-label="Perrito en 3D: te sigue con la mirada y mueve la cola cuando pasas el mouse" />;
}
