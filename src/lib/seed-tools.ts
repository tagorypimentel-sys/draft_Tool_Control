import { all, run, uid } from "./db";
import { TOOLS_DATA } from "./seed-tools-data";

const SEED_KEY = "tools_initial_seed_v1";

const STATUS_MAP: Record<string, string> = {
  Available: "available",
  "In Use": "in_use",
  Calibration: "calibration",
  Maintenance: "maintenance",
};

/**
 * Imports the 236 KOE tools the first time the app boots.
 * Idempotent: marks itself complete in the `settings` table and
 * additionally skips if the `tools` table is not empty (safety).
 */
export function seedToolsIfNeeded(): { imported: number; skipped: boolean } {
  const flag = all<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [SEED_KEY],
  );
  if (flag.length > 0) return { imported: 0, skipped: true };

  const existing = all<{ c: number }>("SELECT COUNT(*) AS c FROM tools");
  if ((existing[0]?.c ?? 0) > 0) {
    // Don't overwrite — just record the flag so we don't keep checking.
    run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [
      SEED_KEY,
      new Date().toISOString(),
    ]);
    return { imported: 0, skipped: true };
  }

  let count = 0;
  for (const t of TOOLS_DATA) {
    run(
      `INSERT INTO tools (
        id, code, name, brand, type, tag, serial_tag, category,
        status, value_eur, quantity, requires_calibration, requires_inspection
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid(),
        t.code,
        t.name,
        t.brand || null,
        t.type || null,
        t.tag || null,
        t.serie || null,
        t.category || null,
        STATUS_MAP[t.status] ?? "available",
        t.value || 0,
        t.qty || 1,
        t.hasCalibration ? 1 : 0,
        0,
      ],
    );
    count++;
  }

  run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [
    SEED_KEY,
    new Date().toISOString(),
  ]);

  return { imported: count, skipped: false };
}
