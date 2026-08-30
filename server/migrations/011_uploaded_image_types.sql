-- Uploaded images (product photos, shop logo, shop hero image) are stored
-- under UPLOADS_DIR by an opaque random key with no file extension (same
-- convention as workshop job attachments), so the retrieval route needs
-- somewhere to remember each one's content type to serve it back with the
-- right header.
CREATE TABLE uploaded_image_types (
  storage_key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
