// shortcut: accounts are not real yet (any email logs in, nothing is stored); replace before taking real customer accounts
const AuthView = {
  renderLogin() {
    return `
<div id="view-login" class="view active">
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-logo">${siteText('brandName')}</div>
      <h1>Bienvenido de nuevo</h1>
      <p class="auth-sub">Inicia sesión para ver tus pedidos y gestionar tu perfil.</p>
      <div class="form-group"><label for="loginEmail">Correo electrónico</label><input type="email" id="loginEmail" autocomplete="email" placeholder="tu@correo.com"></div>
      <div class="form-group"><label for="loginPass">Contraseña</label><input type="password" id="loginPass" autocomplete="current-password" placeholder="••••••••"></div>
      <div class="form-group">
        <button class="btn-primary" onclick="AuthView.login()">Iniciar sesión</button>
      </div>
      <div class="auth-footer">¿No tienes cuenta? <a href="/registro" data-link>Regístrate gratis</a></div>
    </div>
  </div>
</div>`;
  },

  renderRegister() {
    return `
<div id="view-register" class="view active">
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-logo">${siteText('brandName')}</div>
      <h1>Crear cuenta</h1>
      <p class="auth-sub">Regístrate para seguir tus pedidos y comprar más rápido.</p>
      <div class="form-group"><label for="regName">Nombre</label><input type="text" id="regName" autocomplete="name" placeholder="Tu nombre"></div>
      <div class="form-group"><label for="regEmail">Correo electrónico</label><input type="email" id="regEmail" autocomplete="email" placeholder="tu@correo.com"></div>
      <div class="form-group"><label for="regPass">Contraseña</label><input type="password" id="regPass" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></div>
      <div class="form-group"><button class="btn-primary" onclick="AuthView.register()">Crear cuenta</button></div>
      <div class="auth-footer">¿Ya tienes cuenta? <a href="/entrar" data-link>Inicia sesión</a></div>
    </div>
  </div>
</div>`;
  },

  login() {
    const email = document.getElementById('loginEmail')?.value.trim();
    if (!email) return;
    App.session.set({ name: email.split('@')[0], email });
    App.navigate('profile');
  },

  register() {
    const name  = document.getElementById('regName')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    if (!name || !email) return;
    App.session.set({ name, email });
    App.navigate('profile');
  },
};
