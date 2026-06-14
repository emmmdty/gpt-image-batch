import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const batchStatusValues = [
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;

export const taskStatusValues = ["pending", "running", "success", "failed", "cancelled"] as const;

export type BatchStatus = (typeof batchStatusValues)[number];
export type TaskStatus = (typeof taskStatusValues)[number];

export const batches = sqliteTable("batches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().$type<BatchStatus>(),
  totalTasks: integer("total_tasks").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  pendingCount: integer("pending_count").notNull().default(0),
  runningCount: integer("running_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const imageTasks = sqliteTable("image_tasks", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").references(() => batches.id),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  model: text("model").notNull(),
  size: text("size").notNull(),
  quality: text("quality").notNull(),
  outputFormat: text("output_format").notNull(),
  n: integer("n").notNull(),
  status: text("status").notNull().$type<TaskStatus>(),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  errorMessage: text("error_message"),
  requestJson: text("request_json"),
  responseJson: text("response_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
});

export const imageOutputs = sqliteTable("image_outputs", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => imageTasks.id),
  batchId: text("batch_id").references(() => batches.id),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  indexNo: integer("index_no").notNull(),
  createdAt: text("created_at").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Batch = typeof batches.$inferSelect;
export type NewBatch = typeof batches.$inferInsert;
export type ImageTask = typeof imageTasks.$inferSelect;
export type NewImageTask = typeof imageTasks.$inferInsert;
export type ImageOutput = typeof imageOutputs.$inferSelect;
export type NewImageOutput = typeof imageOutputs.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
