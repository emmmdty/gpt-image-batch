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
  classifyInstallFailure,
  createNpxPnpmRunner,
  createPnpmRunner,
  createSpawnSpec,
  createStageLogger,
  detectNpmCommand,
  formatCommand,
  getCorepackPrepareArgs,
  getDefaultRegistry,
  getPnpmInstallArgs,
  getPnpmInstallAttempts,
  hasConfiguredEnvValue,
  hasFlag,
  isUsableNodeVersion,
  mergeRuntimeEnv,
  planAvailablePorts,
  resolvePorts,
  selectLanAddresses,
} from "./lan-launcher-core.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logger = createStageLogger();
const args = process.argv.slice(2);
const childProcesses = new Set();
let pnpmRunner = createPnpmRunner(process.platform);
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
  const availablePorts = await resolveAvailablePorts(ports);
  await installDependencies(registry);
  await migrateDatabase();
  await startServices(availablePorts);
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
    logger.warn("corepack enable 未成功，将继续尝试自动准备 pnpm。");
  }

  try {
    await runCommand("corepack", getCorepackPrepareArgs());
    logger.info("已通过 corepack 准备 pnpm。");
  } catch {
    logger.warn("corepack prepare 未成功，将尝试使用 npm 从国内镜像安装 pnpm。");
  }

  try {
    const result = await runPnpm(["--version"], { quiet: true });
    logger.success(`pnpm ${result.stdout.trim()} 可用`);
    return;
  } catch {
    logger.warn("直接运行 pnpm 失败，开始自动安装 pnpm。");
  }

  await installPnpmWithNpm();

  try {
    const result = await runPnpm(["--version"], { quiet: true });
    logger.success(`pnpm ${result.stdout.trim()} 可用`);
    return;
  } catch {
    logger.warn("全局 pnpm 仍不可用，将使用 npx pnpm 兜底运行本项目。");
  }

  pnpmRunner = createNpxPnpmRunner(process.platform);
  const result = await runPnpm(["--version"], { quiet: true });
  logger.success(`npx pnpm ${result.stdout.trim()} 可用`);
}

