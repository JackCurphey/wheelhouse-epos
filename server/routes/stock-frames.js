// A bike's frame number, checked while receiving (openspec/changes/frame-numbers, design 4;
// rs-frame-dup). Staff routes under the dispatcher's /api/ branch, with the shop's row-level
// security bound, so another business's frames are never found. Anyone with the page, as
// receiving is (receiving decision 4).
import { badRequest, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { frameInStock, MAX_FRAME } from '../lib/bikes.js';

export function register(route) {
  // screens: rs-frame, rs-frame-dup
  route('GET', '/api/stock-frames/check', async (req, res, params, query) => {
    if (!(await currentSession(req))) return sendJson(res, 401, { error: 'Not signed in' });
    const number = (query.get('number') ?? '').trim();
    if (!number || number.length > MAX_FRAME) return badRequest(res, `A frame number is 1 to ${MAX_FRAME} characters`);
    const found = await frameInStock(number);
    sendJson(res, 200, { inStock: found && { frameNumber: found.frame_number, productName: found.product_name, bookedInAt: found.received_at } });
  });
}
