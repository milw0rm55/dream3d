/**
 * Turntable — fake 3D from per-side photos (front/right/back/left).
 * Cards: cursor position picks the side + slight tilt. Detail: drag to rotate.
 */
const Turntable = (() => {
  const SLOTS = ['front', 'right', 'back', 'left'];
  const ANGLE = { front: 0, right: 90, back: 180, left: 270 };
  const LABEL = { front: 'frente', right: 'derecha', back: 'espalda', left: 'izquierda' };

  const finePointer  = matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function frames(p) {
    return SLOTS.filter(s => p.media && p.media[s]);
  }

  function hasStl(p) {
    return !!(p.media && p.media.stl);
  }

  function framesHtml(p, eager = false) {
    const list = frames(p);
    const first = list.includes('front') ? 'front' : list[0];
    return list.map(s => `<img class="frame${s === first ? ' is-active' : ''}" data-slot="${s}" src="${esc(p.media[s])}"
      alt="${s === first ? esc(p.name) + ', ' + LABEL[s] : ''}" ${eager ? '' : 'loading="lazy"'} decoding="async" draggable="false">`).join('');
  }

  // small static thumbnail for cart / mobile
  function thumbHtml(p) {
    const list = frames(p);
    if (!list.length) return p.svg || '';
    const slot = list.includes('front') ? 'front' : list[0];
    return `<img class="thumb-photo" src="${esc(p.media[slot])}" alt="${esc(p.name)}" loading="lazy" decoding="async">`;
  }

  function nearest(list, angle) {
    const a = ((angle % 360) + 360) % 360;
    let best = list[0], bestD = Infinity;
    for (const s of list) {
      const d = Math.abs(((a - ANGLE[s] + 540) % 360) - 180);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  function show(root, slot) {
    root.querySelectorAll('.frame').forEach(f => f.classList.toggle('is-active', f.dataset.slot === slot));
    root.dispatchEvent(new CustomEvent('turntable:slot', { detail: slot, bubbles: true }));
  }

  // card hover: cursor x sweeps 360° (center = front), plus tilt for depth
  function bindHover(card, art) {
    const list = [...art.querySelectorAll('.frame')].map(f => f.dataset.slot);
    const rest = list.includes('front') ? 'front' : list[0];
    let raf = 0, px = 0.5, py = 0.5;

    const apply = () => {
      raf = 0;
      if (list.length > 1) show(art, nearest(list, (px - 0.5) * 360));
      if (!reduceMotion.matches) {
        art.style.transform =
          `perspective(900px) rotateY(${((px - 0.5) * 14).toFixed(2)}deg) rotateX(${((0.5 - py) * 8).toFixed(2)}deg) scale(1.04)`;
      }
    };

    card.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !finePointer.matches) return;
      const r = card.getBoundingClientRect();
      px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      if (!raf) raf = requestAnimationFrame(apply);
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      raf = 0;
      art.style.transform = '';
      if (rest) show(art, rest);
    });
  }

  // detail stage: drag (mouse or touch) to rotate; returns setter for thumbnails
  function bindDrag(stage) {
    const list = [...stage.querySelectorAll('.frame')].map(f => f.dataset.slot);
    let angle = 0, startX = 0, startAngle = 0, dragging = false;

    const set = a => { angle = a; show(stage, nearest(list, angle)); };

    if (list.length > 1) {
      stage.addEventListener('pointerdown', e => {
        dragging = true;
        startX = e.clientX;
        startAngle = angle;
        stage.setPointerCapture(e.pointerId);
        stage.classList.add('is-dragging');
      });
      stage.addEventListener('pointermove', e => {
        if (!dragging) return;
        // full turn over ~1.2x the stage width
        set(startAngle - (e.clientX - startX) / (stage.clientWidth * 1.2) * 360);
      });
      const end = () => { dragging = false; stage.classList.remove('is-dragging'); };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
    }
    set(list.includes('front') ? 0 : ANGLE[list[0]] || 0);
    return slot => set(ANGLE[slot]);
  }

  return { SLOTS, LABEL, frames, hasStl, framesHtml, thumbHtml, bindHover, bindDrag, esc };
})();
