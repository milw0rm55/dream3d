/**
 * Light / dark / auto colour mode. Loaded in <head> so the saved choice applies before first paint.
 * The palettes themselves come from /theme.css (config/theme.js).
 */
const ThemeMode = (() => {
  const KEY = 'dream3d-theme';
  const MODES = ['auto', 'light', 'dark'];
  const LABEL = { auto: 'automático', light: 'claro', dark: 'oscuro' };
  const ICON = {
    auto: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
    light: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  };
  const listeners = [];
  let fallback = 'auto';

  const read = () => {
    try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : null; } catch (e) { return null; }
  };

  function apply(mode) {
    if (mode) document.documentElement.dataset.theme = mode;
    else delete document.documentElement.dataset.theme;
  }

  function get() {
    return read() || fallback;
  }

  // what is actually on screen right now
  function isDark() {
    const mode = get();
    return mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function set(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) { /* private mode: applies to this page only */ }
    apply(mode);
    refresh();
  }

  function cycle() {
    set(MODES[(MODES.indexOf(get()) + 1) % MODES.length]);
  }

  function refresh() {
    const mode = get();
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.setAttribute('aria-label', `Modo de color: ${LABEL[mode]}. Pulsa para cambiar`);
      btn.title = `Modo de color: ${LABEL[mode]}`;
      const icon = btn.querySelector('.theme-icon') || btn;
      icon.innerHTML = ICON[mode];
      const text = btn.querySelector('.theme-text');
      if (text) text.textContent = `Tema: ${LABEL[mode]}`;
    });
    listeners.forEach(fn => fn(mode, isDark()));
  }

  function setDefault(mode) {
    if (MODES.includes(mode)) fallback = mode;
    refresh();
  }

  function onChange(fn) { listeners.push(fn); }

  apply(read());

  document.addEventListener('click', e => {
    if (e.target.closest('[data-theme-toggle]')) cycle();
  });
  // same choice across tabs and the admin preview iframe
  window.addEventListener('storage', e => { if (e.key === KEY) { apply(read()); refresh(); } });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
  document.addEventListener('DOMContentLoaded', refresh);

  return { get, set, cycle, isDark, refresh, setDefault, onChange };
})();
