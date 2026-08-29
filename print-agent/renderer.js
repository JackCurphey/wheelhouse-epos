const main = document.getElementById('main');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtAgo(ts) {
  if (!ts) return 'never yet';
  return `${Math.round((Date.now() - ts) / 1000)}s ago`;
}

function renderLoggedOut(status, error) {
  main.innerHTML = `
    <p class="intro">Sign in with the shop's normal login to let this PC serve print jobs from anywhere the shop's browsers are used.</p>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    <form id="login-form">
      <label>Email <input name="email" type="email" required autofocus /></label>
      <label>Password <input name="password" type="password" required /></label>
      <button type="submit" id="login-btn">Sign in</button>
    </form>
  `;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const fd = new FormData(e.target);
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    const result = await window.printAgent.login(fd.get('email'), fd.get('password'));
    if (!result.ok) {
      render(status, result.error);
      return;
    }
    refresh();
  });
}

function renderLoggedIn(status) {
  main.innerHTML = `
    <div class="status-row">
      <div class="row"><span>Signed in as</span><span>${esc(status.loggedInAs)}${status.shopName ? ` (${esc(status.shopName)})` : ''}</span></div>
      <div class="row"><span>This PC</span><span>${esc(status.deviceName)}</span></div>
      <div class="row"><span>Printers detected</span><span>${status.printers.length ? esc(status.printers.join(', ')) : 'none'}</span></div>
      <div class="row"><span>Last check-in</span><span>${fmtAgo(status.lastCheckin)}</span></div>
    </div>
    ${status.lastError ? `<p class="error">${esc(status.lastError)}</p>` : ''}
    <button class="ghost" id="signout-btn">Sign out</button>
  `;
  document.getElementById('signout-btn').addEventListener('click', async () => {
    await window.printAgent.logout();
    refresh();
  });
}

function render(status, error) {
  if (status.loggedIn) renderLoggedIn(status);
  else renderLoggedOut(status, error);
}

// The logged-in status view is safe to re-render on a timer (nothing but
// read-only text). The login form isn't - re-rendering it mid-poll would
// wipe out whatever the user is currently typing. So once the login form
// is showing, the poll loop only touches the DOM again for an actual
// state change (a successful login, or a push from onStatusChanged), never
// just because 2 seconds passed.
async function refresh() {
  const status = await window.printAgent.getStatus();
  if (status.loggedIn) {
    renderLoggedIn(status);
  } else if (!document.getElementById('login-form')) {
    renderLoggedOut(status, null);
  }
}

window.printAgent.onStatusChanged(refresh);

refresh();
setInterval(refresh, 2000);
