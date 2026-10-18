import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const databasePath = resolve(here, "../../data/game.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS game_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    team_id TEXT,
    payload TEXT,
    created_at TEXT NOT NULL
  );
`);

export const persistence = {
  load() {
    const row = db.prepare("SELECT value FROM app_state WHERE key = ?").get("active_game");
    return row ? JSON.parse(row.value) : null;
  },
  save(state) {
    db.prepare(`
      INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run("active_game", JSON.stringify(state), new Date().toISOString());
  },
  event(type, teamId = null, payload = {}) {
    db.prepare("INSERT INTO game_events (event_type, team_id, payload, created_at) VALUES (?, ?, ?, ?)")
      .run(type, teamId, JSON.stringify(payload), new Date().toISOString());
  },
};
