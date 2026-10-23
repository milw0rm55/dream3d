/**
 * Order emails: confirmation to the customer and a notice to the shop owner.
 * The transport is injected (nodemailer in production, a fake in tests). Sending never blocks or breaks an order:
 * failures are logged and the order page link still has all the information.
 */
const eur = n => Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function createMailer({ transport = null, from = '', ownerTo = '', siteUrl, getSite }) {
  const mailer = { transport };

  const orderUrl = o => `${siteUrl}/pedido/${o.id}?t=${o.accessToken}`;

  async function send(message) {
    if (!mailer.transport) return false;
    try {
      await mailer.transport.sendMail({ from, ...message });
      return true;
    } catch (err) {
      console.error(`No se pudo enviar el correo «${message.subject}»:`, String(err.message || err).slice(0, 200));
      return false;
    }
  }

  // same content as plain text and as minimal HTML (escaped: names and addresses come from customers)
  function compose(paragraphs, o, site) {
    const lines = o.items.map(i => [`${i.name}${i.qty > 1 ? ` × ${i.qty}` : ''}`, eur(i.price * i.qty)]);
    lines.push(['Envío', o.shipping ? eur(o.shipping) : 'Gratis'], ['Total', eur(o.total)]);
    const a = o.customer.address;
    const address = a ? `${o.customer.name}, ${a.street}, ${a.zip} ${a.city} (${a.province})` : '';
    const signature = `${site.brandName} · ${siteUrl.replace(/^https?:\/\//, '')}`;

    const text = [
      ...paragraphs.map(p => (Array.isArray(p) ? p.map(([k, v]) => `${k}: ${v}`).join('\n') : p)),
      lines.map(([k, v]) => `${k}: ${v}`).join('\n'),
      address && `Envío a: ${address}`,
      `Consulta tu pedido: ${orderUrl(o)}`,
      'Si tienes cualquier duda, responde a este correo.',
      signature,
    ].filter(Boolean).join('\n\n');

    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0A0A0A;max-width:560px">
      ${paragraphs.map(p => (Array.isArray(p)
        ? `<table style="border-collapse:collapse;margin:8px 0">${p.map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;color:#5E5E5A">${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`).join('')}</table>`
        : `<p>${esc(p)}</p>`)).join('')}
      <table style="border-collapse:collapse;width:100%;margin:16px 0">${lines.map(([k, v], i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #E2E0DA${i === lines.length - 1 ? ';font-weight:600' : ''}">${esc(k)}</td><td style="padding:6px 0;border-bottom:1px solid #E2E0DA;text-align:right${i === lines.length - 1 ? ';font-weight:600' : ''}">${esc(v)}</td></tr>`).join('')}</table>
      ${address ? `<p>Envío a: ${esc(address)}</p>` : ''}
      <p><a href="${esc(orderUrl(o))}" style="display:inline-block;padding:10px 18px;background:#0A0A0A;color:#fff;border-radius:6px;text-decoration:none">Ver mi pedido</a></p>
      <p style="color:#5E5E5A">Si tienes cualquier duda, responde a este correo.<br>${esc(signature)}</p>
    </div>`;
    return { text, html };
  }

  async function notifyOwner(subject, o) {
    if (!ownerTo) return;
    const c = o.customer;
    await send({
      to: ownerTo,
      subject,
      text: [
        `Pedido ${o.id} · ${eur(o.total)} · ${o.paid ? 'PAGADO' : 'pendiente de pago'} (${o.paymentMethod})`,
        o.items.map(i => `- ${i.name} × ${i.qty}${i.color ? ` · color ${i.color}` : ''}`).join('\n'),
        `Cliente: ${c.name} · ${c.email || 'sin correo'} · ${c.phone || 'sin teléfono'}`,
        c.address ? `Envío: ${c.address.street}, ${c.address.zip} ${c.address.city} (${c.address.province})` : '',
        o.notes ? `Notas: ${o.notes}` : '',
        `Admin: ${siteUrl}/admin`,
      ].filter(Boolean).join('\n\n'),
    });
  }

  // bank transfer orders: the customer needs the payment details right away
  mailer.orderReceived = async o => {
    const site = await getSite();
    if (o.customer.email) {
      const bank = o.paymentMethod === 'transferencia' && site.bankIban
        ? ['Para completarlo, haz una transferencia con estos datos:',
           [['Titular', site.bankHolder || '—'], ['IBAN', site.bankIban.replace(/(.{4})/g, '$1 ').trim()], ['Importe', eur(o.total)], ['Concepto', o.id]],
           'Preparamos tu pedido en cuanto la recibamos. Si no llega en 7 días, el pedido se cancela.']
        : [];
      await send({
        to: o.customer.email,
        replyTo: site.email || ownerTo || undefined,
        subject: `Pedido ${o.id} recibido · ${site.brandName}`,
        ...compose([`Hola ${o.customer.name}:`, `Gracias por tu pedido ${o.id}.`, ...bank, site.deliveryTime], o, site),
      });
    }
    await notifyOwner(`Nuevo pedido ${o.id} (${o.paymentMethod}, pendiente de pago)`, o);
  };

  // owner: false when the owner marked it paid themselves in the admin
  mailer.paymentReceived = async (o, { owner = true } = {}) => {
    const site = await getSite();
    if (o.customer.email) {
      await send({
        to: o.customer.email,
        replyTo: site.email || ownerTo || undefined,
        subject: `Pago recibido · pedido ${o.id} · ${site.brandName}`,
        ...compose([`Hola ${o.customer.name}:`, `Hemos recibido el pago de tu pedido ${o.id}. ¡Gracias!`, site.deliveryTime], o, site),
      });
    }
    if (owner) await notifyOwner(`Pedido ${o.id} pagado (${o.paymentMethod}) · ${eur(o.total)}`, o);
  };

  mailer.orderShipped = async o => {
    if (!o.customer.email) return false;
    const site = await getSite();
    const url = trackingLink(site.trackingUrl, o.trackingCode);
    return send({
      to: o.customer.email,
      replyTo: site.email || ownerTo || undefined,
      subject: `Tu pedido ${o.id} está en camino · ${site.brandName}`,
      ...compose([
        `Hola ${o.customer.name}:`,
        `¡Tu pedido ${o.id} ya ha salido! Puedes seguirlo con este código:`,
        [['Código de seguimiento', o.trackingCode], ...(url ? [['Seguimiento', url]] : [])],
        'El envío suele tardar de 2 a 5 días laborables. Si cuando llegue algo no está bien, responde a este correo con una foto.',
      ], o, site),
    });
  };

  return mailer;
}

// carrier tracking page from a template like https://…?tracking-number={code}
function trackingLink(template, code) {
  return template && code && template.includes('{code}') ? template.replace('{code}', encodeURIComponent(code)) : '';
}

module.exports = { createMailer, trackingLink };
