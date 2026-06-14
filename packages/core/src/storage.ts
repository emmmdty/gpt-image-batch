import fs from "node:fs/promises";
import path from "node:path";

const extensionByMime: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function dimensionsFromSize(size: string): { width: number | null; height: number | null } {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) {
    return { width: null, height: null };
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function mimeTypeFromFormat(format: string): string {
  if (format === "jpeg" || format === "jpg") {
    return "image/jpeg";
  }
  if (format === "webp") {
    return "image/webp";
  }
  return "image/png";
}

export async function saveImageBuffer(options: {
  buffer: Buffer;
  outputDir: string;
  batchId: string | null;
  taskId: string;
  indexNo: number;
  outputFormat: string;
  mimeType?: string | null;
  size: string;
}): Promise<{
  filePath: string;
  fileName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  indexNo: number;
}> {
  const date = new Date().toISOString().slice(0, 10);
  const scope = options.batchId ? sanitizePathSegment(options.batchId) : "single";
  const dir = path.resolve(options.outputDir, date, scope);
  await fs.mkdir(dir, { recursive: true });

  const mimeType = options.mimeType ?? mimeTypeFromFormat(options.outputFormat);
  const ext = extensionByMime[mimeType] ?? options.outputFormat.replace("jpeg", "jpg") ?? "png";
  const fileName = `${sanitizePathSegment(options.taskId)}-${options.indexNo}.${ext}`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, options.buffer);
  const dimensions = dimensionsFromSize(options.size);

  return {
    filePath,
    fileName,
    mimeType,
    width: dimensions.width,
    height: dimensions.height,
    indexNo: options.indexNo,
  };
}
