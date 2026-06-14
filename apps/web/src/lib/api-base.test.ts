import { describe, expect, test } from "vitest";
import { resolveApiBaseUrl } from "./api-base.js";

describe("resolveApiBaseUrl", () => {
  test("uses explicit configured API base URL when provided", () => {
    expect(resolveApiBaseUrl("https://api.example.test/", { protocol: "http:", hostname: "192.168.1.5" })).toBe(
      "https://api.example.test",
    );
  });

  test("falls back to the current browser host for LAN access", () => {
    expect(resolveApiBaseUrl("", { protocol: "http:", hostname: "192.168.31.20" })).toBe(
      "http://192.168.31.20:8787",
    );
  });

  test("treats auto as same-host LAN mode", () => {
    expect(resolveApiBaseUrl("auto", { protocol: "http:", hostname: "192.168.31.20" })).toBe(
      "http://192.168.31.20:8787",
    );
  });

  test("falls back to localhost when no browser location is available", () => {
    expect(resolveApiBaseUrl("", undefined)).toBe("http://localhost:8787");
  });
});