async function installPnpmWithNpm() {
  const npmCommand = detectNpmCommand(process.platform);
  const installArgs = getPnpmInstallArgs(getDefaultRegistry());
  logger.info(`正在自动安装 pnpm：${formatCommand(npmCommand, installArgs)}`);
  try {
    await runCommand(npmCommand, installArgs);
  } catch (error) {
    logger.warn(`npm 全局安装 pnpm 未成功：${error.message}`);
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

async function resolveAvailablePorts(requestedPorts) {
  logger.start("检查端口占用");
  const availability = new Map();
  for (const port of candidatePortsFor(requestedPorts)) {
    availability.set(port, await isPortAvailable(port));
  }
  const planned = planAvailablePorts(requestedPorts, (port) => {
    if (!availability.has(port)) {
      throw new Error(`端口 ${port} 尚未完成可用性检查。`);
    }
    return availability.get(port);
  });
  if (planned.apiPort !== requestedPorts.apiPort) {
    logger.warn(`API 端口 ${requestedPorts.apiPort} 已被占用，已自动改用 ${planned.apiPort}。`);
  } else {
    logger.info(`API 端口 ${planned.apiPort} 可用。`);
  }
  if (planned.webPort !== requestedPorts.webPort) {
    logger.warn(`Web 端口 ${requestedPorts.webPort} 已被占用，已自动改用 ${planned.webPort}。`);
  } else {
    logger.info(`Web 端口 ${planned.webPort} 可用。`);
  }
  logger.success(`端口已确定：API ${planned.apiPort}，Web ${planned.webPort}`);
  return planned;
}

function candidatePortsFor({ apiPort, webPort }, maxAttempts = 50) {
  const ports = new Set();
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    if (apiPort + offset <= 65_535) {
      ports.add(apiPort + offset);
    }
    if (webPort + offset <= 65_535) {
      ports.add(webPort + offset);
    }
  }
  return ports;
}

async function installDependencies(registry) {
  if (hasFlag(args, "--skip-install")) {
    logger.warn("已跳过依赖安装。");
    return;
  }
  logger.start("安装或校验依赖");
  logger.info(`使用 registry：${registry}`);
  let lastError;
  for (const attempt of getPnpmInstallAttempts(registry)) {
    logger.info(`开始 ${attempt.label}。`);
    try {
      await runPnpm(attempt.args);
      logger.success("依赖已准备好");
      return;
    } catch (error) {
      lastError = error;
      logger.warn(`${attempt.label} 失败：${error.message}`);
      if (attempt.label === "兼容模式安装") {
        removeInstallArtifacts();
      }
    }
  }
  throw createInstallFailureError(lastError);
}

function removeInstallArtifacts() {
  logger.info("正在清理 node_modules，准备重试。");
  fs.rmSync(path.join(rootDir, "node_modules"), { recursive: true, force: true });
  for (const workspacePath of ["apps/api", "apps/web", "packages/core", "packages/db"]) {
    fs.rmSync(path.join(rootDir, workspacePath, "node_modules"), { recursive: true, force: true });
  }
}

function createInstallFailureError(error) {
  const output = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}\n${error?.message ?? ""}`;
  const failureType = classifyInstallFailure(output);
  if (failureType === "native_build_tools") {
    return new Error(
      [
        "依赖安装失败，原因看起来是 Windows native 编译工具缺失或 better-sqlite3 编译失败。",
        "请安装 Visual Studio Build Tools 2022，并勾选“使用 C++ 的桌面开发”。",
        "安装完成后重新双击 start-lan.cmd。",
        `最后失败命令：${error?.commandText ?? "pnpm install"}`,
      ].join("\n"),
    );
  }
  if (failureType === "package_fetch") {
    return new Error(
      [
        "依赖安装失败，原因看起来是网络或 registry 拉包失败。",
        "启动器已使用 npmmirror 并重试多次。请检查代理、防火墙或网络后重新双击 start-lan.cmd。",
        `最后失败命令：${error?.commandText ?? "pnpm install"}`,
      ].join("\n"),
    );
  }
  return new Error(
    [
      "依赖安装失败，启动器已尝试标准安装、兼容模式安装和清理后强制安装。",
      "请查看上方 pnpm 输出中的第一条 ERR 或 node-gyp 错误。",
      `最后失败命令：${error?.commandText ?? "pnpm install"}`,
    ].join("\n"),
  );
}

async function migrateDatabase() {
  if (hasFlag(args, "--skip-migrate")) {
    logger.warn("已跳过数据库初始化。");
    return;
  }
  logger.start("初始化 SQLite 数据库");
  await runPnpm(["db:migrate"]);
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

  const api = spawnProcess("API", pnpmRunner.command, [...pnpmRunner.prefixArgs, "dev:api"], env);
  const web = spawnProcess("Web", pnpmRunner.command, [...pnpmRunner.prefixArgs, "dev:web"], env);

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
  const spec = createSpawnSpec(process.platform, command, childArgs);
  const child = spawn(spec.command, spec.args, {
    cwd: rootDir,
    env,
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

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

function runCommand(command, commandArgs, options = {}) {
  if (!options.quiet) {
    console.log(`  $ ${formatCommand(command, commandArgs)}`);
  }
  return new Promise((resolve, reject) => {
    const spec = createSpawnSpec(process.platform, command, commandArgs);
    const child = spawn(spec.command, spec.args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (!options.quiet) {
        process.stdout.write(text);
      }
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (!options.quiet) {
        process.stderr.write(text);
      }
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(`${formatCommand(command, commandArgs)} 执行失败，退出码 ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      error.commandText = formatCommand(command, commandArgs);
      reject(error);
    });
  });
}

function runPnpm(commandArgs, options = {}) {
  return runCommand(pnpmRunner.command, [...pnpmRunner.prefixArgs, ...commandArgs], options);
}
