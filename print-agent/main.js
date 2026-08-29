// Wheelhouse Print Agent - Electron main process.
//
// Runs natively on a shop PC (never inside Docker: a Linux container has no
// access to Windows-installed printers at all). Logs into the shop's normal
// staff account once, then polls the central server for queued print jobs
// and runs them through the OS's own printer drivers via print-label.ps1.
// Any shop PC running this and signed in can serve a print job sent from
// any browser anywhere - the browser doesn't need to be on the same
// machine as the printer, since both sides only ever talk to the shop's
// own server, never to each other directly.
//
// Deliberately dumb about labels: public/app.js computes a plain list of
// mm-positioned rectangles and text strings (buildStickerPrintJob) and
// hands them over via the server; this and print-label.ps1 hold no barcode
// or layout logic of their own.
//
// Structured like the sibling epos-control-panel app (main.js/preload.js/
// renderer.js split, contextBridge, nodeIntegration: false) for the same
// reason it's used there - the window never gets raw Node access, only the
// specific login/logout/getStatus calls exposed below.
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const { execFile } = require('child_process');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PRINT_SCRIPT = path.join(__dirname, 'print-label.ps1');
const SESSION_FILE = path.join(app.getPath('userData'), 'session.json');

const SERVER_URL = (process.env.WHEELHOUSE_SERVER_URL || 'https://epos.jackcurphey.com').replace(/\/$/, '');
const CHECKIN_INTERVAL_MS = 2500;
const PRINTER_REFRESH_INTERVAL_MS = 30000;
const PS_TIMEOUT_MS = 20000;

const startedHidden = process.argv.includes('--hidden');

// ---------- Session (device identity + shop login) ----------

function loadSession() {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    return JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
  } catch (err) {
    return null;
  }
}

function saveSession(s) {
  mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2), 'utf8');
}

let session = loadSession();
const isFirstRun = !session;
if (!session) {
  session = { deviceId: crypto.randomBytes(12).toString('hex'), deviceName: os.hostname(), cookie: null };
  saveSession(session);
}

async function login(email, password) {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed');
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie()[0] : res.headers.get('set-cookie');
  if (!setCookie) throw new Error('Server did not return a session');
  session.cookie = setCookie.split(';')[0]; // just "wh_session=<token>", not the Path/HttpOnly/etc. attributes
  session.shopName = data.shopName;
  session.loggedInAs = data.email;
  saveSession(session);
  app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: ['--hidden'] });
}

function logout() {
  session.cookie = null;
  saveSession(session);
}

// ---------- Talking to printers ----------

function runPowerShell(args) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args],
      { windowsHide: true, timeout: PS_TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr && stderr.trim()) || err.message));
        resolve(stdout);
      }
    );
  });
}

// Get-Printer's name list comes back from ConvertTo-Json as a bare string
// (not a one-item array) when there's exactly one printer, and as nothing
// at all when there are none - normalize both to a plain array.
function normalizePrinterList(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [];
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return [];
  }
  if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string' && x);
  if (typeof parsed === 'string') return [parsed];
  return [];
}

async function getPrinters() {
  try {
    const stdout = await runPowerShell(['-Command', 'Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json']);
    return normalizePrinterList(stdout);
  } catch (err) {
    console.error('Could not list printers:', err.message);
    return [];
  }
}

async function runJob(job) {
  const tmpFile = path.join(os.tmpdir(), `wheelhouse-label-${crypto.randomBytes(8).toString('hex')}.json`);
  writeFileSync(tmpFile, JSON.stringify(job), 'utf8');
  try {
    await runPowerShell(['-File', PRINT_SCRIPT, '-DataFile', tmpFile]);
  } finally {
    try {
      require('fs').unlinkSync(tmpFile);
    } catch (err) {
      // best-effort cleanup
    }
  }
}

// ---------- Check-in loop ----------
// Printer detection runs on its own slower interval, separate from the
// fast check-in/job-poll loop - which printers exist changes rarely, so
// re-running Get-Printer every 2.5s would just be a steady drumbeat of
// powershell.exe spawns for no benefit, and adds needless contention risk
// (observed during testing: several concurrent PowerShell invocations on
// one machine can occasionally miss the timeout under that load).

let lastCheckin = null;
let lastPrinters = [];
let lastError = null;

async function refreshPrinters() {
  lastPrinters = await getPrinters();
}

