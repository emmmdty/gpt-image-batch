#!/usr/bin/env node
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildAccessUrls,
  createStageLogger,
  detectPackageManager,
  formatCommand,
  getDefaultRegistry,
  hasConfiguredEnvValue,
  hasFlag,
  isUsableNodeVersion,
  mergeRuntimeEnv,
  resolvePorts,
  selectLanAddresses,
} from "./lan-launcher-core.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logger = createStageLogger();
const args = process.argv.slice(2);
const packageManager = detectPackageManager(process.platform);
const childProcesses = new Set();
let shuttingDown = false;

main().catch((error) => {
  console.error(`\n启动失败：${error.message}`);
  console.error("请根据上方提示修复后重试。");
  process.exitCode = 1;
});

async function main() {
  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    printHelp();
    return;
  }

  printBanner();
  process.chdir(rootDir);

  const envText = loadEnvFile();
  const env = parseEnv(envText);
  const ports = resolvePorts(mergeRuntimeEnv(env, process.env));
  const registry = getDefaultRegistry();

  checkNode();
  await checkCorepack();
  await checkWritableDirectories();
  await ensureEnvFile(envText);
  await ensurePortsAvailable(ports);
  await installDependencies(registry);
  await migrateDatabase();
  await startServices(ports);
}

function printBanner() {
  console.log("");
  console.log("GPT Image Batch 局域网启动器");
  console.log("目标：自检环境、启动后端和前端，并显示本机与局域网访问地址。");
}

function printHelp() {
  console.log(`GPT Image Batch 局域网启动器

用法：
  node scripts/start-lan.mjs

参数：
  --skip-install      跳过 pnpm install
  --skip-migrate      跳过 pnpm db:migrate
  --help              显示帮助

说明：
  依赖安装默认使用 https://registry.npmmirror.com
`);
}

function loadEnvFile() {
  const envPath = path.join(rootDir, ".env");
  return fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
}

function parseEnv(envText) {
  const env = {};
  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function checkNode() {
  logger.start("检查 Node.js");
  if (!isUsableNodeVersion(process.version)) {
    throw new Error(`当前 Node.js 版本是 ${process.version}，需要 Node.js 18 或更高版本。`);
  }
  logger.success(`Node.js ${process.version} 可用`);
}

async function checkCorepack() {
  logger.start("检查 pnpm/corepack");
  try {
    await runCommand("corepack", ["--version"], { quiet: true });
  } catch {
    logger.warn("没有检测到 corepack，将尝试继续使用 pnpm。");
  }

  try {
    await runCommand("corepack", ["enable"], { quiet: true });
    logger.info("已执行 corepack enable。");
  } catch {
    logger.warn("corepack enable 未成功。如果 pnpm 已安装，可以继续。");
  }

  try {
    const result = await runCommand(packageManager, ["--version"], { quiet: true });
    logger.success(`pnpm ${result.stdout.trim()} 可用`);
  } catch {
    throw new Error(
      "未检测到 pnpm。请先安装 Node.js 18+，然后运行：corepack enable && corepack prepare pnpm@10.33.2 --activate",
    );
  }
}

async function checkWritableDirectories() {
  logger.start("检查本地目录权限");
  for (const dir of ["data", "outputs", "uploads"]) {
    const fullPath = path.join(rootDir, dir);
    fs.mkdirSync(fullPath, { recursive: true });
    const testPath = path.join(fullPath, ".write-test");
    fs.writeFileSync(testPath, "ok");
    fs.rmSync(testPath, { force: true });
    logger.info(`${dir}/ 可写`);
  }
  logger.success("本地目录权限正常");
}

async function ensureEnvFile(envText) {
  logger.start("检查配置文件");
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) {
    const examplePath = path.join(rootDir, ".env.example");
    if (!fs.existsSync(examplePath)) {
      throw new Error("未找到 .env，也未找到 .env.example。");
    }
    fs.copyFileSync(examplePath, envPath);
    logger.warn("已从 .env.example 创建 .env，请在 Settings 页面或 .env 中配置 API key。");
  }

  const currentEnvText = fs.readFileSync(envPath, "utf8");
  if (hasConfiguredEnvValue(currentEnvText, "IMAGE_API_KEY")) {
    logger.info("IMAGE_API_KEY 已配置（已脱敏，不显示内容）。");
  } else {
    logger.warn("IMAGE_API_KEY 未配置。应用仍会启动，请在 Settings 页面填写 API key 后再生图。");
  }
  if (!hasConfiguredEnvValue(currentEnvText, "IMAGE_API_BASE_URL")) {
    logger.warn("IMAGE_API_BASE_URL 未配置，将使用应用默认值或 Settings 页面配置。");
  }
  logger.success("配置检查完成");
}

