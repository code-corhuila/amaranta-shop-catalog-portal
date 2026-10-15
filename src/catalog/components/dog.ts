import {
  ACESFilmicToneMapping,
  CapsuleGeometry,
  Clock,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  WebGLRenderer,
  type Material,
} from 'three';

type Vec3 = readonly [number, number, number];

const fur = new MeshStandardMaterial({ color: 0xe0a458, roughness: 0.92 });
const furDark = new MeshStandardMaterial({ color: 0xb9772e, roughness: 0.95 });
const cream = new MeshStandardMaterial({ color: 0xf6e7c8, roughness: 0.95 });
const noseMaterial = new MeshStandardMaterial({ color: 0x2b1b14, roughness: 0.35 });
const eyeMaterial = new MeshStandardMaterial({ color: 0x1d1410, roughness: 0.2 });
const tongueMaterial = new MeshStandardMaterial({ color: 0xf08aa3, roughness: 0.55 });
const shine = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.6 });

/** A rounded part of the dog: a sphere stretched to the shape it needs. */
function blob(material: Material, radius: number, scale: Vec3, position: Vec3): Mesh {
  const mesh = new Mesh(new SphereGeometry(radius, 40, 28), material);
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  mesh.castShadow = true;
  return mesh;
}

/** Everything that moves: the parts the animation reaches, and the dog as a whole. */
interface Dog {
  readonly root: Group;
  readonly torso: Mesh;
  readonly head: Group;
  readonly tongue: Mesh;
  readonly eyes: readonly Mesh[];
  readonly ears: readonly [Group, Group];
  readonly tail: Group;
}

/** A golden puppy, sitting, built from rounded parts. Facing the viewer, a little turned, so the tail can be seen. */
function buildDog(): Dog {
  const root = new Group();

  const torso = blob(fur, 1, [1, 1.25, 0.9], [0, 1.15, -0.1]);
  root.add(torso, blob(cream, 1, [0.6, 0.85, 0.5], [0, 1.1, 0.52]));
  for (const side of [-1, 1]) {
    root.add(
      blob(fur, 1, [0.55, 0.62, 0.85], [side * 0.82, 0.62, -0.2]), // haunch
      blob(cream, 0.3, [1.1, 0.6, 1.8], [side * 0.82, 0.15, 0.35]), // hind paw
      blob(cream, 0.24, [1.15, 0.65, 1.5], [side * 0.38, 0.14, 0.78]), // front paw
    );
    const leg = new Mesh(new CapsuleGeometry(0.2, 0.85, 8, 16), fur);
    leg.position.set(side * 0.38, 0.65, 0.62);
    leg.castShadow = true;
    root.add(leg);
  }

  const head = new Group();
  head.position.set(0, 2.6, 0.3);
  head.add(blob(fur, 0.74, [1, 0.95, 0.96], [0, 0, 0]), blob(cream, 0.36, [1.05, 0.78, 1.2], [0, -0.24, 0.6]), blob(noseMaterial, 0.12, [1.4, 0.95, 1], [0, -0.03, 0.96]));
  const tongue = blob(tongueMaterial, 0.14, [1, 0.01, 1.5], [0, -0.5, 0.78]);
  head.add(tongue);

  const eyes: Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = blob(eyeMaterial, 0.1, [1, 1.15, 0.7], [side * 0.28, 0.16, 0.66]);
    const glint = blob(shine, 0.035, [1, 1, 1], [0.03, 0.05, 0.07]);
    glint.castShadow = false;
    eye.add(glint);
    const brow = blob(furDark, 0.09, [1.6, 0.5, 1], [side * 0.28, 0.36, 0.64]);
    brow.rotation.z = side * -0.2;
    head.add(eye, brow);
    eyes.push(eye);
  }

  const ears = [-1, 1].map((side) => {
    const pivot = new Group();
    pivot.position.set(side * 0.55, 0.5, 0.05);
    pivot.rotation.z = side * 0.18;
    pivot.add(blob(furDark, 0.3, [0.4, 1.25, 0.8], [side * 0.14, -0.5, 0]));
    head.add(pivot);
    return pivot;
  }) as [Group, Group];

  const tail = new Group();
  tail.position.set(0, 0.55, -1);
  const tailMesh = new Mesh(new CapsuleGeometry(0.1, 0.9, 8, 16), fur);
  tailMesh.position.set(0, 0.35, -0.25);
  tailMesh.rotation.x = -1;
  tailMesh.castShadow = true;
  tail.add(tailMesh);
  root.add(head, tail);

  root.rotation.y = -0.35;
  return { root, torso, head, tongue, eyes, ears, tail };
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Puts a 3D puppy in `host`. It looks at the pointer wherever it is on the page, and when the pointer is over it, it wags its tail
 * harder, flaps its ears, shows its tongue and bounces; a click makes it jump. For a person who asked for less motion it is drawn
 * once, still. Throws when the browser cannot draw in 3D (the caller then shows a plain picture); returns what undoes everything.
 */
