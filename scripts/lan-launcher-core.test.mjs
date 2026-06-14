import { describe, expect, test } from "vitest";
import {
  buildAccessUrls,
  createNpxPnpmRunner,
  createPnpmRunner,
  createSpawnSpec,
  detectPackageManager,
  detectNpmCommand,
  getCorepackPrepareArgs,
  formatDuration,
  getDefaultRegistry,
  getPnpmInstallArgs,
  hasConfiguredEnvValue,
  isUsableNodeVersion,
  mergeRuntimeEnv,
  planAvailablePorts,
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
    expect(detectNpmCommand("win32")).toBe("npm.cmd");
    expect(detectNpmCommand("darwin")).toBe("npm");
  });

  test("builds automatic pnpm install commands with China mirror", () => {
    expect(getCorepackPrepareArgs()).toEqual(["prepare", "pnpm@10.33.2", "--activate"]);
    expect(getPnpmInstallArgs("https://registry.npmmirror.com")).toEqual([
      "install",
      "--global",
      "pnpm@10.33.2",
      "--registry",
      "https://registry.npmmirror.com",
    ]);
  });

  test("falls back from direct pnpm to npx pnpm runner", () => {
    expect(createPnpmRunner("win32")).toEqual({ command: "pnpm.cmd", prefixArgs: [] });
    expect(createNpxPnpmRunner("win32")).toEqual({
      command: "npx.cmd",
      prefixArgs: ["--yes", "pnpm@10.33.2"],
    });
  });

  test("wraps Windows commands with cmd.exe without shell option args", () => {
    expect(createSpawnSpec("win32", "pnpm.cmd", ["install", "--registry", "https://registry.npmmirror.com"])).toEqual({
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm.cmd install --registry https://registry.npmmirror.com"],
    });
    expect(createSpawnSpec("linux", "pnpm", ["install"])).toEqual({
      command: "pnpm",
      args: ["install"],
    });
  });

  test("lets process env override .env values for smoke tests and launch overrides", () => {
    const env = mergeRuntimeEnv({ API_PORT: "8787", WEB_PORT: "5173" }, {
      API_PORT: "18878",
      WEB_PORT: "15173",
    });

    expect(resolvePorts(env)).toEqual({ apiPort: 18878, webPort: 15173 });
  });

  test("plans next available ports when defaults are occupied", () => {
    const occupied = new Set([8787, 8788, 5173]);
    expect(planAvailablePorts({ apiPort: 8787, webPort: 5173 }, (port) => !occupied.has(port))).toEqual({
      apiPort: 8789,
      webPort: 5174,
    });
  });

  test("keeps API and Web on different ports when starting values overlap", () => {
    expect(planAvailablePorts({ apiPort: 8787, webPort: 8787 }, () => true)).toEqual({
      apiPort: 8787,
      webPort: 8788,
    });
  });

  test("formats durations for Chinese progress output", () => {
    expect(formatDuration(999)).toBe("0.9 秒");
    expect(formatDuration(65_000)).toBe("1 分 5 秒");
  });
});
