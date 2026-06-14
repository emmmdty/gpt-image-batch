import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { config as loadDotenv } from "dotenv";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

let sqliteSingleton: Database.Database | undefined;
let dbSingleton: AppDatabase | undefined;

export function findWorkspaceRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(__dirname, "../../..");
    }
    current = parent;
  }
}

export const workspaceRoot = findWorkspaceRoot();

loadDotenv({ path: path.join(workspaceRoot, ".env"), quiet: true });

export function resolveWorkspacePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(workspaceRoot, inputPath);
}

export function resolveFileDatabaseUrl(
  databaseUrl = process.env.DATABASE_URL ?? "file:./data/app.db",
): string {
  const normalized = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;
  return resolveWorkspacePath(normalized);
}

export function getSqliteDatabase(): Database.Database {
  if (!sqliteSingleton) {
    const dbPath = resolveFileDatabaseUrl();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    sqliteSingleton = new Database(dbPath);
    sqliteSingleton.pragma("journal_mode = WAL");
    sqliteSingleton.pragma("foreign_keys = ON");
  }
  return sqliteSingleton;
}

export function getDb(): AppDatabase {
  if (!dbSingleton) {
    dbSingleton = drizzle(getSqliteDatabase(), { schema });
  }
  return dbSingleton;
}

export function closeDb(): void {
  sqliteSingleton?.close();
  sqliteSingleton = undefined;
  dbSingleton = undefined;
}