export function mountDog(host: HTMLElement): () => void {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 2.6, 9.5);
  camera.lookAt(0, 1.8, 0);

  scene.add(new HemisphereLight(0xffffff, 0xb7d7ea, 1.1));
  const sun = new DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(3.5, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -4;
  sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -2;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  const floor = new Mesh(new PlaneGeometry(14, 14), new ShadowMaterial({ opacity: 0.28 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const dog = buildDog();
  scene.add(dog.root);

  const still = reducedMotion();
  const clock = new Clock();
  let lookX = 0;
  let lookY = 0;
  let hovering = false;
  let excitement = 0;
  let jump = 0;
  let yaw = 0;
  let pitch = 0;

  const onMove = (event: PointerEvent) => {
    const box = host.getBoundingClientRect();
    lookX = MathUtils.clamp((event.clientX - (box.left + box.width / 2)) / (window.innerWidth * 0.5), -1, 1);
    lookY = MathUtils.clamp((event.clientY - (box.top + box.height * 0.3)) / (window.innerHeight * 0.5), -1, 1);
  };
  const onEnter = () => (hovering = true);
  const onLeave = () => (hovering = false);
  const onDown = () => (jump = 1);
  window.addEventListener('pointermove', onMove);
  host.addEventListener('pointerenter', onEnter);
  host.addEventListener('pointerleave', onLeave);
  host.addEventListener('pointerdown', onDown);

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = camera.aspect < 0.9 ? 12 : 9.5;
    camera.updateProjectionMatrix();
    if (still) renderer.render(scene, camera);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  function frame() {
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    excitement = MathUtils.damp(excitement, hovering ? 1 : 0, 6, dt);

    // The head follows the pointer, the body a little behind it.
    yaw = MathUtils.damp(yaw, lookX * 0.8, 7, dt);
    pitch = MathUtils.damp(pitch, lookY * 0.4, 7, dt);
    dog.head.rotation.y = yaw;
    dog.head.rotation.x = pitch;
    dog.head.rotation.z = MathUtils.damp(dog.head.rotation.z, -lookX * 0.12 + excitement * Math.sin(t * 5) * 0.05, 6, dt);
    dog.root.rotation.y = MathUtils.damp(dog.root.rotation.y, -0.35 + lookX * 0.3, 3, dt);

    // Breathing, the tail, the ears and the tongue: calm when ignored, lively when the pointer is over it.
    dog.torso.scale.y = 1.25 + Math.sin(t * 2) * 0.018;
    dog.tail.rotation.y = Math.sin(t * (4 + excitement * 12)) * (0.22 + excitement * 0.75);
    dog.ears[0].rotation.z = -0.18 + Math.sin(t * 2.4) * 0.03 - excitement * Math.abs(Math.sin(t * 9)) * 0.35;
    dog.ears[1].rotation.z = 0.18 + Math.sin(t * 2.4 + 1) * 0.03 + excitement * Math.abs(Math.sin(t * 9 + 1)) * 0.35;
    dog.tongue.scale.y = 0.01 + excitement * (0.32 + Math.abs(Math.sin(t * 7)) * 0.06);

    // A blink every few seconds.
    const phase = t % 3.6;
    const blink = phase > 3.45 ? Math.sin(((phase - 3.45) / 0.15) * Math.PI) : 0;
    for (const eye of dog.eyes) eye.scale.y = 1.15 * (1 - 0.92 * blink);

    // A click makes it jump.
    jump = Math.max(0, jump - dt * 2.2);
    dog.root.position.y = Math.sin(jump * Math.PI) * 0.55 + excitement * Math.abs(Math.sin(t * 6)) * 0.07;

    renderer.render(scene, camera);
  }
  if (!still) renderer.setAnimationLoop(frame);

  return () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('pointermove', onMove);
    host.removeEventListener('pointerenter', onEnter);
    host.removeEventListener('pointerleave', onLeave);
    host.removeEventListener('pointerdown', onDown);
    observer.disconnect();
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  };
}
