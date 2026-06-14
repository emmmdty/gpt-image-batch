import type { FastifyInstance } from "fastify";
import { desc, eq, gte, sql } from "drizzle-orm";
import { getDb, imageOutputs, imageTasks } from "@gpt-image-batch/db";
import type { ImageQueueWorker } from "@gpt-image-batch/core";
import { ok } from "../utils/http.js";

export async function registerDashboardRoutes(
  app: FastifyInstance,
  worker: ImageQueueWorker,
): Promise<void> {
  app.get("/api/dashboard", async (_request, reply) => {
    const db = getDb();
    const statusRows = db
      .select({
        status: imageTasks.status,
        count: sql<number>`count(*)`,
      })
      .from(imageTasks)
      .groupBy(imageTasks.status)
      .all();
    const counts = Object.fromEntries(statusRows.map((row) => [row.status, Number(row.count)]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayGenerated = Number(
      db
        .select({ count: sql<number>`count(*)` })
        .from(imageOutputs)
        .where(gte(imageOutputs.createdAt, today.toISOString()))
        .get()?.count ?? 0,
    );
    const recentOutputs = db
      .select({
        output: imageOutputs,
        task: imageTasks,
      })
      .from(imageOutputs)
      .leftJoin(imageTasks, eq(imageOutputs.taskId, imageTasks.id))
      .orderBy(desc(imageOutputs.createdAt))
      .limit(8)
      .all();
    const recentTasks = db
      .select()
      .from(imageTasks)
      .orderBy(desc(imageTasks.createdAt))
      .limit(8)
      .all();

    return ok(reply, {
      todayGenerated,
      totalTasks: Object.values(counts).reduce((sum, value) => sum + value, 0),
      success: counts.success ?? 0,
      failed: counts.failed ?? 0,
      pending: counts.pending ?? 0,
      running: counts.running ?? 0,
      queue: worker.getState(),
      recentOutputs,
      recentTasks,
    });
  });
}
