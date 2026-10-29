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
    dark: {
      ink:         '#FCFAFD',
      paper:       '#3D3C48', // slate con matiz violeta
      surfaceAlt:  '#4A4955',
      textMuted:   '#B3B1C2',
      line:        '#5C5A6A',
      accent:      '#4F4D5D',
      accentStrong:'#5E5C6F',
      cta:         '#A795EB', // violeta de los botones
      onInk:       '#1E1D26',
      inverseBg:   '#2F2E38',
      inverseFg:   '#FCFAFD',
      success:     '#7CC98A',
      danger:      '#F2685C',
    },

    blobatar: [
      '#0A0A0A', '#3A3A38', '#6B6A66', '#9C9A94',
      '#C9C6BD', '#E9E6DE', '#55534E', '#B5B2A9',
    ],
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
