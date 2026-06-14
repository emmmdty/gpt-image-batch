import type { ImageTask } from "@gpt-image-batch/db";

export const imageSizes = ["1024x1024", "1536x1024", "1024x1536", "auto"] as const;
export const imageQualities = ["low", "medium", "high", "auto"] as const;
export const imageOutputFormats = ["png", "jpeg", "webp"] as const;

export type ImageSize = (typeof imageSizes)[number];
export type ImageQuality = (typeof imageQualities)[number];
export type ImageOutputFormat = (typeof imageOutputFormats)[number];

export interface ImageRequestPayload {
  model: string;
  prompt: string;
  size: string;
  n: number;
  quality?: string;
  output_format?: string;
}

export interface ImageClientConfig {
  baseUrl: string;
  apiKey: string;
  maxRetries: number;
  retryBaseDelayMs: number;
  onRetry?: (retryCount: number, message: string) => void;
}

export interface GenerateImageInput {
  task: ImageTask;
  outputDir: string;
}

export interface SavedImageOutput {
  filePath: string;
  fileName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  indexNo: number;
}

export interface GenerateImageResult {
  requestJson: string;
  responseJson: string;
  outputs: SavedImageOutput[];
}

export interface ImageApiResponseItem {
  b64_json?: string;
  url?: string;
  revised_prompt?: string;
  [key: string]: unknown;
}

export interface ImageApiResponse {
  created?: number;
  data?: ImageApiResponseItem[];
  [key: string]: unknown;
}
