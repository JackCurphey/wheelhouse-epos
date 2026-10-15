// Shared by more than one route area (split plan §4.1, WP-0.4; #180, 15 Oct):
// where uploaded files live, and the largest id Postgres's int4 holds. Moved
// out of server.js unchanged. Creating the folder at startup stays in
// server.js.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Attachment bytes live here as flat files named by a random per-file token
// (see workshop_job_attachments.storage_key) - never the customer's original
// filename, so there's nothing to sanitize or path-traverse with. The token
// alone never grants access; every read goes through the download route,
// which checks the owning job through the normal RLS-scoped `db`. Backed by
// a named Docker volume (docker-compose.yml) so uploads survive a rebuild
// the same way Postgres's data does.
export const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// The largest value a SERIAL (int4) id can hold.
export const MAX_SERIAL = 2147483647;
