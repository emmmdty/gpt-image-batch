import type { FastifyReply } from "fastify";
import { ZodError } from "zod";

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function ok<T>(reply: FastifyReply, data: T): FastifyReply {
  return reply.send({ ok: true, data });
}

export function errorPayload(error: unknown): {
  statusCode: number;
  body: { ok: false; error: { code: string; message: string } };
} {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unexpected server error",
      },
    },
  };
}
