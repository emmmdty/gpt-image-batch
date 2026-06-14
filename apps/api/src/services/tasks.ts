import { randomUUID } from "node:crypto";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  batches,
  getDb,
  imageTasks,
  taskStatusValues,
  type ImageTask,
  type NewBatch,
  type NewImageTask,
  type TaskStatus,
} from "@gpt-image-batch/db";
import { markTasksPending, refreshBatchStats } from "@gpt-image-batch/core";
import { ApiError } from "../utils/http.js";
import { getRuntimeSettings } from "./settings.js";

export const taskInputSchema = z.object({
  id: z.string().min(1).optional(),
  prompt: z.string().trim().min(1),
  size: z.string().min(1).optional(),
  quality: z.string().min(1).optional(),
  outputFormat: z.string().min(1).optional(),
  output_format: z.string().min(1).optional(),
  n: z.coerce.number().int().min(1).max(10).optional(),
});

export const createBatchSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  items: z.array(taskInputSchema).min(1),
});

export type TaskInput = z.infer<typeof taskInputSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;

function nowIso(): string {
  return new Date().toISOString();
}

function taskRow(input: TaskInput, batchId: string | null): NewImageTask {
  const settings = getRuntimeSettings();
  const createdAt = nowIso();
  return {
    id: input.id ?? randomUUID(),
    batchId,
    prompt: input.prompt,
    negativePrompt: null,
    model: settings.model,
    size: input.size ?? settings.defaultSize,
    quality: input.quality ?? settings.defaultQuality,
    outputFormat: input.outputFormat ?? input.output_format ?? settings.defaultOutputFormat,
    n: input.n ?? settings.defaultN,
    status: "pending",
    retryCount: 0,
    maxRetries: settings.maxRetries,
    errorMessage: null,
    requestJson: null,
    responseJson: null,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    finishedAt: null,
  };
}

function ensureGenerationConfigured(): void {
  if (!getRuntimeSettings().apiKey) {
    throw new ApiError("MISSING_API_KEY", "请先在 Settings 中配置 API Key", 400);
  }
}

export function createSingleTask(input: unknown): ImageTask {
  ensureGenerationConfigured();
  const parsed = taskInputSchema.parse(input);
  const db = getDb();
  const row = taskRow(parsed, null);
  db.insert(imageTasks).values(row).run();
  return db.select().from(imageTasks).where(eq(imageTasks.id, row.id)).get()!;
}

export function createBatch(input: unknown) {
  ensureGenerationConfigured();
  const parsed = createBatchSchema.parse(input);
  const db = getDb();
  const id = randomUUID();
  const createdAt = nowIso();
  const batch: NewBatch = {
    id,
    name: parsed.name,
    description: parsed.description ?? null,
    status: "pending",
    totalTasks: parsed.items.length,
    successCount: 0,
    failedCount: 0,
    pendingCount: parsed.items.length,
    runningCount: 0,
    createdAt,
    updatedAt: createdAt,
  };
  const taskRows = parsed.items.map((item) => taskRow(item, id));

  try {
    db.transaction((tx) => {
      tx.insert(batches).values(batch).run();
      tx.insert(imageTasks).values(taskRows).run();
    });
  } catch (error) {
    throw new ApiError(
      "CREATE_BATCH_FAILED",
      error instanceof Error ? error.message : "创建批次失败",
      409,
    );
  }

  return {
    batch: db.select().from(batches).where(eq(batches.id, id)).get(),
    tasks: taskRows,
  };
}

export function listTasks(query: {
  status?: string;
  batchId?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const conditions: SQL[] = [];

  if (query.status && taskStatusValues.includes(query.status as TaskStatus)) {
    conditions.push(eq(imageTasks.status, query.status as TaskStatus));
  }
  if (query.batchId) {
    conditions.push(eq(imageTasks.batchId, query.batchId));
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const selectQuery = db.select().from(imageTasks).$dynamic();
  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(imageTasks)
    .$dynamic();
  if (where) {
    selectQuery.where(where);
    countQuery.where(where);
  }

  const items = selectQuery
    .orderBy(desc(imageTasks.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();
  const total = Number(countQuery.get()?.count ?? 0);
  return { items, page, pageSize, total };
}

export function retryTask(id: string): ImageTask {
  const db = getDb();
  const task = db.select().from(imageTasks).where(eq(imageTasks.id, id)).get();
  if (!task) {
    throw new ApiError("TASK_NOT_FOUND", "任务不存在", 404);
  }
  if (task.status !== "failed") {
    throw new ApiError("TASK_NOT_FAILED", "只有 failed 状态任务可以重跑", 409);
  }
  markTasksPending([id]);
  refreshBatchStats(task.batchId);
  return db.select().from(imageTasks).where(eq(imageTasks.id, id)).get()!;
}
