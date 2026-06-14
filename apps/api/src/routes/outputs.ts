import path from "node:path";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { getDb, imageOutputs, imageTasks } from "@gpt-image-batch/db";
import { getRuntimeSettings } from "../services/settings.js";
import { ok } from "../utils/http.js";

function outputUrl(filePath: string): string {
  const outputDir = getRuntimeSettings().outputDir;
  const relative = path
    .relative(outputDir, filePath)
    .split(path.sep)
    .map(encodeURIComponent)
    .join("/");
  return `/outputs/${relative}`;
}

export async function registerOutputRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/outputs", async (request, reply) => {
    const query = request.query as { taskId?: string; batchId?: string };
    const conditions: SQL[] = [];
    if (query.taskId) {
      conditions.push(eq(imageOutputs.taskId, query.taskId));
    }
    if (query.batchId) {
      conditions.push(eq(imageOutputs.batchId, query.batchId));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const dbQuery = getDb()
      .select({
        output: imageOutputs,
        task: imageTasks,
      })
      .from(imageOutputs)
      .leftJoin(imageTasks, eq(imageOutputs.taskId, imageTasks.id))
      .$dynamic();
    if (where) {
      dbQuery.where(where);
    }
    const items = dbQuery
      .orderBy(desc(imageOutputs.createdAt))
      .limit(200)
      .all()
      .map((row) => ({
        ...row.output,
        url: outputUrl(row.output.filePath),
        task: row.task,
      }));
    return ok(reply, { items });
  });
}
