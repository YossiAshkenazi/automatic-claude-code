# Gemini Context: Automatic Claude Code

## Project Overview

This repository contains "Automatic Claude Code" (`acc`), a command-line tool that automates software development tasks by running the `@anthropic-ai/claude-code` CLI in a continuous loop. The core feature is a dual-agent architecture consisting of a "Manager" agent for planning and a "Worker" agent for implementation.

The project is structured as a pseudo-monorepo with two main components:

1.  **Core CLI (`/`)**: The main `acc` tool written in TypeScript. It handles command-line parsing, session management, and orchestrating the agent loops.
2.  **Monitoring Dashboard (`/dual-agent-monitor`)**: A full-stack application for real-time monitoring of the agent interactions. The frontend is built with **React (Vite)** and the backend is an **Express** server using **WebSockets** for communication.

**Key Technologies:**
- **CLI**: TypeScript, Node.js, Commander.js, pnpm
- **Monitoring Frontend**: React, TypeScript, Vite, Tailwind CSS, Reactflow
- **Monitoring Backend**: Node.js, Express, TypeScript, ws (WebSockets), PostgreSQL/SQLite
- **Tooling**: Docker, ESLint, Prettier, Vitest, Playwright

## Building and Running

### Installation

The project uses `pnpm` as its package manager. Dependencies are not shared in a workspace, so installation must be run in both directories.

```bash
# Install root dependencies
pnpm install

# Install monitoring dashboard dependencies
cd dual-agent-monitor
pnpm install
```

### Core Application (CLI)

- **Build:** `pnpm run build` (compiles TypeScript in `src/` to `dist/`)
- **Run (Dev):** `pnpm run dev -- run "your task"`
- **Run (Prod):** `node dist/index.js run "your task"` or use the linked `acc` command.
- **Run Dual-Agent Mode:** `acc run "your task" --dual-agent`

### Monitoring Dashboard

- **Run (Dev):** From the `dual-agent-monitor` directory:
  ```bash
  # Starts the React frontend, Express backend, and WebSocket server
  pnpm run dev
  ```
  - Frontend UI: `http://localhost:6011`
  - Backend API: `http://localhost:4001`

- **Run (Production via Docker):**
  ```bash
  # Build and run all services in production mode
  pnpm run docker:prod
  ```

### Testing

The testing strategy is fragmented. The most comprehensive setup is in `dual-agent-monitor`.

- **Run all monitor tests (unit, integration):**
  ```bash
  cd dual-agent-monitor
  pnpm run test
  ```
- **Run E2E tests:**
  ```bash
  cd dual-agent-monitor
  pnpm run test:e2e
  ```

## Development Conventions

- **Package Manager**: `pnpm` is used throughout the project.
- **Code Style**: The project is configured with **ESLint** and **Prettier**. Run `pnpm run lint` and `pnpm run prettier:fix` within `dual-agent-monitor` to maintain style.
- **Architecture**:
    - The core logic for the CLI is in `src/`. The entry point is `src/index.ts`.
    - The dual-agent orchestration logic is primarily in `src/agentOrchestrator.ts`.
    - The definitions for the Manager and Worker agents are in `src/agents/`.
    - The monitoring dashboard is a self-contained Vite/Express app in `dual-agent-monitor/`.
- **State & Sessions**: Development sessions are saved as JSON files in the `.claude-sessions/` directory at the root.
- **Git**: No explicit commit message convention is defined.
