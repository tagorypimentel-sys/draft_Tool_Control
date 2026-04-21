import { all, run, uid } from "./db";
import { TOOLS_DATA } from "./seed-tools-data";

const SEED_KEY = "tools_initial_seed_v2";

const STATUS_MAP: Record<string, string> = {
  Available: "available",
  "In Use": "in_use",
  Calibration: "calibration",
  Maintenance: "maintenance",
};

/**
 * Imports the KOE catalog tools. Idempotent by `code`:
 * inserts only tools whose `code` is not already in the DB.
 * Safe to re-run — never updates or removes existing rows.
 */
export function seedToolsIfNeeded(): { imported: number; skipped: number } {
  const existing = all<{ code: string }>("SELECT code FROM tools");
  const existingCodes = new Set(existing.map((r) => r.code));

  let imported = 0;
  let skipped = 0;

  for (const t of TOOLS_DATA) {
    if (existingCodes.has(t.code)) {
      skipped++;
      continue;
    }
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
    imported++;
  }

  run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [
    SEED_KEY,
    new Date().toISOString(),
  ]);

  return { imported, skipped };
}
