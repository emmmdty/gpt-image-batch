export type TaskStatus = "pending" | "running" | "success" | "failed" | "cancelled";
export type BatchStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface Settings {
  baseUrl: string;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
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

export interface ImageTask {
  id: string;
  batchId: string | null;
  prompt: string;
  negativePrompt: string | null;
  model: string;
  size: string;
  quality: string;
  outputFormat: string;
  n: number;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  requestJson: string | null;
  responseJson: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Batch {
  id: string;
  name: string;
  description: string | null;
  status: BatchStatus;
  totalTasks: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  runningCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImageOutput {
  id: string;
  taskId: string;
  batchId: string | null;
  filePath: string;
  fileName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  indexNo: number;
  createdAt: string;
  url: string;
  task?: ImageTask | null;
}

export interface DashboardData {
  todayGenerated: number;
  totalTasks: number;
  success: number;
  failed: number;
  pending: number;
  running: number;
  queue: {
    running: number;
    maxConcurrency: number;
    enabled: boolean;
  };
  recentTasks: ImageTask[];
}
