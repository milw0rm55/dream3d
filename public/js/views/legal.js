/**
 * Legal pages (LSSI-CE, RGPD/LOPDGDD) and 404.
 * Owner data comes from admin → Web; missing fields are flagged so they can't go live unnoticed.
 * These texts are a reasonable base, not legal advice: have them reviewed before going live.
 */
const LegalView = {
  _field(key, label) {
    return SITE[key] ? siteText(key) : `<mark class="legal-missing">[pendiente: ${label}]</mark>`;
  },

  _owner() {
    return {
      name: this._field('legalOwner', 'nombre y apellidos del titular'),
      nif: this._field('legalNif', 'NIF'),
      address: this._field('legalAddress', 'domicilio'),
      email: this._field('legalEmail', 'correo de contacto legal'),
      site: escapeHtml(location.host),
      brand: siteText('brandName'),
    };
  },

  _page(title, body) {
    return `
<div class="view active" id="view-legal">
  <article class="legal-wrap">
    <h1>${title}</h1>
    <p class="legal-updated">Última actualización: ${new Date().getFullYear()}</p>
    ${body}
  </article>
</div>`;
  },

  aviso() {
    const o = this._owner();
    return this._page('Aviso legal', `
      <h2>Titular de la web</h2>
      <p>En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se informa de los datos del titular de <strong>${o.site}</strong> (en adelante, «${o.brand}»):</p>
      <ul>
        <li>Titular: ${o.name}</li>
        <li>NIF: ${o.nif}</li>
        <li>Domicilio: ${o.address}</li>
        <li>Correo electrónico: ${o.email}</li>
      </ul>

      <h2>Objeto</h2>
      <p>Esta web da a conocer y permite encargar figuras y objetos impresos en 3D. El acceso es gratuito y supone la aceptación de este aviso legal.</p>

      <h2>Uso de la web</h2>
      <p>Te comprometes a usar la web de forma lícita, sin dañar su funcionamiento ni los derechos de terceros, y a no enviar contenidos ofensivos o ilegales en formularios y reseñas. Podemos retirar las reseñas que incumplan estas normas.</p>

      <h2>Propiedad intelectual</h2>
      <p>Los textos, fotografías, diseños, modelos 3D y el aspecto de la web pertenecen a su titular o se usan con permiso. No está permitido copiarlos, distribuirlos ni usarlos con fines comerciales sin autorización. Los modelos que nos envíes para imprimir siguen siendo tuyos: confirmas que tienes derecho a usarlos.</p>

      <h2>Responsabilidad</h2>
      <p>Intentamos que la información sea correcta y esté actualizada, pero no garantizamos la ausencia de errores ni la disponibilidad continua de la web. No nos hacemos responsables del contenido de las webs externas enlazadas (por ejemplo, WhatsApp o redes sociales).</p>

      <h2>Legislación y jurisdicción</h2>
      <p>Este aviso se rige por la legislación española. Si eres consumidor, son competentes los juzgados de tu domicilio.</p>`);
  },

  privacidad() {
    const o = this._owner();
    return this._page('Política de privacidad', `
      <h2>Responsable del tratamiento</h2>
      <p>${o.name} · NIF ${o.nif} · ${o.address} · ${o.email}</p>

      <h2>Qué datos tratamos y para qué</h2>
      <table class="legal-table">
        <thead><tr><th>Cuándo</th><th>Datos</th><th>Finalidad</th><th>Base legal</th><th>Conservación</th></tr></thead>
        <tbody>
          <tr><td>Formulario de contacto</td><td>Nombre, correo, mensaje</td><td>Responderte</td><td>Tu consentimiento</td><td>Hasta resolver tu consulta y un máximo de 1 año</td></tr>
          <tr><td>Pedidos</td><td>Nombre, contacto, dirección de envío, productos</td><td>Preparar, enviar y cobrar tu pedido</td><td>Ejecución del contrato y obligaciones legales</td><td>El plazo que exige la ley fiscal y mercantil (hasta 6 años)</td></tr>
          <tr><td>Reseñas</td><td>Nombre o apodo, valoración y comentario</td><td>Publicarlas en la ficha del producto, tras revisarlas</td><td>Tu consentimiento</td><td>Hasta que pidas retirarlas</td></tr>
          <tr><td>WhatsApp</td><td>Tu número y la conversación</td><td>Atender tu pedido o consulta</td><td>Tu consentimiento al escribirnos</td><td>Hasta terminar el pedido o la consulta</td></tr>
          <tr><td>Pago con tarjeta</td><td>Datos de la tarjeta o de Apple Pay / Google Pay</td><td>Cobrar el pedido</td><td>Ejecución del contrato</td><td>Los guarda Stripe según sus obligaciones legales; nosotros nunca vemos ni guardamos tu tarjeta</td></tr>
        </tbody>
      </table>
      <p>Los pagos con tarjeta los procesa Stripe Payments Europe, Ltd. (Irlanda) en su propia página segura, como encargado del tratamiento y con su propia política de privacidad.</p>
      <p>Al escribirnos por WhatsApp, el servicio lo presta WhatsApp Ireland Limited (grupo Meta), que aplica su propia política de privacidad y puede tratar datos fuera del Espacio Económico Europeo.</p>

      <h2>Estadísticas de visitas</h2>
      <p>Contamos las visitas de forma anónima y sin cookies: solo guardamos la página vista, el día y, si llegas desde otra web, el nombre de esa web. No guardamos tu IP ni ningún identificador, así que estos datos no permiten saber quién eres. Si tu navegador envía la señal «Do Not Track» o «Global Privacy Control», no contamos tu visita.</p>

      <h2>A quién se comunican</h2>
      <p>No vendemos ni cedemos tus datos. Solo los conocen, cuando hace falta, la empresa de transporte que entrega tu pedido y el proveedor de correo electrónico que usamos para responderte. La web se aloja en un servidor gestionado por el titular y no carga servicios de terceros mientras navegas.</p>

      <h2>Tus derechos</h2>
      <p>Puedes pedir acceso, rectificación, supresión, oposición, limitación o portabilidad de tus datos, y retirar tu consentimiento en cualquier momento, escribiendo a ${o.email}. Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>).</p>

      <h2>Menores de 14 años</h2>
      <p>Si tienes menos de 14 años, necesitas permiso de tu madre, padre o tutor para enviarnos tus datos.</p>`);
  },

  condiciones() {
    const o = this._owner();
    const ship = formatPrice(SITE.shippingCost);
    const free = formatPrice(SITE.freeShippingFrom);
    return this._page('Condiciones de venta', `
      <h2>Quién vende</h2>
      <p>${o.name} · NIF ${o.nif} · ${o.address} · ${o.email}. Estas condiciones se aplican a las compras hechas en ${o.site} por consumidores residentes en España.</p>

      <h2>Productos y precios</h2>
      <p>Los precios se muestran en euros y son finales, con los impuestos aplicables incluidos. ${Number(SITE.freeShippingFrom) > 0 ? `Los gastos de envío son de ${ship} por pedido y gratis a partir de ${free}; se muestran siempre antes de pagar.` : 'El envío a la península y Baleares es gratis.'} Las fotos son orientativas: al ser piezas impresas una a una, pueden tener pequeñas diferencias de acabado.</p>

      <h2>Cómo se hace un pedido</h2>
      <p>Añades las figuras al carrito, indicas tus datos de envío, eliges la forma de pago y aceptas estas condiciones. Al confirmar recibes un número de pedido y un enlace para consultarlo. El contrato queda formalizado cuando el pago se confirma. Los encargos personalizados se acuerdan antes por WhatsApp o correo y se pagan desde el enlace del pedido.</p>

      <h2>Formas de pago</h2>
      <ul>
        <li><strong>Tarjeta, Apple Pay o Google Pay</strong>, en la página segura de Stripe. No vemos ni guardamos los datos de tu tarjeta.</li>
        <li><strong>Transferencia bancaria</strong>: preparamos el pedido cuando la recibimos. Si no llega en 7 días, el pedido se cancela.</li>
      </ul>

      <h2>Plazos y envío</h2>
      <p>${siteText('deliveryTime')} Enviamos a la península y Baleares; para Canarias, Ceuta y Melilla consúltanos antes. Si hubiera un retraso, te avisaremos y podrás cancelar el pedido con reembolso completo.</p>

      <h2>Derecho de desistimiento</h2>
      <p>Tienes 14 días naturales desde que recibes el pedido para devolverlo sin dar ninguna explicación. Para ejercerlo, escríbenos a ${o.email} (puedes usar el modelo de abajo). Te devolveremos el importe pagado, incluido el envío estándar, en un máximo de 14 días desde que nos lo comuniques y por el mismo medio de pago; podemos esperar a recibir el producto. Los gastos de devolución corren de tu cuenta y el producto debe llegar en buen estado.</p>
      <p><strong>Excepción:</strong> no hay derecho de desistimiento en los productos hechos según tus especificaciones o claramente personalizados (diseños a medida, figuras a partir de tu archivo o tu idea), según el artículo 103 de la Ley General para la Defensa de los Consumidores y Usuarios.</p>
      <p><em>Modelo de desistimiento:</em> «A la atención de ${o.name}, ${o.address}, ${o.email}: le comunico que desisto de mi contrato de venta del siguiente bien: [producto], pedido [número], recibido el [fecha]. Nombre: [tu nombre]. Domicilio: [tu domicilio]. Fecha y firma (solo si se envía en papel).»</p>

      <h2>Garantía</h2>
      <p>Todos los productos tienen la garantía legal de 3 años por falta de conformidad. Si una figura llega rota o con un defecto, escríbenos con una foto y la repondremos o te devolveremos el dinero, sin coste para ti.</p>

      <h2>Atención al cliente y reclamaciones</h2>
      <p>Puedes contactarnos en ${o.email} o por WhatsApp; respondemos en menos de 24 horas laborables. Si no quedas satisfecho, puedes acudir a los servicios de consumo de tu comunidad autónoma o a la Junta Arbitral de Consumo.</p>

      <h2>Ley aplicable</h2>
      <p>Estas condiciones se rigen por la ley española. Si eres consumidor, son competentes los juzgados de tu domicilio.</p>`);
  },

  cookies() {
    return this._page('Política de cookies', `
      <h2>Esta web no usa cookies</h2>
      <p>No usamos cookies de análisis, publicidad ni redes sociales, y no cargamos servicios de terceros que las instalen. Las estadísticas de visitas son anónimas y no necesitan cookies (ver la <a href="/privacidad" data-link>política de privacidad</a>).</p>

      <h2>Qué guardamos en tu navegador</h2>
      <p>Solo guardamos en el almacenamiento local de tu navegador las preferencias que eliges tú. Son técnicas y no requieren consentimiento:</p>
      <table class="legal-table">
        <thead><tr><th>Nombre</th><th>Para qué</th><th>Duración</th></tr></thead>
        <tbody>
          <tr><td><code>dream3d-theme</code></td><td>Recordar si prefieres el modo claro, oscuro o automático</td><td>Hasta que la borres</td></tr>
          <tr><td><code>dream3d-notice</code></td><td>No volver a mostrarte el aviso de cookies</td><td>Hasta que la borres</td></tr>
        </tbody>
      </table>
      <p>Puedes borrar estos datos desde la configuración de tu navegador («Borrar datos de navegación» o «Datos de sitios web»).</p>

      <h2>Enlaces externos</h2>
      <p>Si pulsas un enlace a WhatsApp, Instagram o TikTok, sales de esta web y se aplican las cookies y la política de privacidad de ese servicio.</p>`);
  },
};

