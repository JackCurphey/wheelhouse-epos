// Your settings › Accessibility (openspec/changes/your-settings-accessibility;
// drawn as your-settings; workshop day 57): each person's own switches, saved
// on their login (Jack, 23 Oct, answer 1) until PINs, so they follow them to
// any device and change nothing for anyone else.
import { prepare } from '../db.js';
import { currentSession } from '../lib/session.js';
import { readJsonBody, sendJson } from '../lib/http.js';

// Every switch the drawing has, off to start, but Show the diary legend, on
// to start (diary-legend-box design 1); the screens show the ones built.
const SWITCHES = ['showLegend', 'statusSymbols', 'reduceMotion', 'noAutoClose', 'largerText', 'foldedSidebar'];
const DEFAULT_ON = ['showLegend'];

const whole = (stored = {}) => ({
  accessibility: Object.fromEntries(SWITCHES.map((k) => [k, typeof stored[k] === 'boolean' ? stored[k] : DEFAULT_ON.includes(k)])),
});

export function register(route) {
  // screens: your-settings
  route('GET', '/api/your-settings', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const row = await prepare('SELECT accessibility FROM login_preferences WHERE login_id = ?').get(ctx.login.id);
    sendJson(res, 200, whole(row?.accessibility));
  });

  // Some of the switches, each true or false; the rest stay as they are.
  // screens: your-settings
  route('PUT', '/api/your-settings', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    const changes = body?.accessibility;
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length === 0) {
      return sendJson(res, 400, { error: 'Say which switches to change' });
    }
    for (const [key, value] of Object.entries(changes)) {
      if (!SWITCHES.includes(key)) return sendJson(res, 400, { error: `There’s no ${key} setting` });
      if (typeof value !== 'boolean') return sendJson(res, 400, { error: `${key} must be on or off` });
    }
    const row = await prepare(
      `INSERT INTO login_preferences (login_id, accessibility) VALUES (?, ?::jsonb)
       ON CONFLICT (login_id) DO UPDATE SET accessibility = login_preferences.accessibility || EXCLUDED.accessibility, updated_at = now()
       RETURNING accessibility`
    ).get(ctx.login.id, JSON.stringify(changes));
    sendJson(res, 200, whole(row.accessibility));
  });
}
