import type { FastifyInstance } from "fastify";
import {
  getPublicSettings,
  testImageApiConnection,
  updateSettings,
  updateSettingsSchema,
} from "../services/settings.js";
import { ok } from "../utils/http.js";

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/settings", async (_request, reply) => ok(reply, getPublicSettings()));

  app.post("/api/settings", async (request, reply) =>
    ok(reply, updateSettings(updateSettingsSchema.parse(request.body))),
  );

  app.post("/api/settings/test", async (_request, reply) =>
    ok(reply, await testImageApiConnection()),
  );
}
