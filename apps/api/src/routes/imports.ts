import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { parse } from "csv-parse/sync";
import { getRuntimeSettings } from "../services/settings.js";
import { createBatch, type TaskInput } from "../services/tasks.js";
import { ApiError, ok } from "../utils/http.js";

function fieldValue(fields: Record<string, unknown> | undefined, key: string): string | undefined {
  const field = fields?.[key] as { value?: unknown } | undefined;
  return typeof field?.value === "string" ? field.value : undefined;
}

function normalizeRow(row: Record<string, unknown>): TaskInput {
  return {
    id: typeof row.id === "string" && row.id ? row.id : undefined,
    prompt: String(row.prompt ?? ""),
    size: typeof row.size === "string" && row.size ? row.size : undefined,
    n: row.n === undefined || row.n === "" ? undefined : Number(row.n),
    quality: typeof row.quality === "string" && row.quality ? row.quality : undefined,
    outputFormat:
      typeof row.outputFormat === "string"
        ? row.outputFormat
        : typeof row.output_format === "string"
          ? row.output_format
          : undefined,
  };
}

async function readUploadedFile(request: FastifyRequest): Promise<{
  buffer: Buffer;
  filename: string;
  fields: Record<string, unknown>;
  savedPath: string;
}> {
  const file = await request.file();
  if (!file) {
    throw new ApiError("UPLOAD_REQUIRED", "请上传文件", 400);
  }
  const buffer = await file.toBuffer();
  const settings = getRuntimeSettings();
  await fs.mkdir(settings.uploadDir, { recursive: true });
  const savedPath = path.join(settings.uploadDir, `${Date.now()}-${file.filename}`);
  await fs.writeFile(savedPath, buffer);
  return {
    buffer,
    filename: file.filename,
    fields: file.fields as Record<string, unknown>,
    savedPath,
  };
}

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/import/csv", async (request, reply) => {
    const upload = await readUploadedFile(request);
    const rows = parse(upload.buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, unknown>[];
    const name =
      fieldValue(upload.fields, "name") ?? upload.filename.replace(/\.[^.]+$/, "") ?? "CSV 导入";
    return ok(reply, {
      ...createBatch({
        name,
        description: `Imported from ${upload.filename}`,
        items: rows.map(normalizeRow),
      }),
      uploadPath: upload.savedPath,
    });
  });

  app.post("/api/import/jsonl", async (request, reply) => {
    const upload = await readUploadedFile(request);
    const items = upload.buffer
      .toString("utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => normalizeRow(JSON.parse(line) as Record<string, unknown>));
    const name =
      fieldValue(upload.fields, "name") ?? upload.filename.replace(/\.[^.]+$/, "") ?? "JSONL 导入";
    return ok(reply, {
      ...createBatch({
        name,
        description: `Imported from ${upload.filename}`,
        items,
      }),
      uploadPath: upload.savedPath,
    });
  });
}
