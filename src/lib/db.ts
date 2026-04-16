import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import { get, set } from "idb-keyval";

const STORAGE_KEY = "tool-control-db-v1";

let SQL: SqlJsStatic | null = null;
let dbInstance: Database | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  acquisition_date TEXT,
  value_eur REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  brand TEXT,
  type TEXT,
  serial_tag TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  quantity_out_of_service INTEGER NOT NULL DEFAULT 0,
  photo_url TEXT,
  requires_calibration INTEGER NOT NULL DEFAULT 0,
  requires_inspection INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  last_calibration_date TEXT,
  next_calibration_date TEXT,
  calibration_frequency INTEGER
);
CREATE TABLE IF NOT EXISTS technicians (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT,
  contact TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  technician_id TEXT NOT NULL,
  type TEXT NOT NULL,
  date_out TEXT NOT NULL,
  date_expected TEXT,
  date_in TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS calibrations (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  last_date TEXT NOT NULL,
  next_date TEXT,
  certificate TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS cautelas (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  project TEXT NOT NULL,
  client TEXT,
  ship TEXT,
  technician_id TEXT NOT NULL,
  date_out TEXT NOT NULL,
  date_in TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_by TEXT
);
CREATE TABLE IF NOT EXISTS cautela_items (
  id TEXT PRIMARY KEY,
  cautela_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  qty_out INTEGER NOT NULL,
  qty_returned INTEGER NOT NULL DEFAULT 0,
  qty_out_of_service INTEGER NOT NULL DEFAULT 0,
  condition_notes TEXT,
  unit_value_eur REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS calibration_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id TEXT NOT NULL,
  current_date_snapshot TEXT NOT NULL,
  last_calibration_date TEXT NOT NULL,
  frequency_months INTEGER NOT NULL,
  next_calibration_date TEXT NOT NULL,
  certifying_company TEXT NOT NULL,
  calibration_cost_eur REAL,
  certificate_file TEXT,
  certificate_filename TEXT,
  certificate_uploaded_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS calibration_labs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_calibration_records_tool_id ON calibration_records(tool_id);
CREATE INDEX IF NOT EXISTS idx_calibration_records_next_due ON calibration_records(next_calibration_date);
CREATE INDEX IF NOT EXISTS idx_calibration_records_last_date ON calibration_records(last_calibration_date);
`;

// Idempotent column additions for existing DBs
const ALTERS = [
  "ALTER TABLE tools ADD COLUMN brand TEXT",
  "ALTER TABLE tools ADD COLUMN type TEXT",
  "ALTER TABLE tools ADD COLUMN serial_tag TEXT",
  "ALTER TABLE tools ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE tools ADD COLUMN quantity_out_of_service INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE tools ADD COLUMN photo_url TEXT",
  "ALTER TABLE tools ADD COLUMN requires_calibration INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE tools ADD COLUMN requires_inspection INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE tools ADD COLUMN model TEXT",
  "ALTER TABLE tools ADD COLUMN last_calibration_date TEXT",
  "ALTER TABLE tools ADD COLUMN next_calibration_date TEXT",
  "ALTER TABLE tools ADD COLUMN calibration_frequency INTEGER",
  "ALTER TABLE cautelas ADD COLUMN delivered_by TEXT",
  `CREATE VIEW IF NOT EXISTS v_calibration_status AS
   SELECT
     t.id AS tool_id,
     t.name AS tool_name,
     t.brand,
     t.type,
     t.serial_tag,
     t.next_calibration_date,
     t.last_calibration_date,
     t.calibration_frequency,
     r.certifying_company,
     r.calibration_cost_eur,
     r.certificate_file,
     r.certificate_filename,
     r.certificate_uploaded_at,
     CASE
       WHEN t.next_calibration_date IS NULL THEN 'never'
       WHEN t.next_calibration_date <= date('now', '+30 days') THEN 'red'
       WHEN t.next_calibration_date <= date('now', '+180 days') THEN 'yellow'
       ELSE 'green'
     END AS calibration_status,
     CAST(julianday(t.next_calibration_date) - julianday(date('now')) AS INTEGER) AS days_remaining
   FROM tools t
   LEFT JOIN calibration_records r
     ON r.id = (
       SELECT cr.id
       FROM calibration_records cr
       WHERE cr.tool_id = t.id
       ORDER BY cr.last_calibration_date DESC, cr.id DESC
       LIMIT 1
     )
   WHERE t.requires_calibration = 1`,
];

function applyAlters(db: Database) {
  for (const sql of ALTERS) {
    try {
      db.run(sql);
    } catch {
      // column already exists — ignore
    }
  }
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => `/sql-wasm.wasm`,
    });
  }
  const stored = await get<Uint8Array>(STORAGE_KEY);
  dbInstance = stored ? new SQL.Database(stored) : new SQL.Database();
  dbInstance.run(SCHEMA);
  applyAlters(dbInstance);
  return dbInstance;
}

export function scheduleSave() {
  if (!dbInstance) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!dbInstance) return;
    const data = dbInstance.export();
    await set(STORAGE_KEY, data);
  }, 300);
}

export async function saveNow() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  await set(STORAGE_KEY, data);
}

export function exportDbBytes(): Uint8Array | null {
  return dbInstance ? dbInstance.export() : null;
}

export async function importDbBytes(bytes: Uint8Array) {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => `/sql-wasm.wasm`,
    });
  }
  if (dbInstance) dbInstance.close();
  dbInstance = new SQL.Database(bytes);
  dbInstance.run(SCHEMA);
  applyAlters(dbInstance);
  await saveNow();
}

export function uid() {
  return crypto.randomUUID();
}

// Helpers
export function all<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) return [];
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

export function run(sql: string, params: any[] = []) {
  if (!dbInstance) return;
  dbInstance.run(sql, params);
  scheduleSave();
}

export function exec(sqls: { sql: string; params?: any[] }[]) {
  if (!dbInstance) return;
  for (const { sql, params } of sqls) {
    dbInstance.run(sql, params || []);
  }
  scheduleSave();
}
