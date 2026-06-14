import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildImageRequestVariants,
  ImageApiError,
  ImageClient,
  isRetryableImageFailure,
  sanitizeImageResponseForStorage,
} from "./image-client.js";

describe("image-client helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds compatible fallback payloads by removing unsupported optional params", () => {
    const variants = buildImageRequestVariants({
      model: "gpt-image-2",
      prompt: "一只橘猫坐在未来城市窗边",
      size: "1024x1024",
      quality: "medium",
      output_format: "png",
      n: 1,
    });

    expect(variants).toEqual([
      {
        model: "gpt-image-2",
        prompt: "一只橘猫坐在未来城市窗边",
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
        n: 1,
      },
      {
        model: "gpt-image-2",
        prompt: "一只橘猫坐在未来城市窗边",
        size: "1024x1024",
        quality: "medium",
        n: 1,
      },
      {
        model: "gpt-image-2",
        prompt: "一只橘猫坐在未来城市窗边",
        size: "1024x1024",
        n: 1,
      },
    ]);
  });

  it("removes base64 image payloads before storing responses", () => {
    const sanitized = sanitizeImageResponseForStorage({
      created: 123,
      data: [
        {
          b64_json: "a".repeat(64),
          revised_prompt: "cat",
        },
      ],
    });

    expect(sanitized).toEqual({
      created: 123,
      data: [
        {
          b64_json: "[base64 omitted: 64 chars]",
          revised_prompt: "cat",
        },
      ],
    });
  });

  it("retries transient HTTP and network failures only", () => {
    expect(isRetryableImageFailure({ status: 429 })).toBe(true);
    expect(isRetryableImageFailure({ status: 503 })).toBe(true);
    expect(isRetryableImageFailure({ networkError: true })).toBe(true);
    expect(isRetryableImageFailure({ status: 400 })).toBe(false);
    expect(isRetryableImageFailure({ status: 401 })).toBe(false);
    expect(isRetryableImageFailure({ status: 403 })).toBe(false);
  });

  it("attaches request and response JSON to image API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: {
              message: "No available compatible accounts",
              type: "api_error",
            },
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const client = new ImageClient({
      baseUrl: "https://example.test/v1",
      apiKey: "secret-key",
      maxRetries: 0,
      retryBaseDelayMs: 1,
    });

    const task = {
      id: "task-1",
      batchId: null,
      prompt: "test prompt",
      negativePrompt: null,
      model: "gpt-image-2",
      size: "1024x1024",
      quality: "medium",
      outputFormat: "png",
      n: 1,
      status: "running",
      retryCount: 0,
      maxRetries: 0,
      errorMessage: null,
      requestJson: null,
      responseJson: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    } as const;

    try {
      await client.generateAndSave({ task, outputDir: "/tmp/gpt-image-batch-test" });
      throw new Error("Expected generateAndSave to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageApiError);
      const imageError = error as ImageApiError;
      expect(JSON.parse(imageError.requestJson ?? "{}")).toEqual({
        model: "gpt-image-2",
        prompt: "test prompt",
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
        n: 1,
      });
      expect(JSON.parse(imageError.responseJson ?? "{}")).toEqual({
        error: {
          message: "No available compatible accounts",
          type: "api_error",
        },
      });
    }
  });
});
