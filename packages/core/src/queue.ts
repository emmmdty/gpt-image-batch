import { randomUUID } from "node:crypto";
import { asc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  batches,
  getDb,
  imageOutputs,
  imageTasks,
  type BatchStatus,
  type ImageTask,
  type NewImageOutput,
} from "@gpt-image-batch/db";
import { ImageApiError, ImageClient } from "./image-client.js";

export interface QueueWorkerSettings {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  outputDir: string;
  maxConcurrency: number;
  maxRetries: number;
  retryBaseDelayMs: number;
}

export interface QueueWorkerOptions {
  loadSettings: () => QueueWorkerSettings | Promise<QueueWorkerSettings>;
  pollIntervalMs?: number;
  staleRunningMs?: number;
  logger?: {
    info: (value: unknown, message?: string) => void;
    warn: (value: unknown, message?: string) => void;
    error: (value: unknown, message?: string) => void;
  };
}

export interface QueueState {
  running: number;
  maxConcurrency: number;
  enabled: boolean;
}

const RUNNING_STATUSES = ["running"] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function compactErrorMessage(error: unknown): string {
  if (error instanceof ImageApiError || error instanceof Error) {
    return error.message;
  }
  return "Unknown image generation error";
}

export function refreshBatchStats(batchId: string | null): void {
  if (!batchId) {
    return;
  }

  const db = getDb();
  const rows = db
    .select({
      status: imageTasks.status,
      count: sql<number>`count(*)`,
    })
    .from(imageTasks)
    .where(eq(imageTasks.batchId, batchId))
    .groupBy(imageTasks.status)
    .all();

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = Number(row.count);
  }

  const totalTasks = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const successCount = counts.success ?? 0;
  const failedCount = counts.failed ?? 0;
  const pendingCount = counts.pending ?? 0;
  const runningCount = counts.running ?? 0;
  const batch = db.select().from(batches).where(eq(batches.id, batchId)).get();
  const current = batch?.status ?? "pending";
  let status: BatchStatus = current;

  if (current !== "paused" && current !== "cancelled") {
    if (runningCount > 0) {
      status = "running";
    } else if (pendingCount > 0) {
      status = current === "running" ? "running" : "pending";
    } else if (totalTasks > 0) {
      status = failedCount > 0 ? "failed" : "completed";
    }
  }

  db.update(batches)
    .set({
      totalTasks,
      successCount,
      failedCount,
      pendingCount,
      runningCount,
      status,
      updatedAt: nowIso(),
    })
    .where(eq(batches.id, batchId))
    .run();
}

export class ImageQueueWorker {
  private readonly options: Required<
    Pick<QueueWorkerOptions, "pollIntervalMs" | "staleRunningMs">
  > &
    Omit<QueueWorkerOptions, "pollIntervalMs" | "staleRunningMs">;
  private timer: NodeJS.Timeout | undefined;
  private running = new Set<string>();
  private maxConcurrency = 0;
  private enabled = false;

  constructor(options: QueueWorkerOptions) {
    this.options = {
      ...options,
      pollIntervalMs: options.pollIntervalMs ?? 1000,
      staleRunningMs: options.staleRunningMs ?? 30 * 60 * 1000,
    };
  }

