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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
`;

// Idempotent column additions for existing DBs
const ALTERS = [
  "ALTER TABLE tools ADD COLUMN brand TEXT",
  "ALTER TABLE tools ADD COLUMN type TEXT",
  "ALTER TABLE tools ADD COLUMN serial_tag TEXT",
  "ALTER TABLE tools ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE tools ADD COLUMN quantity_out_of_service INTEGER NOT NULL DEFAULT 0",
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
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
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
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
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
