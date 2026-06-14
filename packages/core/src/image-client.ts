import { saveImageBuffer } from "./storage.js";
import type {
  GenerateImageInput,
  GenerateImageResult,
  ImageApiResponse,
  ImageClientConfig,
  ImageRequestPayload,
} from "./image-types.js";

interface RetryableFailureInput {
  status?: number;
  networkError?: boolean;
}

export class ImageApiError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly responseBody?: unknown;
  readonly networkError: boolean;
  requestJson?: string;
  responseJson?: string;

  constructor(
    message: string,
    options: RetryableFailureInput & { code?: string; responseBody?: unknown } = {},
  ) {
    super(message);
    this.name = "ImageApiError";
    this.status = options.status;
    this.code = options.code ?? "IMAGE_API_ERROR";
    this.responseBody = options.responseBody;
    this.networkError = options.networkError ?? false;
  }
}

export function buildImageRequestVariants(payload: ImageRequestPayload): ImageRequestPayload[] {
  const full = { ...payload };
  const withoutOutputFormat = { ...full };
  delete withoutOutputFormat.output_format;
  const withoutQuality = { ...withoutOutputFormat };
  delete withoutQuality.quality;

  const variants = [full, withoutOutputFormat, withoutQuality];
  const seen = new Set<string>();
  return variants.filter((variant) => {
    const key = JSON.stringify(variant);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function sanitizeImageResponseForStorage(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeImageResponseForStorage(item));
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, innerValue] of Object.entries(value)) {
      if (key === "b64_json" && typeof innerValue === "string") {
        next[key] = `[base64 omitted: ${innerValue.length} chars]`;
      } else {
        next[key] = sanitizeImageResponseForStorage(innerValue);
      }
    }
    return next;
  }
  return value;
}

export function isRetryableImageFailure(input: RetryableFailureInput): boolean {
  if (input.networkError) {
    return true;
  }
  return (
    input.status === 429 ||
    input.status === 500 ||
    input.status === 502 ||
    input.status === 503 ||
    input.status === 504
  );
}

function isUnsupportedParameterError(error: ImageApiError): boolean {
  if (error.status !== 400) {
    return false;
  }
  const text = JSON.stringify(error.responseBody ?? error.message).toLowerCase();
  return (
    /unknown|invalid|unsupported|unrecognized/.test(text) &&
    /parameter|quality|output_format/.test(text)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function errorMessageFromBody(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: unknown } }).error;
    if (error && typeof error.message === "string") {
      return error.message;
    }
  }
  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof (body as { message?: unknown }).message === "string"
  ) {
    return (body as { message: string }).message;
  }
  return "Image API request failed";
}

function attachStorageJson(
  error: unknown,
  request: ImageRequestPayload,
  response: unknown,
): unknown {
  if (error instanceof ImageApiError) {
    error.requestJson = JSON.stringify(request);
    error.responseJson = JSON.stringify(sanitizeImageResponseForStorage(response));
  }
  return error;
}

async function requestJsonWithRetry(
  url: string,
  payload: ImageRequestPayload,
  config: ImageClientConfig,
): Promise<ImageApiResponse> {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await readResponseBody(response);
      if (!response.ok) {
        throw new ImageApiError(errorMessageFromBody(body), {
          status: response.status,
          responseBody: body,
        });
      }
      return body as ImageApiResponse;
    } catch (error) {
      const imageError =
        error instanceof ImageApiError
          ? error
          : new ImageApiError(error instanceof Error ? error.message : "Network request failed", {
              networkError: true,
            });

      if (!isRetryableImageFailure(imageError) || attempt >= config.maxRetries) {
        throw attachStorageJson(imageError, payload, imageError.responseBody);
      }

      attempt += 1;
      config.onRetry?.(attempt, imageError.message);
      await sleep(config.retryBaseDelayMs * 2 ** (attempt - 1));
    }
  }
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string | null }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ImageApiError(`Image download failed with HTTP ${response.status}`, {
      status: response.status,
    });
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get("content-type"),
  };
}

export class ImageClient {
  private readonly config: ImageClientConfig;

  constructor(config: ImageClientConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ""),
    };
  }

  async generateAndSave(input: GenerateImageInput): Promise<GenerateImageResult> {
    const payload: ImageRequestPayload = {
      model: input.task.model,
      prompt: input.task.prompt,
      size: input.task.size,
      n: input.task.n,
      quality: input.task.quality,
      output_format: input.task.outputFormat,
    };

    const variants = buildImageRequestVariants(payload);
    const url = `${this.config.baseUrl}/images/generations`;
    let finalRequest = variants[0] ?? payload;
    let response: ImageApiResponse | undefined;

    for (const variant of variants) {
      finalRequest = variant;
      try {
        response = await requestJsonWithRetry(url, variant, this.config);
        break;
      } catch (error) {
        if (
          error instanceof ImageApiError &&
          isUnsupportedParameterError(error) &&
          variant !== variants[variants.length - 1]
        ) {
          continue;
        }
        if (error instanceof ImageApiError) {
          error.requestJson = JSON.stringify(variant);
          error.responseJson = JSON.stringify(sanitizeImageResponseForStorage(error.responseBody));
        }
        throw error;
      }
    }

    if (!response?.data?.length) {
      throw new ImageApiError("Image API returned no images", {
        code: "EMPTY_IMAGE_RESPONSE",
        responseBody: response,
      });
    }

    const outputs = [];
    for (const [index, item] of response.data.entries()) {
      let buffer: Buffer;
      let mimeType: string | null = null;

      if (item.b64_json) {
        buffer = Buffer.from(item.b64_json.replace(/^data:image\/\w+;base64,/, ""), "base64");
      } else if (item.url) {
        const downloaded = await downloadImage(item.url);
        buffer = downloaded.buffer;
        mimeType = downloaded.mimeType;
      } else {
        throw new ImageApiError("Image API response item did not include b64_json or url", {
          code: "INVALID_IMAGE_RESPONSE",
          responseBody: item,
        });
      }

      outputs.push(
        await saveImageBuffer({
          buffer,
          outputDir: input.outputDir,
          batchId: input.task.batchId,
          taskId: input.task.id,
          indexNo: index,
          outputFormat: input.task.outputFormat,
          mimeType,
          size: input.task.size,
        }),
      );
    }

    return {
      requestJson: JSON.stringify(finalRequest),
      responseJson: JSON.stringify(sanitizeImageResponseForStorage(response)),
      outputs,
    };
  }
}
