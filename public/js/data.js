// Precios en euros: "25 €", "3,90 €"
function formatPrice(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('es-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// Site texts and contact data, injected by the server into each page (window.SITE); edited in admin → Web.
// Defaults cover a page that wasn't server-rendered (e.g. an older server process still running).
const SITE = { ...(window.SITE_DEFAULTS || {}), ...(window.SITE || {}) };
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const siteText = key => escapeHtml(SITE[key]);
const siteLines = key => siteText(key).replace(/\n/g, '<br>');

// WhatsApp is the single call to action; without a number configured it falls back to the contact page
function waLink(message) {
  const number = String(SITE.whatsapp || '').replace(/\D/g, '');
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message || SITE.whatsappMessage || '')}` : '/contacto';
}

// products come from /api/products at startup (see app.js init)
let PRODUCTS = [];
