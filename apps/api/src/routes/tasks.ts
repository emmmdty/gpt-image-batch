import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSingleTask, listTasks, retryTask } from "../services/tasks.js";
import { ok } from "../utils/http.js";

const listQuerySchema = z.object({
  status: z.string().optional(),
  batchId: z.string().optional(),
  page: z.coerce.number().int().optional(),
  pageSize: z.coerce.number().int().optional(),
});

export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/tasks", async (request, reply) => ok(reply, createSingleTask(request.body)));

  app.get("/api/tasks", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    return ok(reply, listTasks(query));
  });

  app.post<{ Params: { id: string } }>("/api/tasks/:id/retry", async (request, reply) =>
    ok(reply, retryTask(request.params.id)),
  );
}