async function checkinOnce() {
  let res;
  try {
    res = await fetch(`${SERVER_URL}/api/print-agents/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
      body: JSON.stringify({ deviceId: session.deviceId, deviceName: session.deviceName, printers: lastPrinters }),
    });
  } catch (err) {
    lastError = `Can't reach ${SERVER_URL}: ${err.message}`;
    return;
  }
  if (res.status === 401) {
    // Session gone stale (password changed, session revoked elsewhere) -
    // drop back to signed-out so the window shows the login form again.
    logout();
    lastError = 'Signed out - session expired';
    return;
  }
  if (!res.ok) {
    lastError = `Server returned ${res.status}`;
    return;
  }
  lastError = null;
  lastCheckin = Date.now();
  const { jobs } = await res.json();
  for (const job of jobs || []) {
    try {
      await runJob(job);
      await reportJob(job.jobId, true, null);
    } catch (err) {
      console.error(`Job ${job.jobId} failed:`, err.message);
      await reportJob(job.jobId, false, err.message);
    }
  }
}

async function reportJob(jobId, ok, error) {
  try {
    await fetch(`${SERVER_URL}/api/print-agents/jobs/${jobId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
      body: JSON.stringify({ ok, error }),
    });
  } catch (err) {
    // Best-effort - the job already ran (or didn't); losing this report
    // just means the server's job-status map doesn't get updated, which
    // nothing currently reads anyway.
  }
}

let loopStarted = false;
function ensureCheckinLoop() {
  if (loopStarted) return;
  loopStarted = true;
  setInterval(() => {
    if (session.cookie) checkinOnce();
  }, CHECKIN_INTERVAL_MS);
  setInterval(refreshPrinters, PRINTER_REFRESH_INTERVAL_MS);
  refreshPrinters().then(() => {
    if (session.cookie) checkinOnce();
  });
}

// ---------- A small solid-colour icon, built as a raw pixel buffer rather
// than a PNG/ICO file - no image container format to get subtly wrong, just
// a byte count that either matches width*height*4 or doesn't. Matches the
// app's existing moss-green brand colour (--accent in public/styles.css).
// Good enough to ship with; a proper designed icon is a trivial swap later
// (nativeImage.createFromPath instead of createFromBuffer). ----------

function buildIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const [r, g, b] = [0x1f, 0x6f, 0x5c]; // --accent
  const center = (size - 1) / 2;
  const radius = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - center;
      const dy = y - center;
      const inCircle = dx * dx + dy * dy <= radius * radius;
      buf[i] = b; // BGRA
      buf[i + 1] = g;
      buf[i + 2] = r;
      buf[i + 3] = inCircle ? 255 : 0;
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

// ---------- Window + tray ----------

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  if (mainWindow) return mainWindow;
  mainWindow = new BrowserWindow({
    width: 380,
    height: 420,
    resizable: false,
    autoHideMenuBar: true,
    icon: buildIcon(256),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
  mainWindow.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    mainWindow.hide();
  });
  return mainWindow;
}

function showWindow() {
  createWindow();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  tray = new Tray(buildIcon(16));
  tray.setToolTip('Wheelhouse Print Agent');
  refreshTrayMenu();
  tray.on('click', showWindow);
}

function refreshTrayMenu() {
  if (!tray) return;
  const items = [{ label: 'Open', click: showWindow }];
  if (session.cookie) {
    items.push({
      label: 'Sign out',
      click: () => {
        logout();
        refreshTrayMenu();
        if (mainWindow) mainWindow.webContents.send('status-changed');
      },
    });
  }
  items.push({ type: 'separator' });
  items.push({
    label: 'Quit',
    click: () => {
      isQuitting = true;
      app.quit();
    },
  });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(session.cookie ? `Wheelhouse Print Agent - signed in as ${session.loggedInAs}` : 'Wheelhouse Print Agent - not signed in');
}

// ---------- IPC (the only things the window's page can ever call) ----------

ipcMain.handle('agent:getStatus', () => ({
  loggedIn: !!session.cookie,
  loggedInAs: session.loggedInAs || null,
  shopName: session.shopName || null,
  deviceName: session.deviceName,
  printers: lastPrinters,
  lastCheckin,
  lastError,
}));

ipcMain.handle('agent:login', async (event, email, password) => {
  try {
    await login(email, password);
    ensureCheckinLoop();
    refreshTrayMenu();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('agent:logout', () => {
  logout();
  refreshTrayMenu();
  return { ok: true };
});

// ---------- App lifecycle ----------

app.whenReady().then(() => {
  createTray();
  ensureCheckinLoop();
  if (isFirstRun || !startedHidden) showWindow();
});

app.on('window-all-closed', () => {
  // Never quit on window close - see the 'close' handler above, which
  // hides rather than closes. This only fires if something else closed
  // every window, which shouldn't normally happen while the tray exists.
});