const NotFoundView = {
  render() {
    return `
<div class="view active" id="view-notfound">
  <div class="notfound-wrap">
    <p class="notfound-code" aria-hidden="true">404</p>
    <h1>Esta página no existe</h1>
    <p>Puede que el enlace esté mal escrito o que el producto ya no esté disponible.</p>
    <div class="notfound-actions">
      <a class="btn-primary" href="/" data-link>ver el catálogo</a>
      <a class="btn-ghost" data-wa href="${escapeHtml(waLink('Hola, buscaba algo en la web y no lo encuentro'))}" target="_blank" rel="noopener">pregúntame por whatsapp</a>
    </div>
  </div>
</div>`;
  },
};

// Informative notice: the site only stores user-chosen preferences, so no consent is needed
const CookieNotice = {
  KEY: 'dream3d-notice',
  show() {
    try { if (localStorage.getItem(this.KEY)) return; } catch (e) { return; }
    const el = document.createElement('div');
    el.className = 'cookie-notice';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Aviso de cookies');
    el.innerHTML = `
      <p>Esta web no usa cookies de seguimiento ni publicidad. Solo guarda en tu navegador las preferencias que eliges, como el modo oscuro. <a href="/cookies" data-link>Más información</a></p>
      <button type="button" class="btn-ghost">entendido</button>`;
    el.querySelector('button').addEventListener('click', () => {
      try { localStorage.setItem(this.KEY, '1'); } catch (e) { /* private mode */ }
      el.remove();
    });
    document.body.appendChild(el);
  },
};
