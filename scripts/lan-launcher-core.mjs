const CHINA_MIRROR_REGISTRY = "https://registry.npmmirror.com";
const PNPM_VERSION = "10.33.2";
const MIN_NODE_MAJOR = 18;
const DEFAULT_WEB_PORT = 5173;
const DEFAULT_API_PORT = 8787;

const VIRTUAL_INTERFACE_PATTERNS = [
  /^docker/i,
  /^br-/i,
  /^veth/i,
  /^vmnet/i,
  /^utun/i,
  /^tailscale/i,
  /^zt/i,
  /^wg/i,
  /^lo/i,
];

export function isUsableNodeVersion(version) {
  const match = String(version).trim().match(/^v?(\d+)\./);
  if (!match) {
    return false;
  }
  return Number(match[1]) >= MIN_NODE_MAJOR;
}

export function getDefaultRegistry() {
  return CHINA_MIRROR_REGISTRY;
}

export function getPinnedPnpmPackage() {
  return `pnpm@${PNPM_VERSION}`;
}

export function hasFlag(args, flag) {
  return args.includes(flag);
}

export function readPort(value, fallback) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : fallback;
}

export function resolvePorts(env) {
  return {
    apiPort: readPort(env.API_PORT, DEFAULT_API_PORT),
    webPort: readPort(env.WEB_PORT, DEFAULT_WEB_PORT),
  };
}

export function planAvailablePorts(requestedPorts, isPortAvailable, maxAttempts = 50) {
  const apiPort = findAvailablePort(requestedPorts.apiPort, isPortAvailable, new Set(), maxAttempts);
  const webPort = findAvailablePort(
    requestedPorts.webPort,
    isPortAvailable,
    new Set([apiPort]),
    maxAttempts,
  );
  return { apiPort, webPort };
}

function findAvailablePort(startPort, isPortAvailable, reservedPorts, maxAttempts) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    if (candidate > 65_535) {
      break;
    }
    if (!reservedPorts.has(candidate) && isPortAvailable(candidate)) {
      return candidate;
    }
  }
  throw new Error(`无法从端口 ${startPort} 开始找到可用端口。`);
}

export function mergeRuntimeEnv(fileEnv, processEnv) {
  return { ...fileEnv, ...processEnv };
}

export function hasConfiguredEnvValue(envText, key) {
  const lines = String(envText).split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }
    const name = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (name === key && value && !isPlaceholderValue(value)) {
      return true;
    }
  }
  return false;
}

export function isPlaceholderValue(value) {
  const normalized = String(value).trim().toUpperCase();
  return (
    normalized === "YOUR_API_KEY" ||
    normalized === "CHANGE_ME" ||
    normalized === "REPLACE_ME" ||
    normalized.includes("你的真实 API KEY")
  );
}

export function selectLanAddresses(networkInterfaces) {
  const addresses = [];
  for (const [name, entries] of Object.entries(networkInterfaces)) {
    if (VIRTUAL_INTERFACE_PATTERNS.some((pattern) => pattern.test(name))) {
      continue;
    }
    for (const entry of entries || []) {
      if (entry.internal || entry.family !== "IPv4") {
        continue;
      }
      if (isUsefulLanAddress(entry.address)) {
        addresses.push(entry.address);
      }
    }
  }
  return [...new Set(addresses)];
}

export function isUsefulLanAddress(address) {
  if (!address || address.startsWith("127.")) {
    return false;
  }
  if (address.startsWith("169.254.") || address.startsWith("172.17.")) {
    return false;
  }
  if (address.startsWith("100.")) {
    return false;
  }
  return (
    address.startsWith("192.168.") ||
    address.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

export function buildAccessUrls(lanAddresses, webPort, apiPort) {
  return {
    localWeb: `http://localhost:${webPort}`,
    localApi: `http://localhost:${apiPort}`,
    lanWeb: lanAddresses.map((address) => `http://${address}:${webPort}`),
    lanApi: lanAddresses.map((address) => `http://${address}:${apiPort}`),
  };
}

export function detectPackageManager(platform) {
  return platform === "win32" ? "pnpm.cmd" : "pnpm";
}

export function detectNpmCommand(platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

export function detectNpxCommand(platform) {
  return platform === "win32" ? "npx.cmd" : "npx";
}

export function getCorepackPrepareArgs() {
  return ["prepare", getPinnedPnpmPackage(), "--activate"];
}

export function getPnpmInstallArgs(registry) {
  return ["install", "--global", getPinnedPnpmPackage(), "--registry", registry];
}

export function createPnpmRunner(platform) {
  return { command: detectPackageManager(platform), prefixArgs: [] };
}

export function createNpxPnpmRunner(platform) {
  return { command: detectNpxCommand(platform), prefixArgs: ["--yes", getPinnedPnpmPackage()] };
}

export function createSpawnSpec(platform, command, args) {
  if (platform !== "win32") {
    return { command, args };
  }
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", formatCommand(command, args)],
  };
}

export function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return `${(Math.floor(milliseconds / 100) / 10).toFixed(1)} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${minutes} 分 ${restSeconds} 秒`;
}

export function formatCommand(command, args) {
  return [command, ...args].map(quoteCommandPart).join(" ");
}

function quoteCommandPart(part) {
  if (/^[\w@%+=:,./-]+$/.test(part)) {
    return part;
  }
  return JSON.stringify(part);
}

export function createStageLogger({ stdout = process.stdout, now = Date.now } = {}) {
  let stageStartedAt = now();
  return {
    start(message) {
      stageStartedAt = now();
      stdout.write(`\n▶ ${message}\n`);
    },
    info(message) {
      stdout.write(`  ${message}\n`);
    },
    success(message) {
      stdout.write(`✓ ${message}（${formatDuration(now() - stageStartedAt)}）\n`);
    },
    warn(message) {
      stdout.write(`! ${message}\n`);
    },
  };
}
