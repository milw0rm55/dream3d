/**
 * Forma3D — Design Tokens
 * Edita este archivo para cambiar colores, tipografía y radios en toda la app.
 * Los cambios se aplican al reiniciar el servidor.
 */
module.exports = {

  // Modo de color por defecto para quien no haya elegido uno en el selector de la web:
  //   'auto'  → sigue el modo claro/oscuro del navegador o del sistema
  //   'light' → siempre claro
  //   'dark'  → siempre oscuro
  defaultMode: 'auto',

  colors: {
    // ── modo claro ───────────────────────────────
    ink:         '#0A0A0A', // texto, bordes fuertes y sombras desplazadas
    paper:       '#FFFFFF', // fondo
    surfaceAlt:  '#F4F3EF', // bloques secundarios
    textMuted:   '#5E5E5A',
    line:        '#E2E0DA', // separadores finos
    accent:      '#E9E6DE', // relleno en hover (cards, menú)
    accentStrong:'#D9D5CA', // estado presionado
    onInk:       '#FFFFFF', // texto sobre fondos tinta
    inverseBg:   '#0A0A0A', // footer
    inverseFg:   '#FFFFFF',
    success:     '#2F6B3A',
    danger:      '#B42318',

    // ── modo oscuro ──────────────────────────────
    dark: {
      ink:         '#EDECE7',
      paper:       '#0F0F0E',
      surfaceAlt:  '#181817',
      textMuted:   '#A3A19A',
      line:        '#2E2D2A',
      accent:      '#24231F',
      accentStrong:'#302F2A',
      onInk:       '#0F0F0E',
      inverseBg:   '#000000',
      inverseFg:   '#EDECE7',
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
