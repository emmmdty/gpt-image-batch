import { z } from "zod";
import { appSettings, getDb, resolveWorkspacePath } from "@gpt-image-batch/db";

const PLACEHOLDER_KEYS = new Set(["", "YOUR_API_KEY", "your-api-key"]);

export const updateSettingsSchema = z.object({
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  model: z.string().min(1).optional(),
  defaultSize: z.string().min(1).optional(),
  defaultQuality: z.string().min(1).optional(),
  defaultOutputFormat: z.string().min(1).optional(),
  defaultN: z.coerce.number().int().min(1).max(10).optional(),
  maxConcurrency: z.coerce.number().int().min(1).max(16).optional(),
  maxRetries: z.coerce.number().int().min(0).max(10).optional(),
  retryBaseDelayMs: z.coerce.number().int().min(100).max(60_000).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export interface RuntimeSettings {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  defaultSize: string;
  defaultQuality: string;
  defaultOutputFormat: string;
  defaultN: number;
  maxConcurrency: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  outputDir: string;
  uploadDir: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readSettingsMap(): Map<string, string> {
  return new Map(
    getDb()
      .select()
      .from(appSettings)
      .all()
      .map((row) => [row.key, row.value]),
  );
}

function validApiKey(value: string | undefined | null): string | null {
  if (!value || PLACEHOLDER_KEYS.has(value.trim())) {
    return null;
  }
  return value;
}

function numberValue(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getString(
  map: Map<string, string>,
  key: string,
  envName: string,
  fallback: string,
): string {
  return map.get(key) ?? process.env[envName] ?? fallback;
}

function getNumber(
  map: Map<string, string>,
  key: string,
  envName: string,
  fallback: number,
): number {
  return numberValue(map.get(key) ?? process.env[envName], fallback);
}

export function getRuntimeSettings(): RuntimeSettings {
  const map = readSettingsMap();
  return {
    baseUrl: getString(map, "baseUrl", "IMAGE_API_BASE_URL", "https://api.longxiadev.store/v1"),
    apiKey: validApiKey(map.get("apiKey")) ?? validApiKey(process.env.IMAGE_API_KEY),
    model: getString(map, "model", "IMAGE_MODEL", "gpt-image-2"),
    defaultSize: getString(map, "defaultSize", "DEFAULT_SIZE", "1024x1024"),
    defaultQuality: getString(map, "defaultQuality", "DEFAULT_QUALITY", "medium"),
    defaultOutputFormat: getString(map, "defaultOutputFormat", "DEFAULT_OUTPUT_FORMAT", "png"),
    defaultN: getNumber(map, "defaultN", "DEFAULT_N", 1),
    maxConcurrency: getNumber(map, "maxConcurrency", "MAX_CONCURRENCY", 2),
    maxRetries: getNumber(map, "maxRetries", "MAX_RETRIES", 3),
    retryBaseDelayMs: getNumber(map, "retryBaseDelayMs", "RETRY_BASE_DELAY_MS", 1000),
    outputDir: resolveWorkspacePath(process.env.OUTPUT_DIR ?? "./outputs"),
    uploadDir: resolveWorkspacePath(process.env.UPLOAD_DIR ?? "./uploads"),
  };
}

export function getPublicSettings() {
  const settings = getRuntimeSettings();
  return {
    baseUrl: settings.baseUrl,
    baseUrlConfigured: Boolean(settings.baseUrl),
    apiKeyConfigured: Boolean(settings.apiKey),
    model: settings.model,
    defaultSize: settings.defaultSize,
    defaultQuality: settings.defaultQuality,
    defaultOutputFormat: settings.defaultOutputFormat,
    defaultN: settings.defaultN,
    maxConcurrency: settings.maxConcurrency,
    maxRetries: settings.maxRetries,
    retryBaseDelayMs: settings.retryBaseDelayMs,
    outputDir: settings.outputDir,
    uploadDir: settings.uploadDir,
  };
}

export function updateSettings(input: UpdateSettingsInput) {
  const parsed = updateSettingsSchema.parse(input);
  const db = getDb();
  const updatedAt = nowIso();
  const entries = Object.entries(parsed).filter(([, value]) => value !== undefined);

  for (const [key, value] of entries) {
    if (key === "apiKey" && String(value).trim() === "") {
      continue;
    }
    db.insert(appSettings)
      .values({
        key,
        value: String(value),
        updatedAt,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: String(value),
          updatedAt,
        },
      })
      .run();
  }

  return getPublicSettings();
}

export async function testImageApiConnection(): Promise<{ reachable: boolean; message: string }> {
  const settings = getRuntimeSettings();
  if (!settings.apiKey) {
    return { reachable: false, message: "API Key 未配置" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, "")}/models`, {
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
      },
      signal: controller.signal,
    });

    if (response.ok) {
      return { reachable: true, message: "连接成功" };
    }
    if (response.status === 404 || response.status === 405) {
      return {
        reachable: true,
        message: "/models 不可用，但 Base URL 可访问；请用一次生图任务验证兼容接口",
      };
    }
    return { reachable: false, message: `连接失败：HTTP ${response.status}` };
  } catch (error) {
    return {
      reachable: false,
      message: error instanceof Error ? error.message : "连接失败",
    };
  } finally {
    clearTimeout(timeout);
  }
}
