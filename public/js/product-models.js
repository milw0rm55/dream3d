/**
 * Stand-in turntable frames for catalogue products that don't have real photos yet:
 * a simple 3D version of each figure rendered from front/right/back/left.
 * Real photos uploaded in the admin always take priority.
 */
import * as THREE from 'three';

const mat = (color, rough = 0.55) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });

function add(group, geometry, color, [x, y, z], rot) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  group.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ball = (r, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 40, 28); g.scale(sx, sy, sz); return g; };

// every figure faces +Z; +X is the viewer's right when looking at the front
const MODELS = {
  knight() {
    const g = new THREE.Group();
    add(g, box(0.28, 0.75, 0.3), '#6EA000', [-0.2, 0.38, 0]);
    add(g, box(0.28, 0.75, 0.3), '#6EA000', [0.2, 0.38, 0]);
    add(g, box(0.85, 0.95, 0.5), '#A8D80E', [0, 1.22, 0]);
    add(g, box(0.24, 0.8, 0.26), '#C8D800', [-0.58, 1.25, 0]);
    add(g, box(0.24, 0.8, 0.26), '#C8D800', [0.58, 1.25, 0]);
    add(g, ball(0.38), '#DFEB1E', [0, 2.02, 0]);
    add(g, box(0.42, 0.07, 0.06), '#0B1300', [0, 2.06, 0.36]);                 // visor (front)
    add(g, box(0.75, 1.15, 0.05), '#E03030', [0, 1.15, -0.29]);                // cape (back)
    add(g, box(0.07, 1.1, 0.07), '#C9C6BD', [0.62, 1.5, 0.28]);                // sword (right)
    add(g, box(0.32, 0.06, 0.12), '#0B1300', [0.62, 1.0, 0.28]);
    add(g, new THREE.CylinderGeometry(0.36, 0.36, 0.08, 36), '#1E4FEB', [-0.8, 1.25, 0], [0, 0, Math.PI / 2]); // shield (left)
    return g;
  },

  rocket() {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.42, 0.42, 1.5, 40), '#1E4FEB', [0, 1.05, 0]);
    add(g, new THREE.ConeGeometry(0.42, 0.75, 40), '#3B6FFF', [0, 2.17, 0]);
    add(g, new THREE.CylinderGeometry(0.2, 0.28, 0.22, 32), '#DFEB1E', [0, 0.2, 0]);
    add(g, ball(0.16, 1, 1, 0.45), '#E8F5FF', [0, 1.45, 0.39]);                // window (front)
    add(g, box(0.06, 0.9, 0.3), '#DFEB1E', [0.43, 1.05, 0]);                   // stripe (right)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI;                               // no fin on the front
      const fin = add(g, box(0.06, 0.55, 0.45), '#1E4FEB', [Math.sin(a) * 0.48, 0.5, Math.cos(a) * 0.48]);
      fin.rotation.y = a;
    }
    return g;
  },

  dragon() {
    const g = new THREE.Group();
    add(g, ball(0.55, 1, 0.8, 1.25), '#A8D80E', [0, 0.75, 0]);
    add(g, ball(0.42, 0.9, 0.75, 0.6), '#DFEB1E', [0, 0.72, 0.38]);            // belly (front)
    add(g, ball(0.3, 1, 0.9, 1.15), '#A8D80E', [0, 1.45, 0.45]);               // head
    add(g, ball(0.05), '#0B1300', [-0.13, 1.55, 0.75]);
    add(g, ball(0.05), '#0B1300', [0.13, 1.55, 0.75]);
    add(g, new THREE.ConeGeometry(0.06, 0.28, 16), '#6EA000', [-0.15, 1.75, 0.35], [-0.4, 0, 0]);
    add(g, new THREE.ConeGeometry(0.06, 0.28, 16), '#6EA000', [0.15, 1.75, 0.35], [-0.4, 0, 0]);
    add(g, box(0.9, 0.05, 0.6), '#6EA000', [-0.75, 1.15, -0.05], [0, 0, 0.45]); // wings
    add(g, box(0.9, 0.05, 0.6), '#6EA000', [0.75, 1.15, -0.05], [0, 0, -0.45]);
    add(g, new THREE.ConeGeometry(0.16, 1.0, 20), '#A8D80E', [0.15, 0.45, -0.95], [-1.25, 0, -0.3]); // tail (back)
    add(g, ball(0.16, 1, 1.4, 1), '#6EA000', [-0.3, 0.2, 0.15]);
    add(g, ball(0.16, 1, 1.4, 1), '#6EA000', [0.3, 0.2, 0.15]);
    return g;
  },

  cat() {
    const g = new THREE.Group();
    add(g, ball(0.5, 1, 1.1, 0.9), '#E8C4FF', [0, 0.6, 0]);
    add(g, ball(0.42), '#E8C4FF', [0, 1.45, 0.05]);
    add(g, new THREE.ConeGeometry(0.13, 0.3, 24), '#D4A0FF', [-0.24, 1.82, 0.02], [0, 0, 0.3]);
    add(g, new THREE.ConeGeometry(0.13, 0.3, 24), '#D4A0FF', [0.24, 1.82, 0.02], [0, 0, -0.3]);
    add(g, ball(0.055), '#0B1300', [-0.15, 1.5, 0.42]);                        // face (front)
    add(g, ball(0.055), '#0B1300', [0.15, 1.5, 0.42]);
    add(g, ball(0.04), '#D4A0FF', [0, 1.38, 0.45]);
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 14, 40, Math.PI * 1.2), mat('#D4A0FF'));
    tail.position.set(0.25, 0.75, -0.42);                                      // tail (back, to the right)
    tail.rotation.set(0, Math.PI / 2, 0);
    g.add(tail);
    return g;
  },

  creeper() {
    const g = new THREE.Group();
    for (const [x, z] of [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2], [0.2, -0.2]]) add(g, box(0.36, 0.45, 0.36), '#6EA000', [x, 0.23, z]);
    add(g, box(0.6, 1.0, 0.4), '#A8D80E', [0, 0.95, 0]);
    add(g, box(0.8, 0.8, 0.8), '#6EA000', [0, 1.85, 0]);
    add(g, box(0.18, 0.18, 0.02), '#0B1300', [-0.18, 1.95, 0.41]);             // face (front only)
    add(g, box(0.18, 0.18, 0.02), '#0B1300', [0.18, 1.95, 0.41]);
    add(g, box(0.16, 0.3, 0.02), '#0B1300', [0, 1.7, 0.41]);
    add(g, box(0.1, 0.18, 0.02), '#0B1300', [-0.12, 1.62, 0.41]);
    add(g, box(0.1, 0.18, 0.02), '#0B1300', [0.12, 1.62, 0.41]);
    return g;
  },
};

