const Admin = (() => {
  let _pass = '';
  let _products = [];
  let _orders = [];
  let _orderFilter = 'all';
  let _chartWeekly, _chartStatus, _chartTags;

  // ── auth ──────────────────────────────────────────────
  function login() {
    const pass = document.getElementById('loginPass').value.trim();
    if (!pass) return;
    fetch('/api/admin/metrics', { headers: { 'x-admin-pass': pass } })
      .then(r => {
        if (!r.ok) throw new Error('wrong');
        _pass = pass;
        return r.json();
      })
      .then(metrics => {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-app').style.display  = 'grid';
        _initDashboard(metrics);
        _loadProducts();
        _loadOrders();
        _loadReviews();
        _loadMessages();
        _loadStats();
      })
      .catch(() => {
        document.getElementById('loginErr').textContent = 'Contraseña incorrecta.';
      });
  }

  function logout() {
    _pass = '';
    document.getElementById('admin-login').style.display = 'flex';
    document.getElementById('admin-app').style.display   = 'none';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginErr').textContent = '';
  }

  // ── navigation ────────────────────────────────────────
  function nav(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('section-' + section).classList.add('active');
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    if (section === 'reviews') _loadReviews();
    if (section === 'messages') _loadMessages();
    if (section === 'site') _loadSite();
    if (section === 'dashboard') _loadStats();
  }

  // ── api helpers ───────────────────────────────────────
  function api(method, url, body) {
    return fetch(url, {
      method,
      headers: { 'x-admin-pass': _pass, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async r => {
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || `Error ${r.status}`);
      return json;
    });
  }

  // ── DASHBOARD ─────────────────────────────────────────
  let _metrics = null;

  // chart.js draws on canvas, so it needs the resolved theme colours
  function _themeColors() {
    const css = getComputedStyle(document.documentElement);
    const v = name => css.getPropertyValue(name).trim();
    const mix = (a, b, t) => {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
      return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
    };
    return {
      ink: v('--ink'), muted: v('--text-muted'), line: v('--line'), surface: v('--surface'),
      strong: v('--accent-strong'), mid: mix(v('--text-muted'), v('--ink'), 0.5),
    };
  }
  ThemeMode.onChange(() => { if (_metrics) _initDashboard(_metrics); _renderStats(); });

  function _initDashboard(m) {
    _metrics = m;
    const t = _themeColors();
    document.getElementById('statRow').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Ingresos totales</div>
        <div class="stat-value">${money(m.totalRevenue)}</div>
        <div class="stat-sub">Solo pedidos pagados</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total pedidos</div>
        <div class="stat-value">${m.totalOrders}</div>
        <div class="stat-sub">${m.byStatus.pendiente} pendientes · ${m.byStatus.preparando} preparando</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Productos activos</div>
        <div class="stat-value green">${m.activeProducts}</div>
        <div class="stat-sub">En catálogo</div>
      </div>`;

    Chart.defaults.color = t.muted;
    Chart.defaults.borderColor = t.line;
    Chart.defaults.font.family = "'Work Sans', system-ui, sans-serif";

    // weekly revenue bar chart
    const wCtx = document.getElementById('chartWeekly').getContext('2d');
    if (_chartWeekly) _chartWeekly.destroy();
    _chartWeekly = new Chart(wCtx, {
      type: 'bar',
      data: {
        labels: m.weeklyRevenue.map(w => w.label),
        datasets: [{ label: 'Ingresos (€)', data: m.weeklyRevenue.map(w => w.revenue), backgroundColor: t.ink, borderRadius: 4 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });

    // status donut
    const sCtx = document.getElementById('chartStatus').getContext('2d');
    if (_chartStatus) _chartStatus.destroy();
    const statusLabels = ['Pendiente','Preparando','En camino','Entregado'];
    const statusData   = [m.byStatus.pendiente, m.byStatus.preparando, m.byStatus['en-camino'], m.byStatus.entregado];
    _chartStatus = new Chart(sCtx, {
      type: 'doughnut',
      data: {
        labels: statusLabels,
        datasets: [{ data: statusData, backgroundColor: [t.strong, t.muted, t.mid, t.ink], borderColor: t.surface, borderWidth: 2 }],
      },
      options: { plugins: { legend: { position: 'bottom' } } },
    });

    // tags bar chart
    const tCtx = document.getElementById('chartTags').getContext('2d');
    if (_chartTags) _chartTags.destroy();
    const tagKeys = Object.keys(m.byTag);
    const tagVals = tagKeys.map(k => m.byTag[k]);
    _chartTags = new Chart(tCtx, {
      type: 'bar',
      data: {
        labels: tagKeys,
        datasets: [{ label: 'Ingresos (€)', data: tagVals, backgroundColor: t.mid, borderRadius: 4 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } }, indexAxis: 'y' },
    });
  }

  // ── PRODUCTS ──────────────────────────────────────────
  const SLOTS = ['front', 'right', 'back', 'left'];
  const SLOT_LABEL = { front: 'Frente', right: 'Derecha', back: 'Espalda', left: 'Izquierda' };
  const CALC_KEYS = ['hours', 'minutes', 'weightG', 'infillPct', 'material', 'spoolPrice', 'spoolWeight', 'wastePct',
    'powerW', 'kwhPrice', 'prepMin', 'postMin', 'laborRate', 'printerCost', 'paybackYears', 'dailyHours',
    'repairPct', 'shipCost', 'cardFeePct', 'cardFeeFixed', 'profitPct', 'vatPct', 'roundTo'];
  const DEFAULT_KEYS = CALC_KEYS.filter(k => !['hours', 'minutes', 'weightG'].includes(k));
  const SHELL_FRACTION = 0.4; // walls + top/bottom share of a small figure's volume
  const MAX_STL_B = 200 * 1024 * 1024;

  let _media = {};          // slot -> { url, blob, preview, removed }
  let _stl = {};            // { url, file, removed, geometry, stats }
  let _stlViewer = null;
  let _pricingDefaults = null;
  let _calc = {};
  let _autoPrice = null;    // last suggested price written into the price box; a value the user typed differs and stays
  let _otherCosts = [];
  let _modalBound = false;
  const DRAFT_KEY = 'dream3d-admin-draft';
  const DRAFT_FIELDS = ['mName', 'mTag', 'mPrice', 'mStock', 'mDesc', 'mNotes'];
  // storage can throw in private windows: a draft is a convenience, never a reason to fail
  const draftStore = {
    get() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(v)); } catch (e) { /* no draft */ } },
    clear() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* nothing to clear */ } },
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  const num = (n, d = 1) => Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: d });
  const $ = id => document.getElementById(id);
  const setStatus = msg => { $('modalStatus').textContent = msg || ''; };

  function _loadProducts() {
    return api('GET', '/api/admin/products').then(data => {
      _products = data;
      _renderProducts();
    });
  }

  function _renderProducts() {
    document.getElementById('productsBody').innerHTML = _products.map(p => {
      const photos = SLOTS.filter(s => p.media && p.media[s]).length;
      const thumb = p.media && p.media.front
        ? `<img class="row-thumb" src="${esc(p.media.front)}" alt="">`
        : '<span class="row-thumb"></span>';
      return `
      <tr>
        <td>${p.id}</td>
        <td><div class="row-name">${thumb}<div><strong>${esc(p.name)}</strong>
          <div class="row-badges">${photos ? `<span>${photos}/4 fotos</span>` : ''}${p.media && p.media.stl ? '<span>STL</span>' : ''}</div></div></div></td>
        <td><span class="tag-pill">${p.tag}</span></td>
        <td>${p.price > 0 ? money(p.price) : '<em>A consultar</em>'}</td>
        <td>${p.stock > 0 ? p.stock : '<em>0 · bajo pedido</em>'}</td>
        <td class="notes-cell">${p.notes ? `<span class="notes-text" title="${p.notes.replace(/"/g,'&quot;')}">${p.notes.slice(0,40)}${p.notes.length>40?'…':''}</span>` : '<span style="color:var(--border)">—</span>'}</td>
        <td><span class="${p.active ? 'active-dot' : 'inactive-dot'}"></span>${p.active ? '' : ' <em>borrador</em>'}</td>
        <td>
          <div class="table-actions">
            <button class="btn-sm" onclick="Admin.openProductModal(${p.id})">Editar</button>
            <button class="btn-sm danger" onclick="Admin.deleteProduct(${p.id})">Eliminar</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  async function openProductModal(id) {
    const p = id ? _products.find(x => x.id === id) : null;
    _bindModalOnce();
    $('modalTitle').textContent = p ? 'Editar producto' : 'Nuevo producto';
    $('modalId').value  = p ? p.id : '';
    $('mName').value    = p ? p.name : '';
    $('mTag').value     = p ? p.tag : 'Regalos';
    $('mPrice').value   = p ? p.price : '';
    $('mStock').value   = p ? p.stock : '';
    $('mDesc').value    = p ? p.desc : '';
    $('mNotes').value   = p ? (p.notes || '') : '';
    setStatus('');
    _autoPrice = p ? null : '';
    if (!p) _restoreDraft();
    $('gcodeInfo').textContent = '';
    $('stlEstimateInfo').textContent = '';

    _releaseMedia();
    _media = {};
    SLOTS.forEach(s => { _media[s] = { url: (p && p.media && p.media[s]) || null }; });
    _stl = { url: (p && p.media && p.media.stl) || null };
    _renderMediaGrid();
    _renderStlBox();

    try {
      if (!_pricingDefaults) _pricingDefaults = await api('GET', '/api/admin/pricing');
    } catch (e) { _pricingDefaults = { densities: { PLA: 1.24 } }; }
    const saved = (p && p.pricing && p.pricing.inputs) || {};
    _calc = { hours: 0, minutes: 0, weightG: 0 };
    CALC_KEYS.forEach(k => { if (k in _pricingDefaults) _calc[k] = _pricingDefaults[k]; });
    Object.assign(_calc, saved);
    _otherCosts = (saved.otherCosts || []).map(o => ({ ...o }));
    _fillCalc();
    _renderOtherCosts();
    _renderCalc();

    modalTab('data');
    $('productModal').style.display = 'flex';
  }

  // a new product is kept until saved: closing the modal by mistake (outside it, or the X) loses nothing
  function _saveDraft() {
    if ($('modalId').value) return;
    const d = {};
    DRAFT_FIELDS.forEach(id => { d[id] = $(id).value; });
    draftStore.set(d);
  }

  function _restoreDraft() {
    const d = draftStore.get();
    if (!d) return;
    DRAFT_FIELDS.forEach(id => { if (id in d) $(id).value = d[id]; });
    setStatus('Recuperado el borrador del producto que no llegaste a guardar.');
  }

  function closeModal() {
    $('productModal').style.display = 'none';
    _releaseMedia();
  }

  function modalTab(name) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.modal-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
    if (name === 'media' || name === 'price') _ensureStlLoaded();
    if (name === 'media') _postPreview();
  }

  function _bindModalOnce() {
    if (_modalBound) return;
    _modalBound = true;

    document.querySelectorAll('#calcInputs [data-k]').forEach(el => {
      el.addEventListener('input', () => {
        _calc[el.dataset.k] = el.type === 'number' ? (Number(el.value) || 0) : el.value;
        _renderCalc();
      });
    });
    $('mPrice').addEventListener('input', _renderCalc);
    DRAFT_FIELDS.forEach(id => $(id).addEventListener('input', _saveDraft));
    $('gcodeInput').addEventListener('change', e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) _readGcode(f).catch(err => { $('gcodeInfo').textContent = `No se pudo leer ${f.name}: ${err.message}`; });
    });
    $('stlInput').addEventListener('change', e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) _onStlFile(f);
    });
  }

  function _releaseMedia() {
    Object.values(_media).forEach(m => { if (m.preview) URL.revokeObjectURL(m.preview); });
    _disposeStlViewer();
  }

  // ── product photos ─────────────────────────────────────
  function _renderMediaGrid() {
    const grid = $('mediaGrid');
    grid.innerHTML = SLOTS.map(s => {
      const m = _media[s];
      const src = m.preview || (!m.removed && m.url) || '';
      return `
        <div class="media-slot${src ? ' has-img' : ''}" data-slot="${s}">
          <label class="media-drop" title="Elige o arrastra una foto">
            ${src ? `<img src="${esc(src)}" alt="${SLOT_LABEL[s]}">` : '<span class="media-plus">+</span><span class="media-cta">foto</span>'}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden>
          </label>
          <div class="media-foot">
            <span>${SLOT_LABEL[s]}${m.blob ? ' · nueva' : ''}</span>
            ${src ? `<button type="button" class="btn-sm danger" data-remove="${s}">Quitar</button>` : ''}
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.media-slot').forEach(slotEl => {
      const slot = slotEl.dataset.slot;
      const drop = slotEl.querySelector('.media-drop');
      slotEl.querySelector('input').addEventListener('change', e => {
        if (e.target.files[0]) _setPhoto(slot, e.target.files[0]);
      });
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
      drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.classList.remove('is-over');
        if (e.dataTransfer.files[0]) _setPhoto(slot, e.dataTransfer.files[0]);
      });
    });
    grid.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
      const m = _media[b.dataset.remove];
      if (m.preview) URL.revokeObjectURL(m.preview);
      _media[b.dataset.remove] = { url: m.url, removed: !!m.url };
      _renderMediaGrid();
    }));
    _postPreview();
  }

  // send current (also unsaved) photos to the turntable preview iframe
  function _postPreview() {
    const frame = $('turntablePreview');
    if (!frame || !frame.contentWindow) return;
    const frames = {};
    SLOTS.forEach(s => {
      const m = _media[s] || {};
      const src = m.preview || (!m.removed && m.url);
      if (src) frames[s] = src;
    });
    frame.contentWindow.postMessage({
      type: 'turntable-frames',
      name: $('mName').value.trim() || 'Tu producto',
      price: Number($('mPrice').value) || 0,
      frames,
    }, location.origin);
  }
  window.addEventListener('message', e => {
    if (e.origin === location.origin && e.data && e.data.type === 'turntable-preview-ready') _postPreview();
  });

  async function _setPhoto(slot, file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setStatus('Formato no compatible: usa JPG, PNG o WebP (las fotos HEIC del iPhone hay que exportarlas como JPG).');
      return;
    }
    setStatus('Procesando foto…');
    try {
      const blob = await _shrinkImage(file, 1600);
      const prev = _media[slot];
      if (prev.preview) URL.revokeObjectURL(prev.preview);
      _media[slot] = { url: prev.url, blob, preview: URL.createObjectURL(blob), removed: false };
      setStatus('');
      _renderMediaGrid();
    } catch (e) {
      setStatus('No se pudo leer la imagen.');
    }
  }

  async function _shrinkImage(file, maxSide) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const toBlob = (type, q) => new Promise(r => canvas.toBlob(r, type, q));
    let blob = await toBlob('image/webp', 0.86);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.88);
    if (!blob) throw new Error('encode');
    return blob;
  }

  // ── STL ────────────────────────────────────────────────
  const _stlModule = () => import('/js/stl-viewer.js');

  async function _onStlFile(file) {
    if (file.size > MAX_STL_B) { setStatus('El STL supera 200 MB.'); return; }
    setStatus('Leyendo STL…');
    try {
      const mod = await _stlModule();
      const geometry = mod.parseStl(await file.arrayBuffer());
      const pos = geometry.getAttribute('position');
      if (!pos || !pos.count) throw new Error('empty');
      _disposeStlViewer();
      _stl = { url: _stl.url, file, removed: false, geometry, stats: mod.measure(geometry) };
      setStatus('');
      _renderStlBox();
    } catch (e) {
      setStatus('No se pudo leer el archivo: ¿es un STL válido?');
    }
  }

  async function _ensureStlLoaded() {
    if (!_stl.url || _stl.removed || _stl.geometry || _stl.loading) return;
    _stl.loading = true;
    const target = _stl;
    try {
      const mod = await _stlModule();
      const geometry = await mod.loadStl(target.url);
      if (_stl !== target) return;
      Object.assign(_stl, { geometry, stats: mod.measure(geometry) });
      _renderStlBox();
    } catch (e) {
      if (_stl === target) $('stlInfo').textContent = 'No se pudo cargar el STL guardado.';
    } finally {
      target.loading = false;
    }
  }

  function _disposeStlViewer() {
    if (_stlViewer) { _stlViewer.dispose(); _stlViewer = null; }
  }

  async function _renderStlBox() {
    const has = (_stl.file || (_stl.url && !_stl.removed));
    $('stlRemove').hidden = !has;
    $('stlEstimateRow').hidden = !_stl.stats;
    const preview = $('stlPreview');
    const info = $('stlInfo');
    if (!has) {
      _disposeStlViewer();
      preview.innerHTML = '<p>Sin modelo</p>';
      info.textContent = '';
      return;
    }
    if (!_stl.geometry) {
      preview.innerHTML = '<p>Cargando modelo…</p>';
      info.textContent = _stl.file ? _stl.file.name : '';
      return;
    }
    const s = _stl.stats;
    info.textContent = `${_stl.file ? _stl.file.name + ' · ' : ''}Volumen ${num(s.volumeCm3)} cm³ · ${num(s.size.x, 0)} × ${num(s.size.y, 0)} × ${num(s.size.z, 0)} mm · ${num(s.triangles, 0)} triángulos`;
    if (_stlViewer) return;
    preview.innerHTML = '';
    const mod = await _stlModule();
    if (!_stl.geometry || _stlViewer) return;
    _stlViewer = mod.mountViewer(preview, _stl.geometry, { color: '#9C9A94' });
  }

  function removeStl() {
    _disposeStlViewer();
    _stl = { url: _stl.url, removed: !!_stl.url };
    _renderStlBox();
  }

  // ── PRICE CALCULATOR (Prusa-style cost blocks + profit) ─
  function _fillCalc() {
    const sel = $('calcMaterial');
    sel.innerHTML = Object.keys(_pricingDefaults.densities || { PLA: 1.24 })
      .map(m => `<option${m === _calc.material ? ' selected' : ''}>${esc(m)}</option>`).join('');
    document.querySelectorAll('#calcInputs [data-k]').forEach(el => {
      const v = _calc[el.dataset.k];
      if (v !== undefined) el.value = v;
    });
  }

  function _renderOtherCosts() {
    $('otherCosts').innerHTML = _otherCosts.map((o, i) => `
      <div class="calc-row other-row">
        <input type="text" data-i="${i}" data-f="name" placeholder="Concepto (embalaje, pintura…)" value="${esc(o.name)}">
        <span class="unit"><input type="number" min="0" step="0.01" data-i="${i}" data-f="value" value="${Number(o.value) || ''}"> €</span>
        <button class="btn-sm danger" type="button" data-del="${i}" aria-label="Quitar línea">✕</button>
      </div>`).join('');
    $('otherCosts').querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
      const o = _otherCosts[inp.dataset.i];
      o[inp.dataset.f] = inp.dataset.f === 'value' ? (Number(inp.value) || 0) : inp.value;
      _renderCalc();
    }));
    $('otherCosts').querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      _otherCosts.splice(Number(b.dataset.del), 1);
      _renderOtherCosts();
      _renderCalc();
    }));
  }

  function addOtherCost() {
    _otherCosts.push({ name: '', value: 0 });
    _renderOtherCosts();
    _renderCalc();
  }

  function _renderCalc() {
    const r = PricingCalc.computePrice(_calc, _otherCosts);
    if ($('mPrice').value === _autoPrice) { $('mPrice').value = r.rounded || ''; _autoPrice = $('mPrice').value; }
    const current = Number($('mPrice').value) || 0;
    const margin = current > 0 ? PricingCalc.margin(current, _calc, r) : null;
    const row = (label, v, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${money(v)}</td></tr>`;
    $('calcResult').innerHTML = `
      <p class="calc-label">Precio sugerido</p>
      <p class="calc-big">${money(r.rounded)}</p>
      <p class="calc-note">${r.final ? `sin redondear ${money(r.final)}` : 'Introduce el tiempo y el peso para calcular.'}</p>
      <table class="calc-table">
        ${row('Filamento', r.filament)}
        ${row('Electricidad', r.electricity)}
        ${row('Mano de obra', r.labor)}
        ${row(`Máquina (${num(r.hours)} h)`, r.machine)}
        ${r.other ? row('Otros', r.other) : ''}
        ${r.shipping ? row('Envío (gratis para el cliente)', r.shipping) : ''}
        ${row('Coste total', r.cost, 'sum')}
        ${row(`Ganancia ${num(_calc.profitPct, 0)}%`, r.profit)}
        ${r.fee ? row('Comisión tarjeta', r.fee) : ''}
        ${Number(_calc.vatPct) ? row(`IVA ${num(_calc.vatPct, 0)}%`, r.vat) : ''}
        ${row('Precio final', r.final, 'sum')}
      </table>
      <div class="calc-current">
        <span>Precio cargado: <strong>${current ? money(current) : '—'}</strong></span>
        ${margin !== null && r.cost > 0 ? `<span class="${margin < 0 ? 'neg' : ''}">margen real ${num(margin, 0)}%</span>` : ''}
      </div>
      <button class="btn-yellow" type="button" onclick="Admin.useSuggested()" ${r.rounded > 0 ? '' : 'disabled'}>Usar ${money(r.rounded)} como precio</button>`;
  }

  function useSuggested() {
    const r = PricingCalc.computePrice(_calc, _otherCosts);
    $('mPrice').value = r.rounded;
    _renderCalc();
    setStatus('Precio actualizado. Guarda el producto para aplicarlo.');
  }

  async function saveCalcDefaults() {
    const body = {};
    DEFAULT_KEYS.forEach(k => { body[k] = _calc[k]; });
    try {
      _pricingDefaults = await api('PUT', '/api/admin/pricing', body);
      setStatus('Valores guardados como predeterminados.');
    } catch (e) {
      setStatus(e.message);
    }
  }

  function estimateWeight() {
    if (!_stl.stats) return;
    const density = (_pricingDefaults.densities || {})[_calc.material] || 1.24;
    const infill = Math.min(100, Math.max(0, Number(_calc.infillPct) || 0)) / 100;
    const grams = _stl.stats.volumeCm3 * density * (SHELL_FRACTION + (1 - SHELL_FRACTION) * infill);
    _calc.weightG = Math.round(grams * 10) / 10;
    document.querySelector('#calcInputs [data-k="weightG"]').value = _calc.weightG;
    $('stlEstimateInfo').textContent =
      `≈ ${num(_calc.weightG)} g estimados (${num(_stl.stats.volumeCm3)} cm³ · ${_calc.material} ${density} g/cm³ · relleno ${num(infill * 100, 0)}%). Es una aproximación: el gcode del slicer es más preciso.`;
    _renderCalc();
  }

  async function _gcodeText(file) {
    const CHUNK = 256 * 1024;
    const head = await file.slice(0, CHUNK).text();
    const tail = file.size > CHUNK ? await file.slice(Math.max(CHUNK, file.size - CHUNK)).text() : '';
    return head + '\n' + tail;
  }

  // a .3mf keeps the gcode comments in its gcode files, or Bambu/Orca metadata in Metadata/slice_info.config
  async function _threeMfText(file) {
    const entries = await Zip.unzip(new Uint8Array(await file.arrayBuffer()),
      n => n === 'Metadata/slice_info.config' || /\.gcode$/i.test(n));
    return Object.values(entries).map(b => new TextDecoder().decode(b)).join('\n');
  }

  // PrusaSlicer, Orca/Bambu and Cura write time and filament as comments at the start or end
  async function _readGcode(file) {
    const text = /\.3mf$/i.test(file.name) ? await _threeMfText(file) : await _gcodeText(file);

    let seconds = null;
    const dur = text.match(/estimated printing time(?: \(normal mode\))?\s*[=:]\s*([^\n;]+)/i)
             || text.match(/total estimated time\s*[=:]\s*([^\n;]+)/i);
    if (dur) {
      const part = (u) => { const m = dur[1].match(new RegExp('(\\d+)\\s*' + u)); return m ? Number(m[1]) : 0; };
      seconds = part('d') * 86400 + part('h') * 3600 + part('m') * 60 + part('s');
    } else {
      const time = text.match(/;TIME:(\d+)/) || text.match(/key="prediction" value="(\d+)"/);
      if (time) seconds = Number(time[1]);
    }

    let grams = null;
    const g = text.match(/(?:total )?filament (?:used|weight) \[g\]\s*[=:]\s*([\d.,\s]+)/i);
    const bambuGrams = text.match(/key="weight" value="([\d.]+)"/);
    if (g) {
      grams = g[1].split(',').reduce((s, v) => s + (parseFloat(v) || 0), 0);
    } else if (bambuGrams) {
      grams = Number(bambuGrams[1]);
    } else {
      const meters = text.match(/;Filament used:\s*([\d.]+)m/i);
      if (meters) {
        const density = (_pricingDefaults.densities || {})[_calc.material] || 1.24;
        const cm3 = parseFloat(meters[1]) * 1000 * Math.PI * 0.875 ** 2 / 1000; // 1.75 mm filament
        grams = cm3 * density;
      }
    }

    if (seconds === null && grams === null) {
      $('gcodeInfo').textContent = `No he encontrado el tiempo ni el peso en ${file.name}. Expórtalo como gcode o 3mf desde PrusaSlicer, Orca/Bambu Studio o Cura.`;
      return;
    }
    const setInput = (k, v) => { _calc[k] = v; document.querySelector(`#calcInputs [data-k="${k}"]`).value = v; };
    if (seconds !== null) {
      setInput('hours', Math.floor(seconds / 3600));
      setInput('minutes', Math.round((seconds % 3600) / 60));
    }
    if (grams !== null) setInput('weightG', Math.round(grams * 10) / 10);
    $('gcodeInfo').textContent = `${file.name}: ${seconds !== null ? `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min` : 'sin tiempo'} · ${grams !== null ? num(grams) + ' g' : 'sin peso'}`;
    _renderCalc();
  }

  // ── save ───────────────────────────────────────────────
  async function _sendMedia(pid, slot, body) {
    const r = await fetch(`/api/admin/products/${pid}/media/${slot}`, {
      method: 'POST',
      headers: { 'x-admin-pass': _pass, 'Content-Type': 'application/octet-stream' },
      body,
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${slot === 'stl' ? 'STL' : SLOT_LABEL[slot]}: ${json.error || 'error al subir'}`);
  }

  // a draft is saved but not shown in the shop; "Publicar" makes it visible
  async function saveProduct(asDraft = false) {
    const id = $('modalId').value;
    const result = PricingCalc.computePrice(_calc, _otherCosts);
    const inputs = {};
    CALC_KEYS.forEach(k => { inputs[k] = _calc[k]; });
    inputs.otherCosts = _otherCosts.filter(o => o.name || o.value);

    const data = {
      name:  $('mName').value.trim(),
      tag:   $('mTag').value,
      price: Number($('mPrice').value) || 0,
      stock: Number($('mStock').value) || 0,
      desc:  $('mDesc').value.trim(),
      notes: $('mNotes').value.trim(),
      active: !asDraft,
      pricing: { inputs, cost: Math.round(result.cost * 100) / 100, suggested: result.rounded },
    };
    if (!data.name) { modalTab('data'); setStatus('Falta el nombre del producto.'); return; }

    const btn = $('modalSave');
    btn.disabled = true;
    setStatus('Guardando…');
    try {
      const saved = await api(id ? 'PUT' : 'POST', id ? `/api/admin/products/${id}` : '/api/admin/products', data);
      $('modalId').value = saved.id;
      draftStore.clear();

      const jobs = [];
      SLOTS.forEach(s => {
        const m = _media[s];
        if (m.blob) jobs.push(() => _sendMedia(saved.id, s, m.blob));
        else if (m.removed && m.url) jobs.push(() => api('DELETE', `/api/admin/products/${saved.id}/media/${s}`));
      });
      if (_stl.file) jobs.push(() => _sendMedia(saved.id, 'stl', _stl.file));
      else if (_stl.removed && _stl.url) jobs.push(() => api('DELETE', `/api/admin/products/${saved.id}/media/stl`));

      for (let i = 0; i < jobs.length; i++) {
        setStatus(`Subiendo archivos ${i + 1}/${jobs.length}…`);
        await jobs[i]();
      }
      closeModal();
      _loadProducts();
    } catch (e) {
      setStatus(e.message || 'Error al guardar.');
      _loadProducts();
    } finally {
      btn.disabled = false;
    }
  }

  function deleteProduct(id) {
    if (!confirm('¿Eliminar este producto? También se borran sus fotos y su STL.')) return;
    api('DELETE', `/api/admin/products/${id}`).then(_loadProducts);
  }

  // ── ORDERS ────────────────────────────────────────────
  function _loadOrders() {
    api('GET', '/api/admin/orders').then(data => {
      _orders = data;
      _renderOrders();
    });
  }

  function _renderOrders() {
    const visible = _orderFilter === 'all' ? _orders : _orders.filter(o => o.status === _orderFilter);
    document.getElementById('ordersList').innerHTML = visible.length
      ? visible.map(o => `
        <div class="order-card">
          <div class="order-top">
            <div>
              <span class="order-id">#${esc(o.id)}</span>
              <span class="order-date"> · ${esc(o.date)}</span>
            </div>
            <span class="status-pill-admin ${esc(o.status)}">${_statusLabel(o.status)}</span>
          </div>
          <div>
            <div class="order-customer">${esc(o.customer.name)}</div>
            <div class="order-email">${esc(o.customer.email)}${o.customer.phone ? ' · ' + esc(o.customer.phone) : ''}</div>
            <div class="order-items-text">${o.items.map(i => esc(i.name) + ' ×' + Number(i.qty)).join(', ')}</div>
            ${o.customer.address ? `<div class="order-items-text">📦 ${esc([o.customer.address.street, o.customer.address.zip, o.customer.address.city, o.customer.address.province].filter(Boolean).join(', '))}</div>` : ''}
            ${o.notes ? `<div class="order-items-text" style="font-style:italic;margin-top:.2rem">💬 ${esc(o.notes)}</div>` : ''}
            <form class="ship-form" onsubmit="Admin.shipOrder(event, '${esc(o.id)}', ${o.paid})">
              ${o.trackingCode ? `<span class="order-items-text">🚚 Enviado el ${esc(new Date(o.shippedAt).toLocaleDateString('es-ES'))} · <strong>${esc(o.trackingCode)}</strong></span>` : ''}
              <input name="trackingCode" placeholder="Código de envío" aria-label="Código de envío de ${esc(o.id)}" value="${esc(o.trackingCode || '')}" maxlength="40" required>
              <button class="btn-sm" type="submit">${o.trackingCode ? 'Corregir y reenviar aviso' : 'Marcar enviado y avisar'}</button>
            </form>
            ${!o.paid && o.accessToken ? `
              <div class="order-links">
                <button class="btn-sm" type="button" onclick="Admin.copyOrderLink('${esc(o.id)}', this)">Copiar enlace de pago</button>
                ${o.customer.phone ? `<a class="btn-sm" target="_blank" rel="noopener" href="${esc(_orderWaLink(o))}">Enviar por WhatsApp</a>` : ''}
              </div>` : ''}
          </div>
          <div class="order-bottom">
            <span class="order-total-big">${money(o.total)}</span>
            <div class="order-controls">
              <span class="paid-badge ${o.paid ? 'paid' : 'unpaid'}">${o.paid ? '✓ Pagado' : '⏳ Sin pagar'}${o.paymentMethod && o.paymentMethod !== 'pendiente' ? ` · ${esc(o.paymentMethod)}` : ''}</span>
              <select class="status-select" onchange="Admin.updateOrder('${o.id}',{status:this.value})">
                ${['pendiente','preparando','en-camino','entregado'].map(s =>
                  `<option value="${s}"${o.status===s?' selected':''}>${_statusLabel(s)}</option>`
                ).join('')}
              </select>
              ${!o.paid ? `<button class="btn-sm" onclick="Admin.updateOrder('${o.id}',{paid:true})">Marcar pagado</button>` : ''}
            </div>
          </div>
        </div>`).join('')
      : '<p style="color:var(--text-muted);padding:1rem">No hay pedidos en este estado.</p>';
  }

  function filterOrders(filter, btn) {
    _orderFilter = filter;
    document.querySelectorAll('#section-orders .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _renderOrders();
  }

  // ── WEB: texts, contact, legal, SEO ───────────────────
  const pairs = (n, make) => Array.from({ length: n }, (_, i) => make(i + 1)).flat();
  const SITE_GROUPS = [
    ['Marca y portada', [['brandName', 'Nombre de la tienda'], ['heroSub', 'Frase bajo el nombre', 'textarea']]],
    ['Quién hay detrás', [['aboutLabel', 'Etiqueta'], ['aboutTitle', 'Título'],
      ['aboutText1', 'Párrafo 1', 'textarea'], ['aboutText2', 'Párrafo 2', 'textarea'],
      ...pairs(4, i => [[`stat${i}Num`, `Cifra ${i}`], [`stat${i}Label`, `Texto de la cifra ${i}`]])]],
    ['Cómo funciona', [['processLabel', 'Etiqueta'], ['processTitle', 'Título'],
      ...pairs(4, i => [[`step${i}Title`, `Paso ${i}: título`], [`step${i}Text`, `Paso ${i}: texto`, 'textarea']])]],
    ['Testimonios (vacío = no se muestra)', [['testimonialsLabel', 'Etiqueta'], ['testimonialsTitle', 'Título'],
      ...pairs(3, i => [[`t${i}Text`, `Testimonio ${i}`, 'textarea'], [`t${i}Name`, `Nombre ${i}`], [`t${i}Place`, `Ciudad ${i}`]])]],
    ['Llamada a la acción y pie', [['ctaTitle', 'Título'], ['ctaText', 'Texto', 'textarea'], ['ctaButton', 'Texto del botón'],
      ['footerText', 'Texto del pie de página', 'textarea']]],
    ['Contacto y redes', [['whatsapp', 'WhatsApp con prefijo de país (p. ej. 34612345678)'],
      ['whatsappMessage', 'Mensaje inicial de WhatsApp'], ['instagram', 'Instagram (URL completa)'],
      ['tiktok', 'TikTok (URL completa)'], ['email', 'Correo público de contacto']]],
    ['Datos legales (aviso legal y privacidad)', [['legalOwner', 'Titular: nombre y apellidos de una persona mayor de edad o empresa'],
      ['legalNif', 'NIF / DNI'], ['legalAddress', 'Domicilio'], ['legalEmail', 'Correo para temas legales y de privacidad']]],
    ['Pagos y envíos', [['bankHolder', 'Transferencia: titular de la cuenta (vacío = sin transferencia)'], ['bankIban', 'Transferencia: IBAN'],
      ['deliveryTime', 'Plazo de preparación y entrega (se muestra al comprar y en las condiciones)', 'textarea'],
      ['trackingUrl', 'Enlace de seguimiento del transportista ({code} se sustituye por el código de envío)', 'textarea']]],
    ['SEO (Google)', [['seoTitle', 'Título de la portada (máx. ~60 caracteres)'], ['seoDescription', 'Descripción (máx. ~160 caracteres)', 'textarea'],
      ['googleVerification', 'Código de verificación de Google Search Console']]],
  ];

  function _loadSite() {
    return api('GET', '/api/admin/site').then(site => {
      $('siteForm').innerHTML = SITE_GROUPS.map(([title, fields]) => `
        <fieldset class="site-group">
          <legend>${esc(title)}</legend>
          ${fields.map(([key, label, type]) => `
            <label class="site-field${type === 'textarea' ? ' wide' : ''}">
              <span>${esc(label)}</span>
              ${type === 'textarea'
                ? `<textarea data-site="${key}" rows="3">${esc(site[key])}</textarea>`
                : `<input type="text" data-site="${key}" value="${esc(site[key])}">`}
            </label>`).join('')}
        </fieldset>`).join('');
      _siteWarnings(site);
    }).catch(e => { $('siteStatus').textContent = e.message; });
  }

  function _siteWarnings(site) {
    const missing = [];
    if (!site.whatsapp) missing.push('número de WhatsApp (sin él, los botones llevan al formulario)');
    if (!site.legalOwner || !site.legalNif || !site.legalAddress || !site.legalEmail) missing.push('datos legales completos');
    if (!site.cardPayments && !site.bankIban) missing.push('una forma de pago (claves de Stripe en .env o un IBAN para transferencias)');
    $('siteWarnings').hidden = !missing.length;
    $('siteWarnings').textContent = missing.length ? `Antes de publicar falta: ${missing.join(' · ')}.` : '';
  }

  async function saveSite() {
    const body = {};
    document.querySelectorAll('[data-site]').forEach(el => { body[el.dataset.site] = el.value; });
    $('siteSave').disabled = true;
    $('siteStatus').textContent = 'Guardando…';
    try {
      const site = await api('PUT', '/api/admin/site', body);
      _siteWarnings(site);
      $('siteStatus').textContent = 'Guardado. Recarga la web para ver los cambios.';
    } catch (e) {
      $('siteStatus').textContent = e.message;
    } finally {
      $('siteSave').disabled = false;
    }
  }

  // ── STATS (cookieless analytics) ──────────────────────
  let _stats = null, _chartVisits;

  function _loadStats() {
    return api('GET', '/api/admin/stats').then(s => { _stats = s; _renderStats(); }).catch(() => {});
  }

  function _renderStats() {
    if (!_stats) return;
    const t = _themeColors();
    const days = [];
    for (let d = new Date(_stats.since); days.length < 30; d.setDate(d.getDate() + 1)) days.push(d.toISOString().slice(0, 10));
    const byDay = Object.fromEntries(_stats.daily.map(r => [r.day, r]));
    const rate = _stats.totals.views ? Math.round(_stats.totals.whatsapp / _stats.totals.views * 1000) / 10 : 0;
    $('statsTotals').textContent = `${_stats.totals.views} páginas vistas · ${_stats.totals.whatsapp} clics en WhatsApp (${num(rate)} %)`;

    if (_chartVisits) _chartVisits.destroy();
    _chartVisits = new Chart($('chartVisits').getContext('2d'), {
      data: {
        labels: days.map(d => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })),
        datasets: [
          { type: 'line', label: 'Páginas vistas', data: days.map(d => (byDay[d] || {}).views || 0), borderColor: t.ink, backgroundColor: t.ink, tension: 0.3, pointRadius: 0 },
          { type: 'bar', label: 'Clics en WhatsApp', data: days.map(d => (byDay[d] || {}).whatsapp || 0), backgroundColor: '#25D366', borderRadius: 3 },
        ],
      },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });

    const list = (title, rows, key) => `
      <div><h4>${title}</h4>${rows.length
        ? `<ol>${rows.map(r => `<li><span>${esc(r[key])}</span><strong>${r.n}</strong></li>`).join('')}</ol>`
        : '<p class="empty-note">Sin datos todavía</p>'}</div>`;
    $('statsLists').innerHTML = list('Páginas más vistas', _stats.pages, 'path') + list('De dónde llegan', _stats.referrers, 'referrer');
  }

  // ── REVIEWS (moderation) ──────────────────────────────
  let _reviews = [];
  let _reviewFilter = 'pending';

  function _setCount(id, n) {
    const el = $(id);
    el.textContent = n;
    el.hidden = !n;
  }

  function _loadReviews() {
    return api('GET', '/api/admin/reviews').then(list => {
      _reviews = list;
      _setCount('reviewsCount', list.filter(r => r.status === 'pending').length);
      _renderReviews();
    }).catch(() => {});
  }

  function _renderReviews() {
    const visible = _reviewFilter === 'all' ? _reviews : _reviews.filter(r => r.status === _reviewFilter);
    $('reviewsList').innerHTML = visible.length ? visible.map(r => `
      <div class="order-card review-card${r.status === 'pending' ? ' is-pending' : ''}">
        <div class="order-top">
          <div>
            <span class="order-id">${esc(r.name)}</span>
            <span class="order-date"> · ${esc(r.date)} · ${esc(r.productName)}</span>
          </div>
          <span class="status-pill-admin ${r.status === 'pending' ? 'pendiente' : 'entregado'}">${r.status === 'pending' ? 'Pendiente' : 'Publicada'}</span>
        </div>
        <div class="review-stars-admin" aria-label="${Number(r.stars)} de 5">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
        <p class="review-text-admin">${esc(r.text)}</p>
        <div class="order-bottom">
          <span></span>
          <div class="order-controls">
            ${r.status === 'pending'
              ? `<button class="btn-yellow btn-compact" onclick="Admin.setReviewStatus('${esc(r.id)}','approved')">Aprobar</button>`
              : `<button class="btn-sm" onclick="Admin.setReviewStatus('${esc(r.id)}','pending')">Ocultar</button>`}
            <button class="btn-sm danger" onclick="Admin.deleteReview('${esc(r.id)}')">${r.status === 'pending' ? 'Rechazar' : 'Eliminar'}</button>
          </div>
        </div>
      </div>`).join('')
      : `<p class="empty-note">${_reviewFilter === 'pending' ? 'No hay reseñas pendientes.' : 'No hay reseñas.'}</p>`;
  }

  function filterReviews(filter, btn) {
    _reviewFilter = filter;
    document.querySelectorAll('#section-reviews .filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    _renderReviews();
  }

  function setReviewStatus(id, status) {
    api('PATCH', `/api/admin/reviews/${encodeURIComponent(id)}`, { status }).then(_loadReviews);
  }

  function deleteReview(id) {
    if (!confirm('¿Eliminar esta reseña? No se puede deshacer.')) return;
    api('DELETE', `/api/admin/reviews/${encodeURIComponent(id)}`).then(_loadReviews);
  }

  // ── MESSAGES (contact form) ───────────────────────────
  let _messages = [];

  function _loadMessages() {
    return api('GET', '/api/admin/messages').then(({ mail, messages }) => {
      _messages = messages;
      _setCount('messagesCount', messages.filter(m => !m.read).length);
      $('mailStatus').innerHTML = mail.configured
        ? `Los mensajes del formulario se envían a <strong>${esc(mail.to)}</strong> y también se guardan aquí.`
        : 'El correo no está configurado: los mensajes solo se guardan aquí. Copia <code>.env.example</code> como <code>.env</code>, rellénalo y reinicia el servidor.';
      $('mailStatus').classList.toggle('warn', !mail.configured);
      _renderMessages();
    }).catch(() => {});
  }

  function _renderMessages() {
    const fmt = iso => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    $('messagesList').innerHTML = _messages.length ? _messages.map(m => `
      <div class="order-card message-card${m.read ? '' : ' is-unread'}">
        <div class="order-top">
          <div>
            <span class="order-id">${esc(m.name)}</span>
            <span class="order-date"> · ${esc(fmt(m.date))}</span>
          </div>
          <span class="paid-badge ${m.emailed ? 'paid' : 'unpaid'}" title="${esc(m.mailError || '')}">${m.emailed ? 'Enviado por correo' : 'Solo guardado'}</span>
        </div>
        <a class="order-email" href="mailto:${encodeURIComponent(m.email)}">${esc(m.email)}</a>
        <p class="review-text-admin">${esc(m.message)}</p>
        <div class="order-bottom">
          <span></span>
          <div class="order-controls">
            <a class="btn-sm" href="mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re: tu mensaje a dream3d')}">Responder</a>
            <button class="btn-sm" onclick="Admin.markMessage('${esc(m.id)}', ${!m.read})">${m.read ? 'Marcar como no leído' : 'Marcar como leído'}</button>
            <button class="btn-sm danger" onclick="Admin.deleteMessage('${esc(m.id)}')">Eliminar</button>
          </div>
        </div>
      </div>`).join('')
      : '<p class="empty-note">Todavía no hay mensajes.</p>';
  }

  function markMessage(id, read) {
    api('PATCH', `/api/admin/messages/${encodeURIComponent(id)}`, { read }).then(_loadMessages);
  }

  function deleteMessage(id) {
    if (!confirm('¿Eliminar este mensaje?')) return;
    api('DELETE', `/api/admin/messages/${encodeURIComponent(id)}`).then(_loadMessages);
  }

  function updateOrder(id, patch) {
    api('PATCH', `/api/admin/orders/${id}`, patch).then(() => _loadOrders());
  }

  // the customer's order page: pays by card or shows the transfer details, and never expires
  const _orderLink = o => `${location.origin}/pedido/${o.id}?t=${o.accessToken}`;
  const _orderWaLink = o => `https://wa.me/${String(o.customer.phone).replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hola ${o.customer.name}, aquí tienes el enlace para pagar tu pedido ${o.id} (${money(o.total)}): ${_orderLink(o)}`)}`;

  async function copyOrderLink(id, btn) {
    const o = _orders.find(x => x.id === id);
    if (!o) return;
    try {
      await navigator.clipboard.writeText(_orderLink(o));
      btn.textContent = '✓ Copiado';
    } catch (e) {
      prompt('Copia este enlace:', _orderLink(o));
    }
  }

  async function shipOrder(e, id, paid) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    if (!paid && !confirm(`El pedido ${id} no está marcado como pagado. ¿Marcarlo como enviado igualmente?`)) return;
    btn.disabled = true;
    try {
      const r = await api('POST', `/api/admin/orders/${encodeURIComponent(id)}/ship`, { trackingCode: e.target.trackingCode.value });
      alert(r.emailed
        ? `Pedido ${id} marcado como enviado. Correo con el código de seguimiento enviado al cliente.`
        : `Pedido ${id} marcado como enviado, pero no se envió el correo: ${r.reason}. Pásale el código por WhatsApp.`);
      await _loadOrders();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
    }
  }

  async function createOrder(e) {
    e.preventDefault();
    const f = e.target;
    const body = Object.fromEntries(new FormData(f));
    $('newOrderStatus').textContent = 'Creando…';
    try {
      const order = await api('POST', '/api/admin/orders', body);
      f.reset();
      $('newOrder').open = false;
      $('newOrderStatus').textContent = '';
      await _loadOrders();
      try { await navigator.clipboard.writeText(_orderLink(order)); } catch (err) { /* button still available */ }
      alert(`Pedido ${order.id} creado. Enlace de pago copiado:\n${_orderLink(order)}`);
    } catch (err) {
      $('newOrderStatus').textContent = err.message;
    }
  }

  function _statusLabel(s) {
    return { pendiente:'Pendiente', preparando:'Preparando', 'en-camino':'En camino', entregado:'Entregado' }[s] || s;
  }

  return {
    login, logout, nav, openProductModal, closeModal, modalTab, saveProduct, deleteProduct,
    removeStl, addOtherCost, useSuggested, saveCalcDefaults, estimateWeight,
    filterOrders, updateOrder, copyOrderLink, createOrder, shipOrder,
    filterReviews, setReviewStatus, deleteReview, markMessage, deleteMessage, saveSite,
  };
})();
