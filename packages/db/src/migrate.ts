import { getSqliteDatabase, resolveFileDatabaseUrl } from "./client.js";

const sqlite = getSqliteDatabase();

sqlite.exec(`
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  total_tasks INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  running_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS image_tasks (
  id TEXT PRIMARY KEY,
  batch_id TEXT REFERENCES batches(id),
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  model TEXT NOT NULL,
  size TEXT NOT NULL,
  quality TEXT NOT NULL,
  output_format TEXT NOT NULL,
  n INTEGER NOT NULL,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  request_json TEXT,
  response_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_image_tasks_status ON image_tasks(status);
CREATE INDEX IF NOT EXISTS idx_image_tasks_batch_id ON image_tasks(batch_id);
CREATE INDEX IF NOT EXISTS idx_image_tasks_created_at ON image_tasks(created_at);

CREATE TABLE IF NOT EXISTS image_outputs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES image_tasks(id),
  batch_id TEXT REFERENCES batches(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  index_no INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_image_outputs_task_id ON image_outputs(task_id);
CREATE INDEX IF NOT EXISTS idx_image_outputs_batch_id ON image_outputs(batch_id);
CREATE INDEX IF NOT EXISTS idx_image_outputs_created_at ON image_outputs(created_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

console.log(`SQLite database is ready at ${resolveFileDatabaseUrl()}`);
