/**
 * Forma3D — Design Tokens
 * Edita este archivo para cambiar colores, tipografía y radios en toda la app.
 * Los cambios se aplican al reiniciar el servidor.
 */
module.exports = {

  // La web es siempre oscura: solo se usa colors.dark.

  colors: {
    // ── modo claro ───────────────────────────────
    ink:         '#0A0A0A', // texto, bordes fuertes y sombras desplazadas
    paper:       '#FFFFFF', // fondo
    surfaceAlt:  '#F4F3EF', // bloques secundarios
    textMuted:   '#5E5E5A',
    line:        '#E2E0DA', // separadores finos
    accent:      '#E9E6DE', // relleno en hover (cards, menú)
    accentStrong:'#D9D5CA', // estado presionado
    cta:         '#0A0A0A', // botones principales
    onInk:       '#FFFFFF', // texto sobre fondos tinta
    inverseBg:   '#0A0A0A', // footer
    inverseFg:   '#FFFFFF',
    success:     '#2F6B3A',
    danger:      '#B42318',

    // ── modo oscuro ──────────────────────────────
    // paleta de marca: negro, morado, orquídea y amarillo pálido
    dark: {
      ink:         '#FAEB92', // texto, bordes y sombras desplazadas
      paper:       '#000000', // fondo
      surfaceAlt:  '#000000',
      textMuted:   '#CC66DA',
      line:        '#9929EA', // separadores y bordes de tarjetas
      accent:      '#9929EA', // relleno en hover
      accentStrong:'#CC66DA', // estado presionado
      cta:         '#FAEB92', // botones principales
      onInk:       '#000000', // texto sobre amarillo
      inverseBg:   '#9929EA', // footer
      inverseFg:   '#FAEB92',
      success:     '#FAEB92', // la paleta no tiene verde
      danger:      '#CC66DA', // la paleta no tiene rojo
    },

    blobatar: ['#000000', '#9929EA', '#CC66DA', '#FAEB92'],
  },

  fonts: {
    display: 'Work Sans',
    body:    'Work Sans', // served from our own server: public/css/fonts.css
  },

  radius: {
    sm:   '5px',
    md:   '8px',
    lg:   '11px',
    xl:   '11px',
    pill: '4px',
  },

  spacing: {
    navHeight: '64px',
  },

  motion: {
    easeOut: 'cubic-bezier(0.23, 1, 0.32, 1)',
    fast:    '100ms',
    base:    '200ms',
  },
};
