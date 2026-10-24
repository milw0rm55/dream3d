import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function parseStl(buffer) {
  return new STLLoader().parse(buffer);
}

export async function loadStl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo cargar el modelo');
  return parseStl(await res.arrayBuffer());
}

// signed tetrahedron volume per triangle; STL units are mm
export function measure(geometry) {
  const pos = geometry.getAttribute('position');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), t = new THREE.Vector3();
  let vol = 0;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    vol += a.dot(t.crossVectors(b, c)) / 6;
  }
  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  geometry.boundingBox.getSize(size);
  return {
    volumeCm3: Math.abs(vol) / 1000,
    size: { x: size.x, y: size.y, z: size.z },
    triangles: pos.count / 3,
  };
}

export function mountViewer(container, geometry, { color = '#9C9A94' } = {}) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6a66, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(1.2, 2, 1.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-1.5, 0.5, -1.2);
  scene.add(rim);

  const geo = geometry.clone();
  geo.center();
  // some exporters write zero normals; derive them from triangle winding instead
  geo.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setStyle(color), roughness: 0.55, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2; // STL is Z-up, three.js is Y-up
  scene.add(mesh);

  geo.computeBoundingSphere();
  const radius = geo.boundingSphere.radius || 1;
  const camera = new THREE.PerspectiveCamera(35, 1, radius / 100, radius * 100);
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(35 / 2)) * 1.1;
  camera.position.set(dist * 0.55, dist * 0.35, dist * 0.75);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = radius * 1.2;
  controls.maxDistance = radius * 8;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 1.6;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    ro.disconnect();
    controls.dispose();
    geo.dispose();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  renderer.setAnimationLoop(() => {
    // SPA swaps innerHTML; stop rendering once our canvas leaves the page
    if (!renderer.domElement.isConnected) return dispose();
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    setColor(css) { material.color.setStyle(css); },
    dispose,
  };
}
