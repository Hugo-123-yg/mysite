CREATE TABLE archive_items (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('articles', 'websites', 'commissions')),
  title TEXT NOT NULL,
  note TEXT NOT NULL,
  body TEXT NOT NULL,
  object_key TEXT NOT NULL,
  alt TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
