/**
 * Payments: Stripe Checkout (card, Apple Pay, Google Pay; Stripe hosts the card form) and bank transfer.
 * The Stripe client and repositories are injected, like the database, so tests run with fakes.
 * Amounts always come from the database: whatever the browser sends as a price is ignored.
 */
const MAX_LINES = 30;
const MAX_QTY = 20;
const cents = n => Math.round(Number(n) * 100);
const money = n => Math.round(Number(n) * 100) / 100;

function userError(message, status = 400) {
  return Object.assign(new Error(message), { status, expose: true });
}

function createPayments({ stripe = null, webhookSecret = '', repos, siteUrl, shipping, onPaid = async () => {} }) {
  // cart items from the browser: only product id and quantity are trusted (after checks)
  async function priceCart(items) {
    if (!Array.isArray(items) || !items.length) throw userError('El carrito está vacío.');
    if (items.length > MAX_LINES) throw userError('Demasiados productos en un solo pedido.');
    const lines = [];
    for (const it of items) {
      const p = await repos.products.get(Number(it && it.id));
      if (!p || !p.active || !(p.price > 0)) throw userError('Algún producto ya no está disponible. Revisa el carrito.');
      const qty = Number(it.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw userError('Cantidad no válida.');
      lines.push({ productId: p.id, name: p.name, qty, price: p.price });
    }
    const subtotal = money(lines.reduce((s, l) => s + l.price * l.qty, 0));
    const ship = subtotal >= shipping.freeFrom ? 0 : shipping.cost;
    return { lines, subtotal, shipping: ship, total: money(subtotal + ship) };
  }

  // a new Checkout Session each time: they expire, the customer's order page link does not
  async function checkoutUrl(order) {
    if (!stripe) throw userError('El pago con tarjeta no está disponible.', 503);
    if (order.paid) throw userError('Este pedido ya está pagado.', 409);
    const lineItems = order.items.map(i => ({
      quantity: i.qty,
      price_data: {
        currency: 'eur',
        unit_amount: cents(i.price),
        product_data: { name: i.name },
      },
    }));
    if (order.shipping > 0) {
      lineItems.push({ quantity: 1, price_data: { currency: 'eur', unit_amount: cents(order.shipping), product_data: { name: 'Envío' } } });
    }
    const back = `${siteUrl}/pedido/${order.id}?t=${order.accessToken}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      locale: 'es',
      client_reference_id: order.id,
      metadata: { order: order.id },
      ...(order.customer && order.customer.email ? { customer_email: order.customer.email } : {}),
      success_url: `${back}&pago=ok`,
      cancel_url: `${back}&pago=cancelado`,
      expires_at: Math.floor(Date.now() / 1000) + 23 * 3600,
    });
    await repos.orders.update(order.id, { paymentMethod: 'tarjeta', paymentRef: session.id });
    return session.url;
  }

  // Stripe → us. The signature check is what makes "paid" trustworthy; the redirect back never marks anything.
  async function handleWebhook(rawBody, signature) {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const s = event.data.object;
      if (s.payment_status === 'paid') {
        const order = await repos.orders.get(s.metadata && s.metadata.order);
        if (order && s.amount_total === cents(order.total)) {
          const paid = await repos.orders.markPaid(order.id, { method: 'tarjeta', ref: s.payment_intent || s.id });
          if (paid) await onPaid(paid); // Stripe retries webhooks: only the first delivery gets here
        } else {
          console.error(`Pago de Stripe ${s.id} sin pedido o con importe distinto: revisarlo en el panel de Stripe`);
        }
      }
    }
    return event.type;
  }

  return { cardEnabled: !!stripe, priceCart, checkoutUrl, handleWebhook };
}

module.exports = { createPayments, userError };