  getState(): QueueState {
    return {
      running: this.running.size,
      maxConcurrency: this.maxConcurrency,
      enabled: this.enabled,
    };
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.recoverStaleRunning();
    this.timer = setInterval(() => void this.tick(), this.options.pollIntervalMs);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  recoverStaleRunning(): void {
    const db = getDb();
    const staleBefore = new Date(Date.now() - this.options.staleRunningMs).toISOString();
    const staleTasks = db
      .select()
      .from(imageTasks)
      .where(lt(imageTasks.startedAt, staleBefore))
      .all()
      .filter((task) => RUNNING_STATUSES.includes(task.status as "running"));

    for (const task of staleTasks) {
      db.update(imageTasks)
        .set({
          status: "pending",
          errorMessage: "Recovered pending after API service restart",
          updatedAt: nowIso(),
          startedAt: null,
        })
        .where(eq(imageTasks.id, task.id))
        .run();
      refreshBatchStats(task.batchId);
    }
  }

  async tick(): Promise<void> {
    const settings = await this.options.loadSettings();
    this.maxConcurrency = Math.max(1, settings.maxConcurrency);
    this.enabled = Boolean(settings.apiKey);

    if (!settings.apiKey) {
      return;
    }

    const available = this.maxConcurrency - this.running.size;
    if (available <= 0) {
      return;
    }

    const tasks = this.nextPendingTasks(available);
    for (const task of tasks) {
      this.running.add(task.id);
      void this.processTask(task, settings).finally(() => {
        this.running.delete(task.id);
      });
    }
  }

  private nextPendingTasks(limit: number): ImageTask[] {
    const db = getDb();
    const candidates = db
      .select({
        task: imageTasks,
        batchStatus: batches.status,
      })
      .from(imageTasks)
      .leftJoin(batches, eq(imageTasks.batchId, batches.id))
      .where(eq(imageTasks.status, "pending"))
      .orderBy(asc(imageTasks.createdAt))
      .limit(limit * 5)
      .all();

    return candidates
      .filter((row) => !row.batchStatus || !["paused", "cancelled"].includes(row.batchStatus))
      .filter((row) => !this.running.has(row.task.id))
      .slice(0, limit)
      .map((row) => row.task);
  }

  private async processTask(task: ImageTask, settings: QueueWorkerSettings): Promise<void> {
    const db = getDb();
    const startedAt = nowIso();
    db.update(imageTasks)
      .set({
        status: "running",
        startedAt,
        updatedAt: startedAt,
        errorMessage: null,
      })
      .where(eq(imageTasks.id, task.id))
      .run();
    refreshBatchStats(task.batchId);

    try {
      const client = new ImageClient({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey ?? "",
        maxRetries: task.maxRetries,
        retryBaseDelayMs: settings.retryBaseDelayMs,
        onRetry: (retryCount, message) => {
          db.update(imageTasks)
            .set({
              retryCount,
              errorMessage: message,
              updatedAt: nowIso(),
            })
            .where(eq(imageTasks.id, task.id))
            .run();
        },
      });

      const result = await client.generateAndSave({
        task,
        outputDir: settings.outputDir,
      });

      const createdAt = nowIso();
      const outputRows: NewImageOutput[] = result.outputs.map((output) => ({
        id: randomUUID(),
        taskId: task.id,
        batchId: task.batchId,
        filePath: output.filePath,
        fileName: output.fileName,
        mimeType: output.mimeType,
        width: output.width,
        height: output.height,
        indexNo: output.indexNo,
        createdAt,
      }));

      if (outputRows.length) {
        db.insert(imageOutputs).values(outputRows).run();
      }

      db.update(imageTasks)
        .set({
          status: "success",
          requestJson: result.requestJson,
          responseJson: result.responseJson,
          errorMessage: null,
          updatedAt: createdAt,
          finishedAt: createdAt,
        })
        .where(eq(imageTasks.id, task.id))
        .run();
    } catch (error) {
      const failedAt = nowIso();
      db.update(imageTasks)
        .set({
          status: "failed",
          errorMessage: compactErrorMessage(error),
          requestJson: error instanceof ImageApiError ? (error.requestJson ?? null) : null,
          responseJson:
            error instanceof ImageApiError
              ? (error.responseJson ??
                (error.responseBody ? JSON.stringify(error.responseBody) : null))
              : null,
          updatedAt: failedAt,
          finishedAt: failedAt,
        })
        .where(eq(imageTasks.id, task.id))
        .run();
      this.options.logger?.error(
        { taskId: task.id, error: compactErrorMessage(error) },
        "image task failed",
      );
    } finally {
      refreshBatchStats(task.batchId);
    }
  }
}

export function markTasksPending(ids: string[]): void {
  if (!ids.length) {
    return;
  }
  getDb()
    .update(imageTasks)
    .set({
      status: "pending",
      retryCount: 0,
      errorMessage: null,
      requestJson: null,
      responseJson: null,
      startedAt: null,
      finishedAt: null,
      updatedAt: nowIso(),
    })
    .where(inArray(imageTasks.id, ids))
    .run();
}
