/**
 * Textos y datos de la web: valores iniciales (los edita el admin, sección «Web»; lo guardado allí tiene prioridad).
 * Un solo archivo para el servidor (config/site.js lo reexporta) y el navegador (si la página no llega renderizada).
 */
(function (root) {
  const SITE_DEFAULTS = {
    // marca
    brandName: 'dream3d',
  
    // portada
    heroSub: 'figuras impresas en 3D, diseñadas y acabadas a mano en España',
    aboutLabel: 'quién hay detrás',
    aboutTitle: 'Un emprendimiento con mucha impresión.',
    aboutText1: 'Hola, la impresión 3D me flipa desde hace un par de años. Empecé haciendo figuras para mí y para mis amigos, y ahora ya tengo clientes por toda España.',
    aboutText2: 'Cada figura la diseño o la adapto yo mismo, controlo la impresión paso a paso y la reviso antes de enviarla. Es mi forma de convertir la creatividad en algo real.',
    stat1Num: '+120',   stat1Label: 'figuras entregadas',
    stat2Num: '2 años', stat2Label: 'de experiencia',
    stat3Num: '0,1 mm', stat3Label: 'precisión de capa',
    stat4Num: '5/5',    stat4Label: 'valoración media',
    processLabel: 'cómo funciona',
    processTitle: 'De tu idea a tu mano en 4 pasos.',
    step1Title: 'Eliges tu figura',        step1Text: 'En la tienda eliges figura, color y cantidad. ¿Quieres una a medida? Cuéntamela por WhatsApp.',
    step2Title: 'Pagas de forma segura',   step2Text: 'Con tarjeta, Apple Pay, Google Pay o transferencia. Te llega la confirmación por correo.',
    step3Title: 'Imprimo y reviso',        step3Text: 'Empiezo la impresión, te envío fotos del proceso y reviso cada detalle.',
    step4Title: 'Te la envío',             step4Text: 'Envío gratis con Correos a la península y Baleares, con código de seguimiento.',
    testimonialsLabel: 'lo que dicen',
    testimonialsTitle: 'Clientes que siguen volviendo.',
    t1Text: 'No podía creer la calidad. La figura del Caballero quedó perfecta, con un nivel de detalle increíble para el precio.', t1Name: 'Martina L.', t1Place: 'Valencia',
    t2Text: 'Me sorprendió lo profesional que fue todo: fotos del proceso, embalaje perfecto. Todo un crack.', t2Name: 'Juan R.', t2Place: 'Madrid',
    t3Text: 'Pedí el dragón con los colores de mi equipo favorito y quedó genial. Tuvo muchísima paciencia conmigo.', t3Name: 'Carla P.', t3Place: 'Córdoba',
    ctaTitle: '¿quieres una figura personalizada?',
    ctaText: 'Cuéntame tu idea por WhatsApp (si tienes el STL, mejor) y en menos de 24 horas te paso presupuesto.',
    ctaButton: 'pedir figura personalizada',
    footerText: 'Impresión 3D artesanal, pieza a pieza.\nEnvío gratis a la península y Baleares.',
  
    // contacto (vacío = no se muestra)
    whatsapp: '',                 // con prefijo de país, p. ej. 34612345678
    whatsappMessage: 'Hola, quiero una figura personalizada',
    instagram: '',                // URL completa
    tiktok: '',                   // URL completa
    email: '',
  
    // datos legales (titular de la web: debe ser una persona mayor de edad o una empresa)
    legalOwner: '',
    legalNif: '',
    legalAddress: '',
    legalEmail: '',

    // pagos y envíos
    bankHolder: '',               // titular de la cuenta para transferencias (vacío = sin transferencia)
    bankIban: '',
    deliveryTime: 'Cada figura se imprime bajo pedido: la preparamos en 3 a 5 días laborables y Correos la entrega en 2 a 5 días laborables más.',
    trackingUrl: 'https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number={code}', // {code} = código de envío
    shippingCost: 3.9,            // € (no editable desde el admin: cambia aquí y reinicia)
    freeShippingFrom: 0,          // € de subtotal a partir de los que el envío es gratis (0 = siempre: los precios ya incluyen el envío, ver calculadora del admin)

    // SEO
    seoTitle: 'dream3d · figuras impresas en 3D a mano',
    seoDescription: 'Figuras y regalos impresos en 3D, diseñados y acabados a mano en España. Cómpralas online con envío gratis o pide tu figura personalizada.',
    googleVerification: '',       // contenido de la etiqueta de Google Search Console
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SITE_DEFAULTS;
  else root.SITE_DEFAULTS = SITE_DEFAULTS;
})(this);
