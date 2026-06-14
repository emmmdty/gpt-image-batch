import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { resolveApiBaseUrl } from "./api-base.js";
import type { BatchStatus, TaskStatus } from "./types.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function shortText(value: string, length = 60): string {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

export const statusLabel: Record<TaskStatus | BatchStatus, string> = {
  pending: "等待中",
  running: "运行中",
  success: "成功",
  failed: "失败",
  cancelled: "已取消",
  paused: "已暂停",
  completed: "已完成",
};

export const statusClass: Record<TaskStatus | BatchStatus, string> = {
  pending: "border-slate-500/30 bg-slate-500/12 text-slate-200",
  running: "border-blue-500/30 bg-blue-500/14 text-blue-200",
  success: "border-emerald-500/30 bg-emerald-500/14 text-emerald-200",
  failed: "border-red-500/30 bg-red-500/14 text-red-200",
  cancelled: "border-slate-500/30 bg-slate-500/12 text-slate-300",
  paused: "border-yellow-500/30 bg-yellow-500/14 text-yellow-200",
  completed: "border-emerald-500/30 bg-emerald-500/14 text-emerald-200",
};

export function absoluteApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) {
    return pathOrUrl;
  }
  return `${resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)}${pathOrUrl}`;
}
