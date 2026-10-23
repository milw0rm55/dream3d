/**
 * Blobatar — generador determinístico de avatares blob SVG.
 * Mismo seed = mismo blob, siempre.
 */
const Blobatar = (() => {

  // hash simple pero suficiente para seed determinístico
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  // PRNG seeded
  function seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // genera puntos blob alrededor de un círculo con variaciones suaves
  function blobPoints(rand, cx, cy, r, count = 8) {
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const variance = 0.35 + rand() * 0.3; // 35–65% variación
      const radius = r * variance + r * (1 - variance);
      points.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    }
    return points;
  }

  function luminance(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
  }

  // convierte puntos en path bezier suave (catmull-rom → cúbica)
  function smoothPath(pts) {
    const n = pts.length;
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d + ' Z';
  }

  /**
   * Genera un SVG string de blobatar.
   * @param {string} seed  — username, email, o cualquier string
   * @param {string[]} palette — array de colores hex (desde config)
   * @param {number} size — tamaño en px del viewBox (default 100)
   */
  function generate(seed, palette, size = 100) {
    const h   = hash(seed || 'anon');
    const rand = seededRandom(h);

    // color de fondo y de silueta interior
    const bgColor   = palette[h % palette.length];
    const fgColor   = palette[(h + 3) % palette.length];

    const cx = size / 2, cy = size / 2;
    const r  = size * 0.38;

    // blob exterior (cuerpo)
    const outerPts = blobPoints(rand, cx, cy, r, 8);
    // blob interior (detalle sutil)
    const innerR   = r * 0.55;
    const innerPts = blobPoints(rand, cx, cy - size * 0.04, innerR, 6);

    // "ojos" — dos círculos pequeños
    const eyeY  = cy - r * 0.12;
    const eyeOff = r * 0.28;
    const eyeR  = r * 0.09;

    const initials = (seed || '?').slice(0, 2).toUpperCase();
    const markColor = luminance(bgColor) > 0.45 ? '#0A0A0A' : '#FFFFFF';

    return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="${smoothPath(outerPts)}" fill="${bgColor}"/>
  <path d="${smoothPath(innerPts)}" fill="${fgColor}" opacity="0.25"/>
  <circle cx="${(cx - eyeOff).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${eyeR.toFixed(1)}" fill="${markColor}" opacity="0.8"/>
  <circle cx="${(cx + eyeOff).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${eyeR.toFixed(1)}" fill="${markColor}" opacity="0.8"/>
  <text x="${cx}" y="${(cy + r * 0.38).toFixed(1)}" text-anchor="middle" dominant-baseline="middle"
    font-family="Work Sans, sans-serif" font-weight="600" font-size="${(r * 0.42).toFixed(1)}"
    fill="${markColor}" opacity="0.75">${initials}</text>
</svg>`;
  }

  return { generate };
})();
