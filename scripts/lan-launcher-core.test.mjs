import { describe, expect, test } from "vitest";
import {
  buildAccessUrls,
  detectPackageManager,
  formatDuration,
  getDefaultRegistry,
  hasConfiguredEnvValue,
  isUsableNodeVersion,
  mergeRuntimeEnv,
  resolvePorts,
  selectLanAddresses,
} from "./lan-launcher-core.mjs";

describe("lan launcher core", () => {
  test("accepts supported Node.js versions and rejects old versions", () => {
    expect(isUsableNodeVersion("v20.11.1")).toBe(true);
    expect(isUsableNodeVersion("22.2.0")).toBe(true);
    expect(isUsableNodeVersion("v18.19.0")).toBe(true);
    expect(isUsableNodeVersion("v16.20.2")).toBe(false);
    expect(isUsableNodeVersion("not-a-version")).toBe(false);
  });

  test("uses China mainland npm mirror by default without CLI selection", () => {
    expect(getDefaultRegistry()).toBe("https://registry.npmmirror.com");
  });

  test("filters LAN addresses and skips internal or virtual adapters", () => {
    const addresses = selectLanAddresses({
      lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
      eth0: [{ address: "192.168.31.20", family: "IPv4", internal: false }],
      docker0: [{ address: "172.17.0.1", family: "IPv4", internal: false }],
      tailscale0: [{ address: "100.64.0.2", family: "IPv4", internal: false }],
      wlan0: [{ address: "10.0.0.8", family: "IPv4", internal: false }],
    });

    expect(addresses).toEqual(["192.168.31.20", "10.0.0.8"]);
  });

  test("builds local and LAN URLs from detected addresses", () => {
    expect(buildAccessUrls(["192.168.31.20"], 5173, 8787)).toEqual({
      localWeb: "http://localhost:5173",
      localApi: "http://localhost:8787",
      lanWeb: ["http://192.168.31.20:5173"],
      lanApi: ["http://192.168.31.20:8787"],
    });
  });

  test("detects configured env values without exposing values", () => {
    expect(hasConfiguredEnvValue("IMAGE_API_KEY=abc123\n", "IMAGE_API_KEY")).toBe(true);
    expect(hasConfiguredEnvValue("IMAGE_API_KEY=YOUR_API_KEY\n", "IMAGE_API_KEY")).toBe(false);
    expect(hasConfiguredEnvValue("# IMAGE_API_KEY=abc123\n", "IMAGE_API_KEY")).toBe(false);
    expect(hasConfiguredEnvValue("", "IMAGE_API_KEY")).toBe(false);
  });

  test("selects package manager command for the current platform", () => {
    expect(detectPackageManager("win32")).toBe("pnpm.cmd");
    expect(detectPackageManager("darwin")).toBe("pnpm");
    expect(detectPackageManager("linux")).toBe("pnpm");
  });

  test("lets process env override .env values for smoke tests and launch overrides", () => {
    const env = mergeRuntimeEnv({ API_PORT: "8787", WEB_PORT: "5173" }, {
      API_PORT: "18878",
      WEB_PORT: "15173",
    });

    expect(resolvePorts(env)).toEqual({ apiPort: 18878, webPort: 15173 });
  });

  test("formats durations for Chinese progress output", () => {
    expect(formatDuration(999)).toBe("0.9 秒");
    expect(formatDuration(65_000)).toBe("1 分 5 秒");
  });
});
