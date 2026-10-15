# Proposal: deleting a job and its attachments move to server/routes/workshop.js (WP-0.4)

## Why

The last workshop routes in `server.js` are deleting a job and the four job
attachment routes. They waited for a shared home for the uploads folder
(`UPLOADS_DIR`), which Mark's #205 put in `server/lib/uploads.js`. With
them moved, Jack's half of the server split is done.

## What Changes

- Five routes move into `register()` in `server/routes/workshop.js`:
  `DELETE /api/workshop-jobs/:id`, and `GET`/`POST
  /api/workshop-jobs/:jobId/attachments` and `GET`/`DELETE
  /api/workshop-jobs/:jobId/attachments/:id`.
- Their helpers move with them, private to `workshop.js`, because nothing
  else uses them: `MAX_ATTACHMENT_BYTES`, `MAX_ATTACHMENT_BODY_BYTES` and
  `serializeAttachment`.
- `UPLOADS_DIR` comes from `server/lib/uploads.js`. `server.js` drops the
  imports nothing there uses any more.
- Moved, not rewritten: unchanged apart from the indentation inside
  `register()`, the section label, the import lines, and one `catch (err)`
  becoming `catch`. No behaviour
  changes, so no spec change (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Jack's: `server/routes/workshop.js`. Lines leave `server.js`,
  Mark's, so the pull request needs his approval (split plan §3.1).
- **Decisions followed:** split plan §4.1; Mark's answer 2 on #180 (a shared
  `uploads.js`, made with his image uploads move).

## Impact

- `server/server.js`, `server/routes/workshop.js`,
  `tests/workshop-routes-file.test.js`.
