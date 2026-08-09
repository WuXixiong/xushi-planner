import { env } from "cloudflare:workers";

export function getD1() {
  if (!env.DB) throw new Error("任务数据库暂不可用");
  return env.DB;
}

export async function ensureSchema() {
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      estimate_minutes INTEGER NOT NULL DEFAULT 30,
      priority INTEGER NOT NULL DEFAULT 2,
      due_date TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_owner_parent ON tasks(owner_id, parent_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS time_blocks (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      task_id TEXT,
      kind TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_time_blocks_owner_date ON time_blocks(owner_id, date)"),
  ]);
  await db.prepare("PRAGMA optimize").run();
  return db;
}