async function ensurePortsAvailable({ apiPort, webPort }) {
  logger.start("检查端口占用");
  await assertPortAvailable(apiPort, "API");
  await assertPortAvailable(webPort, "Web");
  logger.success(`端口可用：API ${apiPort}，Web ${webPort}`);
}

async function installDependencies(registry) {
  if (hasFlag(args, "--skip-install")) {
    logger.warn("已跳过依赖安装。");
    return;
  }
  logger.start("安装或校验依赖");
  const installArgs = ["install"];
  if (registry) {
    installArgs.push("--registry", registry);
    logger.info(`使用 registry：${registry}`);
  }
  await runCommand(packageManager, installArgs);
  logger.success("依赖已准备好");
}

async function migrateDatabase() {
  if (hasFlag(args, "--skip-migrate")) {
    logger.warn("已跳过数据库初始化。");
    return;
  }
  logger.start("初始化 SQLite 数据库");
  await runCommand(packageManager, ["db:migrate"]);
  logger.success("数据库已准备好");
}

async function startServices({ apiPort, webPort }) {
  logger.start("启动本地服务");
  const lanAddresses = selectLanAddresses(os.networkInterfaces());
  const urls = buildAccessUrls(lanAddresses, webPort, apiPort);
  const env = {
    ...process.env,
    API_PORT: String(apiPort),
    WEB_PORT: String(webPort),
    VITE_API_BASE_URL: "auto",
  };

  const api = spawnProcess("API", packageManager, ["dev:api"], env);
  const web = spawnProcess("Web", packageManager, ["dev:web"], env);

  logger.success("服务启动命令已执行，下面会持续输出日志");
  console.log("");
  console.log("访问地址：");
  console.log(`  本机 Web：${urls.localWeb}`);
  console.log(`  本机 API：${urls.localApi}`);
  if (urls.lanWeb.length > 0) {
    console.log("  局域网 Web：");
    for (const url of urls.lanWeb) {
      console.log(`    ${url}`);
    }
    console.log("  局域网 API：");
    for (const url of urls.lanApi) {
      console.log(`    ${url}`);
    }
  } else {
    console.log("  未检测到可用局域网 IPv4 地址。请确认 Wi-Fi/网线连接和防火墙设置。");
  }
  console.log("");
  console.log("保持此窗口打开。按 Ctrl+C 可以同时停止 API 和 Web。");
  console.log("");

  installSignalHandlers();
  await Promise.race([
    waitForExit(api, "API"),
    waitForExit(web, "Web"),
  ]);
}

function spawnProcess(label, command, childArgs, env) {
  console.log(`  启动 ${label}: ${formatCommand(command, childArgs)}`);
  const child = spawn(command, childArgs, {
    cwd: rootDir,
    env,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  childProcesses.add(child);
  child.stdout.on("data", (chunk) => prefixOutput(label, chunk, false));
  child.stderr.on("data", (chunk) => prefixOutput(label, chunk, true));
  child.on("exit", () => {
    childProcesses.delete(child);
  });
  return child;
}

function prefixOutput(label, chunk, isError) {
  const output = chunk.toString();
  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }
    const target = isError ? process.stderr : process.stdout;
    target.write(`[${label}] ${line}\n`);
  }
}

function waitForExit(child, label) {
  return new Promise((resolve, reject) => {
    child.on("error", (error) => reject(new Error(`${label} 启动失败：${error.message}`)));
    child.on("exit", (code, signal) => {
      if (shuttingDown) {
        resolve();
        return;
      }
      if (signal === "SIGINT" || signal === "SIGTERM") {
        resolve();
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} 服务已退出，退出码：${code ?? signal}`));
    });
  });
}

function installSignalHandlers() {
  const stop = () => {
    shuttingDown = true;
    console.log("\n正在停止服务...");
    for (const child of childProcesses) {
      child.kill("SIGINT");
    }
    setTimeout(() => process.exit(0), 800).unref();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

function assertPortAvailable(port, label) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error(`${label} 端口 ${port} 已被占用。请关闭占用程序，或在 .env 中修改端口。`));
        return;
      }
      reject(error);
    });
    server.once("listening", () => {
      server.close(() => resolve());
    });
    server.listen(port, "0.0.0.0");
  });
}

function runCommand(command, commandArgs, options = {}) {
  if (!options.quiet) {
    console.log(`  $ ${formatCommand(command, commandArgs)}`);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: rootDir,
      shell: process.platform === "win32",
      stdio: options.quiet ? ["ignore", "pipe", "pipe"] : "inherit",
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    if (options.quiet) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${formatCommand(command, commandArgs)} 执行失败，退出码 ${code}`));
    });
  });
}
