import fs from "node:fs";
import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { ImageQueueWorker } from "@gpt-image-batch/core";
import { resolveWorkspacePath } from "@gpt-image-batch/db";
import { getRuntimeSettings } from "./services/settings.js";
import { registerBatchRoutes } from "./routes/batches.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerImportRoutes } from "./routes/imports.js";
import { registerOutputRoutes } from "./routes/outputs.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { errorPayload } from "./utils/http.js";

export interface BuildServerOptions {
  startWorker?: boolean;
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: ["req.headers.authorization", "apiKey", "IMAGE_API_KEY"],
    },
  });
  const settings = getRuntimeSettings();
  fs.mkdirSync(settings.outputDir, { recursive: true });
  fs.mkdirSync(settings.uploadDir, { recursive: true });

  const worker = new ImageQueueWorker({
    loadSettings: () => {
      const runtime = getRuntimeSettings();
      return {
        baseUrl: runtime.baseUrl,
        apiKey: runtime.apiKey,
        model: runtime.model,
        outputDir: runtime.outputDir,
        maxConcurrency: runtime.maxConcurrency,
        maxRetries: runtime.maxRetries,
        retryBaseDelayMs: runtime.retryBaseDelayMs,
      };
    },
    logger: app.log,
  });

  app.setErrorHandler((error, _request, reply) => {
    const payload = errorPayload(error);
    if (payload.statusCode >= 500) {
      app.log.error({ err: error }, "request failed");
    }
    reply.status(payload.statusCode).send(payload.body);
  });

  void app.register(cors, {
    origin: true,
  });
  void app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024,
    },
  });
  void app.register(fastifyStatic, {
    root: settings.outputDir,
    prefix: "/outputs/",
    decorateReply: false,
  });

  app.get("/health", async (_request, reply) => reply.send({ ok: true }));
  void app.register(registerSettingsRoutes);
  void app.register(registerTaskRoutes);
  void app.register(registerBatchRoutes);
  void app.register(registerImportRoutes);
  void app.register(registerOutputRoutes);
  void app.register(async (instance) => registerDashboardRoutes(instance, worker));

  app.addHook("onReady", async () => {
    if (options.startWorker ?? true) {
      worker.start();
      if (!getRuntimeSettings().apiKey) {
        app.log.warn(
          "IMAGE_API_KEY is not configured; generation tasks will wait until Settings saves a key",
        );
      }
    }
  });
  app.addHook("onClose", async () => {
    worker.stop();
  });

  return app;
}

async function main(): Promise<void> {
  const port = Number(process.env.API_PORT ?? 8787);
  const app = buildServer();
  await app.listen({
    host: "0.0.0.0",
    port,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export const workspaceOutputDir = resolveWorkspacePath(process.env.OUTPUT_DIR ?? "./outputs");
