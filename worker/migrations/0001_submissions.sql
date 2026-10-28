-- Every submission the Worker accepts, as the JSON the form sent (honeypot removed).
-- Read by interested-parties (../../interested-parties) with `./ip sync`.
CREATE TABLE IF NOT EXISTS submissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT NOT NULL,
  origin      TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT '',
  payload     TEXT NOT NULL,
  mail_status TEXT NOT NULL DEFAULT ''
);
