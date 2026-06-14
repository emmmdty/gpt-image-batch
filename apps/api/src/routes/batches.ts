import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray } from "drizzle-orm";
import { batches, getDb, imageOutputs, imageTasks } from "@gpt-image-batch/db";
import { markTasksPending, refreshBatchStats } from "@gpt-image-batch/core";
import { createBatch, listTasks } from "../services/tasks.js";
import { ApiError, ok } from "../utils/http.js";

function nowIso(): string {
  return new Date().toISOString();
}

export async function registerBatchRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/batches", async (request, reply) => ok(reply, createBatch(request.body)));

  app.get("/api/batches", async (_request, reply) => {
    const items = getDb().select().from(batches).orderBy(desc(batches.createdAt)).all();
    return ok(reply, { items });
  });

  app.get<{ Params: { id: string } }>("/api/batches/:id", async (request, reply) => {
    const db = getDb();
    const batch = db.select().from(batches).where(eq(batches.id, request.params.id)).get();
    if (!batch) {
      throw new ApiError("BATCH_NOT_FOUND", "批次不存在", 404);
    }
    const tasks = listTasks({ batchId: request.params.id, pageSize: 100 });
    const outputs = db
      .select()
      .from(imageOutputs)
      .where(eq(imageOutputs.batchId, request.params.id))
      .orderBy(desc(imageOutputs.createdAt))
      .all();
    return ok(reply, { batch, tasks: tasks.items, outputs });
  });

  app.post<{ Params: { id: string } }>("/api/batches/:id/pause", async (request, reply) => {
    const db = getDb();
    const batch = db.select().from(batches).where(eq(batches.id, request.params.id)).get();
    if (!batch) {
      throw new ApiError("BATCH_NOT_FOUND", "批次不存在", 404);
    }
    db.update(batches)
      .set({ status: "paused", updatedAt: nowIso() })
      .where(eq(batches.id, request.params.id))
      .run();
    return ok(reply, db.select().from(batches).where(eq(batches.id, request.params.id)).get());
  });

  app.post<{ Params: { id: string } }>("/api/batches/:id/resume", async (request, reply) => {
    const db = getDb();
    const batch = db.select().from(batches).where(eq(batches.id, request.params.id)).get();
    if (!batch) {
      throw new ApiError("BATCH_NOT_FOUND", "批次不存在", 404);
    }
    db.update(batches)
      .set({ status: "running", updatedAt: nowIso() })
      .where(eq(batches.id, request.params.id))
      .run();
    refreshBatchStats(request.params.id);
    return ok(reply, db.select().from(batches).where(eq(batches.id, request.params.id)).get());
  });

  app.post<{ Params: { id: string } }>("/api/batches/:id/cancel", async (request, reply) => {
    const db = getDb();
    const batch = db.select().from(batches).where(eq(batches.id, request.params.id)).get();
    if (!batch) {
      throw new ApiError("BATCH_NOT_FOUND", "批次不存在", 404);
    }
    const updatedAt = nowIso();
    db.update(imageTasks)
      .set({ status: "cancelled", updatedAt, finishedAt: updatedAt })
      .where(and(eq(imageTasks.batchId, request.params.id), eq(imageTasks.status, "pending")))
      .run();
    db.update(batches)
      .set({ status: "cancelled", updatedAt })
      .where(eq(batches.id, request.params.id))
      .run();
    refreshBatchStats(request.params.id);
    return ok(reply, db.select().from(batches).where(eq(batches.id, request.params.id)).get());
  });

  app.post<{ Params: { id: string } }>("/api/batches/:id/retry-failed", async (request, reply) => {
    const failedTasks = getDb()
      .select()
      .from(imageTasks)
      .where(and(eq(imageTasks.batchId, request.params.id), inArray(imageTasks.status, ["failed"])))
      .all();
    markTasksPending(failedTasks.map((task) => task.id));
    refreshBatchStats(request.params.id);
    return ok(reply, { retried: failedTasks.length });
  });
}
