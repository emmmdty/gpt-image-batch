# LAN Launch Design

## Goal

Add a one-command LAN startup path for non-developer users on native Windows, macOS Intel, macOS Apple Silicon, and WSL fallback.

## Approach

Use thin platform wrappers plus a shared Node.js launcher:

- `start-lan.ps1` handles native Windows PowerShell startup and Node.js bootstrap.
- `start-lan.sh` handles macOS/Linux terminal startup and Node.js bootstrap.
- `start-lan.command` lets macOS users double-click the Bash launcher.
- `scripts/start-lan.mjs` owns shared checks, dependency setup, database migration, service startup, LAN URL display, and Chinese progress output.
- `scripts/lan-launcher-core.mjs` contains testable pure helpers for environment parsing, IP detection, command planning, and user-facing status text.

## Behavior

The launcher checks Node.js, pnpm/corepack, `.env`, dependencies, database migration, port availability, writable data directories, and LAN addresses. It starts API and Web dev servers on `0.0.0.0`, keeps the terminal open with live logs, and prints local/LAN URLs.

For China mainland network conditions, the launcher uses the npmmirror npm registry by default:

- Dependency install always runs with `https://registry.npmmirror.com`.
- Users do not need to choose a registry from the command line.

The launcher never prints API keys or `.env` contents. It only reports whether required configuration exists.

## Error Handling

Checks fail with Chinese messages and exact next actions. Long operations show stage output before running commands so the terminal never appears idle. Windows and macOS wrappers pause before exit on failure so users can read the message.

## Testing

Pure launcher helpers are covered by Vitest. Runtime startup remains integration behavior verified by `pnpm test`, `pnpm build`, and `pnpm lint`.
