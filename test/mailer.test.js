const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMailer, trackingLink } = require('../mailer');

const site = { brandName: 'dream3d', bankHolder: 'Titular', bankIban: 'ES9121000418450200051332', email: 'hola@dream3d.es', deliveryTime: 'Plazo X.' };
const order = (extra = {}) => ({
  id: 'F3D-0050', accessToken: 'a'.repeat(32), paid: false, paymentMethod: 'transferencia', total: 28.9, shipping: 3.9, notes: '',
  items: [{ name: 'Gato <b>', qty: 2, price: 12.5, color: '#E8C4FF' }],
  customer: { name: 'Ana', email: 'ana@correo.es', phone: '600', address: { street: 'Calle Mayor 1', zip: '28013', city: 'Madrid', province: 'Madrid' } },
  ...extra,
});

function setup(transport) {
  const sent = [];
  const mailer = createMailer({
    transport: transport === null ? null : (transport || { sendMail: async m => { sent.push(m); } }),
    from: 'tienda@dream3d.es', ownerTo: 'yo@dream3d.es', siteUrl: 'https://dream3d.es', getSite: async () => site,
  });
  return { mailer, sent };
}

test('transfer order: customer gets the bank details and order link, owner gets a notice', async () => {
  const { mailer, sent } = setup();
  await mailer.orderReceived(order());
  assert.equal(sent.length, 2);
  const [customer, owner] = sent;
  assert.equal(customer.to, 'ana@correo.es');
  assert.equal(customer.replyTo, 'hola@dream3d.es');
  assert.match(customer.subject, /Pedido F3D-0050 recibido/);
  assert.match(customer.text, /ES91 2100 0418 4502 0005 1332/);
  assert.match(customer.text, /Concepto: F3D-0050/);
  assert.match(customer.text, /https:\/\/dream3d\.es\/pedido\/F3D-0050\?t=a{32}/);
  assert.match(customer.text, /Total: 28,90/);
  assert.match(customer.html, /Gato &lt;b&gt;/, 'HTML escapes product and customer text');
  assert.equal(owner.to, 'yo@dream3d.es');
  assert.match(owner.text, /ana@correo\.es · 600/);
});

test('payment received: customer always; owner only when not triggered by the owner', async () => {
  const { mailer, sent } = setup();
  await mailer.paymentReceived(order({ paid: true, paymentMethod: 'tarjeta' }));
  assert.deepEqual(sent.map(m => m.to), ['ana@correo.es', 'yo@dream3d.es']);
  assert.match(sent[0].subject, /Pago recibido/);
  assert.doesNotMatch(sent[0].text, /IBAN/);

  sent.length = 0;
  await mailer.paymentReceived(order({ paid: true }), { owner: false });
  assert.deepEqual(sent.map(m => m.to), ['ana@correo.es']);
});

test('shipped: customer gets the tracking code and carrier link; nothing without an email', async () => {
  const { mailer, sent } = setup();
  site.trackingUrl = 'https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number={code}';
  assert.equal(await mailer.orderShipped(order({ paid: true, trackingCode: 'PQ4F6P0712345670128001X' })), true);
  assert.equal(sent.length, 1, 'no owner notice: the owner shipped it');
  assert.match(sent[0].subject, /F3D-0050 está en camino/);
  assert.match(sent[0].text, /Código de seguimiento: PQ4F6P0712345670128001X/);
  assert.match(sent[0].text, /tracking-number=PQ4F6P0712345670128001X/);
  assert.equal(await mailer.orderShipped(order({ trackingCode: 'X', customer: { name: 'Sin correo' } })), false);

  assert.equal(trackingLink('https://t.es/?n={code}', 'A B'), 'https://t.es/?n=A%20B');
  assert.equal(trackingLink('', 'ABC'), '');
});

test('no email address, no SMTP, or a failing SMTP never breaks the order flow', async () => {
  const { mailer, sent } = setup();
  await mailer.paymentReceived(order({ customer: { name: 'Sin correo' } }));
  assert.deepEqual(sent.map(m => m.to), ['yo@dream3d.es']);

  await setup(null).mailer.orderReceived(order());

  const original = console.error;
  console.error = () => {};
  await setup({ sendMail: async () => { throw new Error('SMTP caído'); } }).mailer.orderReceived(order());
  console.error = original;
});
