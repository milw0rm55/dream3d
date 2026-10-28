const ProfileView = {
  _activeTab: 'orders',

  render(palette) {
    const user = App.session.get();
    if (!user) { App.navigate('login'); return ''; }

    const blobSvg = Blobatar.generate(user.email || user.name, palette, 80);

    // shortcut: no real accounts yet, so there is no order history to show; wire to the orders table with real login
    const ordersHtml = `<p class="reviews-empty">Aún no tienes pedidos. Cuando pidas una figura, aparecerá aquí.</p>`;

    return `
<div id="view-profile" class="view active">
  <div class="profile-wrap">
    <div class="profile-header">
      <div class="profile-blobatar">${blobSvg}</div>
      <div>
        <p class="profile-name">${escapeHtml(user.name)}</p>
        <p class="profile-email">${escapeHtml(user.email || '')}</p>
      </div>
    </div>

    <div class="profile-tabs">
      <button class="profile-tab active" onclick="ProfileView.switchTab('orders',this)">Mis pedidos</button>
      <button class="profile-tab" onclick="ProfileView.switchTab('data',this)">Mis datos</button>
      <button class="profile-tab" onclick="ProfileView.switchTab('addresses',this)">Direcciones</button>
    </div>

    <div class="tab-panel active" id="tab-orders">
      <div class="orders-list">${ordersHtml}</div>
    </div>

    <div class="tab-panel" id="tab-data">
      <div class="profile-form-grid">
        <div class="form-group"><label for="pfName">Nombre</label><input type="text" id="pfName" name="name" autocomplete="name" value="${escapeHtml(user.name)}"></div>
        <div class="form-group"><label for="pfEmail">Email</label><input type="email" id="pfEmail" name="email" autocomplete="email" value="${escapeHtml(user.email || '')}"></div>
        <div class="form-group"><label for="pfPhone">Teléfono</label><input type="tel" id="pfPhone" name="phone" autocomplete="tel" placeholder="+34 600 000 000"></div>
        <div class="form-group"><label for="pfCity">Ciudad</label><input type="text" id="pfCity" name="city" autocomplete="address-level2" placeholder="Madrid"></div>
        <div class="form-group full"><label for="pfPass">Nueva contraseña</label><input type="password" id="pfPass" name="new-password" autocomplete="new-password" placeholder="Déjalo vacío para no cambiarla"></div>
      </div>
      <button class="btn-yellow" style="margin-top:.5rem">Guardar cambios</button>
      <button class="logout-btn" onclick="ProfileView.logout()">Cerrar sesión</button>
    </div>

    <div class="tab-panel" id="tab-addresses">
      <div class="form-group"><label for="adStreet">Dirección</label><input type="text" id="adStreet" name="street" autocomplete="street-address" placeholder="Calle Mayor 12, 3.º B"></div>
      <div class="profile-form-grid" style="margin-top:1rem">
        <div class="form-group"><label for="adCity">Ciudad</label><input type="text" id="adCity" name="city" autocomplete="address-level2" placeholder="Madrid"></div>
        <div class="form-group"><label for="adZip">Código postal</label><input type="text" id="adZip" name="zip" autocomplete="postal-code" inputmode="numeric" placeholder="28013"></div>
        <div class="form-group"><label for="adProvince">Provincia</label><input type="text" id="adProvince" name="province" autocomplete="address-level1" placeholder="Madrid"></div>
        <div class="form-group"><label for="adCountry">País</label><input type="text" id="adCountry" name="country" autocomplete="country-name" value="España"></div>
      </div>
      <button class="btn-yellow" style="margin-top:.5rem">Guardar dirección</button>
    </div>
  </div>
</div>`;
  },

  switchTab(name, btn) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const panel = document.getElementById('tab-' + name);
    if (panel) panel.classList.add('active');
    this._activeTab = name;
  },

  logout() {
    App.session.clear();
    App.navigate('login');
  },
};
