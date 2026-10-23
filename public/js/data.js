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

let PRODUCTS = [
  {
    id: 1, name: 'Caballero Épico', tag: 'Videojuegos', price: 25, model: 'knight',
    desc: 'Figura de caballero medieval en alta resolución, impresa en PLA. Perfecta para coleccionistas o como regalo. Disponible en múltiples colores con acabado liso.',
    colors: ['#DFEB1E','#A8D80E','#1E4FEB','#E03030','#0B1300'],
    specs: [['Material','PLA'],['Altura','12 cm'],['Peso','~85 g'],['Tiempo de impresión','4–6 h'],['Acabado','Liso']],
    bg: 'transparent',
    svg: `<svg width="110" height="130" viewBox="0 0 110 130" fill="none"><ellipse cx="55" cy="28" rx="18" ry="18" fill="#DFEB1E"/><rect x="38" y="44" width="34" height="46" rx="6" fill="#A8D80E"/><rect x="20" y="48" width="14" height="34" rx="5" fill="#C8D800"/><rect x="76" y="48" width="14" height="34" rx="5" fill="#C8D800"/><rect x="42" y="88" width="11" height="30" rx="4" fill="#6EA000"/><rect x="57" y="88" width="11" height="30" rx="4" fill="#6EA000"/><rect x="47" y="22" width="16" height="3" rx="1.5" fill="#0B1300" opacity=".5"/></svg>`
  },
  {
    id: 2, name: 'Cohete Espacial', tag: 'Regalos', price: 18, model: 'rocket',
    desc: 'Cohete espacial bicolor ideal para regalo. Impreso en PLA con dos colores, perfecto para amantes del espacio o la ciencia ficción.',
    colors: ['#1E4FEB','#DFEB1E','#FFFFFF','#E03030'],
    specs: [['Material','PLA bicolor'],['Altura','10 cm'],['Peso','~60 g'],['Tiempo de impresión','3–4 h'],['Acabado','Liso']],
    bg: 'transparent',
    svg: `<svg width="120" height="130" viewBox="0 0 120 130" fill="none"><path d="M60 10 C60 10 40 35 38 70 L82 70 C80 35 60 10 60 10Z" fill="#1E4FEB"/><rect x="38" y="68" width="44" height="30" rx="4" fill="#3B6FFF"/><path d="M38 98 L24 118 L52 110Z" fill="#1E4FEB"/><path d="M82 98 L96 118 L68 110Z" fill="#1E4FEB"/><ellipse cx="60" cy="42" rx="10" ry="10" fill="#E8F5FF" opacity=".8"/><ellipse cx="60" cy="118" rx="10" ry="8" fill="#DFEB1E"/><ellipse cx="60" cy="116" rx="6" ry="5" fill="#FFF"/></svg>`
  },
  {
    id: 3, name: 'Dragón Colección', tag: 'Anime & Manga', price: 32, model: 'dragon',
    desc: 'Dragón de colección con acabado premium en resina UV. Captura cada escama con precisión. Disponible en varios esquemas de color.',
    colors: ['#A8D80E','#E03030','#1E4FEB','#8B4513','#0B1300'],
    specs: [['Material','Resina UV'],['Altura','8 cm'],['Peso','~40 g'],['Tiempo de impresión','6–8 h'],['Acabado','Premium']],
    bg: 'transparent',
    svg: `<svg width="130" height="130" viewBox="0 0 130 130" fill="none"><ellipse cx="65" cy="75" rx="30" ry="22" fill="#A8D80E"/><ellipse cx="65" cy="72" rx="26" ry="18" fill="#DFEB1E"/><ellipse cx="90" cy="55" rx="16" ry="12" fill="#A8D80E"/><circle cx="96" cy="52" r="4" fill="#0B1300"/><circle cx="97" cy="51" r="1.5" fill="#fff"/><path d="M55 68 Q30 45 20 55 Q35 62 45 75Z" fill="#6EA000" opacity=".8"/><path d="M75 68 Q100 45 110 55 Q95 62 85 75Z" fill="#6EA000" opacity=".8"/><path d="M38 82 Q20 95 25 110 Q30 95 45 90Z" fill="#A8D80E"/><ellipse cx="50" cy="93" rx="7" ry="12" fill="#6EA000"/><ellipse cx="80" cy="93" rx="7" ry="12" fill="#6EA000"/></svg>`
  },
  {
    id: 4, name: 'Gato Kawaii', tag: 'Regalos', price: 15, model: 'cat',
    desc: 'Pequeña figura de gato estilo kawaii, perfecta para decorar escritorios o regalar. Impresa en PLA con acabado suave.',
    colors: ['#E8C4FF','#DFEB1E','#A8D80E','#FFDDF4'],
    specs: [['Material','PLA'],['Altura','9 cm'],['Peso','~50 g'],['Tiempo de impresión','2–3 h'],['Acabado','Liso']],
    bg: 'transparent',
    svg: `<svg width="120" height="130" viewBox="0 0 120 130" fill="none"><ellipse cx="60" cy="90" rx="26" ry="30" fill="#E8C4FF"/><ellipse cx="60" cy="55" rx="20" ry="20" fill="#E8C4FF"/><polygon points="42,42 36,22 52,36" fill="#D4A0FF"/><polygon points="78,42 84,22 68,36" fill="#D4A0FF"/><circle cx="52" cy="52" r="4" fill="#0B1300"/><circle cx="68" cy="52" r="4" fill="#0B1300"/><circle cx="53" cy="51" r="1.5" fill="#fff"/><circle cx="69" cy="51" r="1.5" fill="#fff"/><path d="M56 60 Q60 64 64 60" stroke="#0B1300" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M86 105 Q105 100 102 82" stroke="#D4A0FF" stroke-width="8" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    id: 5, name: 'Creeper Minecraft', tag: 'Videojuegos', price: 20, model: 'creeper',
    desc: 'Figura del icónico Creeper de Minecraft en estilo bloque. Edición especial con acabado mate. Ideal para fans del juego.',
    colors: ['#6EA000','#A8D80E','#DFEB1E'],
    specs: [['Material','PLA verde'],['Altura','11 cm'],['Peso','~90 g'],['Tiempo de impresión','5–6 h'],['Acabado','Mate']],
    bg: 'transparent',
    svg: `<svg width="110" height="130" viewBox="0 0 110 130" fill="none"><rect x="30" y="10" width="50" height="50" rx="4" fill="#6EA000"/><rect x="38" y="22" width="14" height="14" rx="2" fill="#0B1300"/><rect x="58" y="22" width="14" height="14" rx="2" fill="#0B1300"/><rect x="44" y="40" width="22" height="14" rx="2" fill="#0B1300"/><rect x="44" y="44" width="10" height="10" rx="1" fill="#6EA000"/><rect x="56" y="44" width="10" height="10" rx="1" fill="#6EA000"/><rect x="34" y="62" width="42" height="36" rx="4" fill="#A8D80E"/><rect x="18" y="62" width="14" height="28" rx="4" fill="#6EA000"/><rect x="78" y="62" width="14" height="28" rx="4" fill="#6EA000"/><rect x="34" y="98" width="16" height="26" rx="4" fill="#6EA000"/><rect x="60" y="98" width="16" height="26" rx="4" fill="#6EA000"/></svg>`
  },
  {
    id: 6, name: 'Diseño Personalizado', tag: 'Custom', price: 0,
    desc: 'Envíame tu archivo STL o descríbeme tu idea y la imprimo a medida. Precio según complejidad, material y tamaño. Presupuesto sin compromiso.',
    colors: ['#DFEB1E','#A8D80E','#1E4FEB','#E8C4FF','#0B1300'],
    specs: [['Material','A elección'],['Tamaño','A elección'],['Archivo','STL / descripción'],['Entrega','A coordinar']],
    bg: 'transparent',
    svg: `<svg width="120" height="130" viewBox="0 0 120 130" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M30 100 L30 40 L60 22 L90 40 L90 100 L60 118 Z"/><path d="M30 40 L60 58 L90 40"/><path d="M60 58 L60 118"/><path d="M78 16 L104 42" stroke-dasharray="4 6"/><circle cx="104" cy="42" r="4" fill="currentColor"/></svg>`
  }
];
