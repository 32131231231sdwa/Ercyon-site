CREATE TABLE IF NOT EXISTS updates (
  update_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('processing', 'done')),
  lease_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  user_id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  user_id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS updates_cleanup ON updates(status, created_at);
CREATE INDEX IF NOT EXISTS sessions_cleanup ON sessions(updated_at);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  username TEXT,
  display_name TEXT NOT NULL,
  player_name TEXT NOT NULL,
  country_name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  submitted_update_id INTEGER NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  reviewer_id INTEGER,
  review_reason TEXT,
  reviewed_at INTEGER,
  decision_update_id INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_application
  ON applications(user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS applications_queue ON applications(status, created_at);
CREATE INDEX IF NOT EXISTS applications_user ON applications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS calendar (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_year INTEGER NOT NULL DEFAULT 1601,
  accumulated_ms INTEGER NOT NULL DEFAULT 0,
  anchor_ms INTEGER,
  running INTEGER NOT NULL DEFAULT 0 CHECK (running IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  last_update_id INTEGER
);
INSERT OR IGNORE INTO calendar(id) VALUES (1);

CREATE TABLE IF NOT EXISTS rolls (
  update_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  source_message_id INTEGER,
  result INTEGER NOT NULL CHECK (result BETWEEN 1 AND 100),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  update_id INTEGER NOT NULL,
  sequence INTEGER NOT NULL,
  method TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  retry_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(update_id, sequence)
);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(status, retry_at, lease_until, id);
CREATE INDEX IF NOT EXISTS outbox_cleanup ON outbox(status, created_at);
