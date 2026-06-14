import type { Batch, DashboardData, ImageOutput, ImageTask, Settings } from "./types.js";
import { resolveApiBaseUrl } from "./api-base.js";

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "Content-Type": "application/json", ...init?.headers },
  });
  const json = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !json.ok) {
    throw new Error(json.error?.message ?? `HTTP ${response.status}`);
  }
  return json.data as T;
}

export function getDashboard() {
  return request<DashboardData>("/api/dashboard");
}

export function getSettings() {
  return request<Settings>("/api/settings");
}

export function updateSettings(input: Partial<Settings> & { apiKey?: string }) {
  return request<Settings>("/api/settings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function testSettingsConnection() {
  return request<{ reachable: boolean; message: string }>("/api/settings/test", { method: "POST" });
}

export function createTask(input: {
  prompt: string;
  size?: string;
  quality?: string;
  outputFormat?: string;
  n?: number;
}) {
  return request<ImageTask>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createBatch(input: {
  name: string;
  items: Array<{
    prompt: string;
    size?: string;
    quality?: string;
    outputFormat?: string;
    n?: number;
  }>;
}) {
  return request<{ batch: Batch; tasks: ImageTask[] }>("/api/batches", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function importCsv(file: File, name?: string) {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);
  return request<{ batch: Batch; tasks: ImageTask[]; uploadPath: string }>("/api/import/csv", {
    method: "POST",
    body: form,
  });
}

export function importJsonl(file: File, name?: string) {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);
  return request<{ batch: Batch; tasks: ImageTask[]; uploadPath: string }>("/api/import/jsonl", {
    method: "POST",
    body: form,
  });
}

export function listTasks(
  params: { status?: string; batchId?: string; page?: number; pageSize?: number } = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return request<{ items: ImageTask[]; page: number; pageSize: number; total: number }>(
    `/api/tasks?${query}`,
  );
}

export function listBatches() {
  return request<{ items: Batch[] }>("/api/batches");
}

export function getBatch(id: string) {
  return request<{ batch: Batch; tasks: ImageTask[]; outputs: ImageOutput[] }>(
    `/api/batches/${id}`,
  );
}

export function listOutputs(params: { taskId?: string; batchId?: string } = {}) {
  const query = new URLSearchParams();
  if (params.taskId) query.set("taskId", params.taskId);
  if (params.batchId) query.set("batchId", params.batchId);
  return request<{ items: ImageOutput[] }>(`/api/outputs?${query}`);
}

export function retryTask(id: string) {
  return request<ImageTask>(`/api/tasks/${id}/retry`, { method: "POST" });
}

export function pauseBatch(id: string) {
  return request<Batch>(`/api/batches/${id}/pause`, { method: "POST" });
}

export function resumeBatch(id: string) {
  return request<Batch>(`/api/batches/${id}/resume`, { method: "POST" });
}

export function cancelBatch(id: string) {
  return request<Batch>(`/api/batches/${id}/cancel`, { method: "POST" });
}

export function retryFailedBatch(id: string) {
  return request<{ retried: number }>(`/api/batches/${id}/retry-failed`, { method: "POST" });
}
