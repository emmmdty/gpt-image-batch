# LAN Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build cross-platform one-command LAN startup with self-checks, default China mirror setup, and Chinese progress output.

**Architecture:** Thin platform wrappers bootstrap Node.js where possible, then delegate to a shared Node.js launcher. Pure launcher helpers are isolated for tests; runtime process orchestration stays in `scripts/start-lan.mjs`.

**Tech Stack:** Node.js ESM, PowerShell, Bash, pnpm/corepack, Vitest.

---

### Task 1: Launcher Core Helpers

**Files:**
- Create: `scripts/lan-launcher-core.mjs`
- Create: `scripts/lan-launcher-core.test.mjs`
- Modify: `package.json`

- [x] Add tests for version checks, default registry, LAN address filtering, and status text.
- [x] Implement pure helper functions.
- [x] Wire root test script to run launcher tests.

### Task 2: Shared Runtime Launcher

**Files:**
- Create: `scripts/start-lan.mjs`

- [x] Implement CLI flags, Chinese stage logging, environment checks, pnpm install, database migration, port checks, and service startup.
- [x] Ensure API keys and `.env` values are not printed.

### Task 3: Platform Entrypoints

**Files:**
- Create: `start-lan.ps1`
- Create: `start-lan.sh`
- Create: `start-lan.command`

- [x] Add native Windows and macOS/Linux launchers.
- [x] Bootstrap Node.js when practical and provide Chinese fallback instructions.
- [x] Keep windows open after errors.

### Task 4: Documentation and Verification

**Files:**
- Modify: `README.md`

- [x] Document Windows, macOS Intel, macOS Apple Silicon, China mirror, WSL fallback, and common failures.
- [x] Run `pnpm test`, `pnpm build`, and `pnpm lint`.
