CREATE TABLE IF NOT EXISTS licenses (
  key      TEXT    PRIMARY KEY,
  hwid     TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,          -- NULL = lifetime
  revoked  INTEGER NOT NULL DEFAULT 0
);
