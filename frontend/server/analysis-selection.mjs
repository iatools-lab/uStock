import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

export function openSelectionStore(
  filename = process.env.UKIT_SELECTION_FILE ||
    fileURLToPath(new URL("./analysis-selection.sqlite", import.meta.url)),
) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS analysis_rule(kind TEXT NOT NULL CHECK(kind IN ('asset','product')), key TEXT NOT NULL, included INTEGER NOT NULL CHECK(included IN (0,1)), reason TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY(kind,key));
    CREATE TABLE IF NOT EXISTS analysis_revision(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL);
    INSERT OR IGNORE INTO analysis_revision VALUES(1,0);`);
  return {
    read() {
      return {
        revision: db
          .prepare("SELECT version FROM analysis_revision WHERE id=1")
          .get().version,
        rules: db
          .prepare(
            "SELECT kind,key,included,reason,updated_at AS updatedAt FROM analysis_rule ORDER BY updated_at DESC,kind,key",
          )
          .all()
          .map((r) => ({ ...r, included: Boolean(r.included) })),
      };
    },
    save({ kind, keys, included, reason = "" }) {
      if (
        !["asset", "product"].includes(kind) ||
        !Array.isArray(keys) ||
        keys.length < 1 ||
        keys.length > 5000 ||
        keys.some(
          (key) => typeof key !== "string" || !key.trim() || key.length > 200,
        ) ||
        ![true, false, null].includes(included) ||
        typeof reason !== "string" ||
        reason.length > 500
      )
        throw new Error("INVALID_SELECTION");
      const unique = [...new Set(keys)],
        now = new Date().toISOString();
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const key of unique) {
          if (included === null)
            db.prepare("DELETE FROM analysis_rule WHERE kind=? AND key=?").run(
              kind,
              key,
            );
          else
            db.prepare(
              "INSERT INTO analysis_rule VALUES(?,?,?,?,?) ON CONFLICT(kind,key) DO UPDATE SET included=excluded.included,reason=excluded.reason,updated_at=excluded.updated_at",
            ).run(kind, key, included ? 1 : 0, reason, now);
        }
        db.exec(
          "UPDATE analysis_revision SET version=version+1 WHERE id=1; COMMIT",
        );
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return this.read();
    },
    close() {
      db.close();
    },
  };
}