export function hasModel(name) {
  return !!MODELS[name];
}

export function renderTurntables(products, size = 640) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a877f, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(2, 4, 3);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // fixed camera and light, rotating figure: same as photographing on a turntable
  const ROT = { front: 0, right: -Math.PI / 2, back: Math.PI, left: Math.PI / 2 };
  const out = [];

  for (const p of products) {
    const figure = MODELS[p.model]();
    const bbox = new THREE.Box3().setFromObject(figure);
    const size3 = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    figure.position.set(-center.x, -bbox.min.y, -center.z);
    const pivot = new THREE.Group();
    pivot.add(figure);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(Math.max(size3.x, size3.z) * 0.55, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    pivot.add(shadow);
    scene.add(pivot);

    const radius = Math.max(size3.y, Math.hypot(size3.x, size3.z)) / 2;
    const dist = radius / Math.tan(THREE.MathUtils.degToRad(15)) * 1.35;
    camera.position.set(0, size3.y * 0.62, dist);
    camera.lookAt(0, size3.y * 0.48, 0);

    const frames = {};
    for (const [slot, rot] of Object.entries(ROT)) {
      pivot.rotation.y = rot;
      renderer.render(scene, camera);
      frames[slot] = renderer.domElement.toDataURL('image/webp', 0.85);
    }
    out.push({ product: p, frames });

    scene.remove(pivot);
    pivot.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }

  renderer.dispose();
  return out;
}
