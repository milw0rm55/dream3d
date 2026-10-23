/**
 * Valores iniciales de la calculadora de precio sugerido (admin → producto → Precio).
 * Son valores de ejemplo: ajústalos a tus costes reales. Desde el admin también se pueden
 * guardar como predeterminados (se escriben en data/pricing.json y tienen prioridad).
 */
module.exports = {
  currency: 'EUR',

  // filamento
  material: 'PLA',
  spoolPrice: 20,      // € por bobina
  spoolWeight: 1000,   // g por bobina
  wastePct: 20,        // purga, soportes, fallos

  // electricidad
  powerW: 120,
  kwhPrice: 0.15,      // €/kWh

  // mano de obra
  prepMin: 15,
  postMin: 20,
  laborRate: 8,        // € por hora

  // máquina
  printerCost: 650,    // €
  paybackYears: 2,
  dailyHours: 6,
  repairPct: 5,        // % del coste de la impresora por año

  // envío gratis y cobro: el precio absorbe lo que te cuesta enviar y la comisión de la tarjeta
  shipCost: 3.9,       // € que te cobra Correos por paquete (0 si lo paga el cliente aparte)
  cardFeePct: 1.5,     // Stripe, tarjetas europeas estándar
  cardFeeFixed: 0.25,  // € por cobro

  // venta
  profitPct: 30,
  vatPct: 0,           // IVA en España: 21 %
  roundTo: 0.5,        // redondear a 0,50 €

  // estimación de peso desde STL
  infillPct: 15,
  densities: { PLA: 1.24, PETG: 1.27, ASA: 1.07, TPU: 1.21, Resina: 1.12 },
};
