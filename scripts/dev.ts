import { type ChildProcess, execFileSync, execSync, spawn } from "node:child_process";
import { connect } from "node:net";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const COLORS = {
  downloader: "\x1b[36m", // cyan
  service: "\x1b[33m", // yellow
  api: "\x1b[32m", // green
  client: "\x1b[35m", // magenta
  reset: "\x1b[0m",
};

// ---------------------------------------------------------------------------
// Prerequisite checker
// ---------------------------------------------------------------------------

function checkPrerequisites(): void {
  const required: { binary: string; hint: string }[] = [
    { binary: "yt-dlp", hint: "brew install yt-dlp  OR  pip install yt-dlp" },
    { binary: "ffmpeg", hint: "brew install ffmpeg" },
    { binary: "protoc", hint: "brew install protobuf" },
    { binary: "cargo", hint: "https://rustup.rs" },
    { binary: "node", hint: "https://nodejs.org" },
  ];

  const missing: { binary: string; hint: string }[] = [];

  for (const req of required) {
    try {
      execFileSync("which", [req.binary], { stdio: "ignore" });
    } catch {
      missing.push(req);
    }
  }

  if (missing.length > 0) {
    console.error("\x1b[31m[dev] Missing required tools:\x1b[0m\n");
    for (const m of missing) {
      console.error(`  - ${m.binary}  -->  ${m.hint}`);
    }
    console.error("");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Color-coded prefix utility
// ---------------------------------------------------------------------------

function prefixOutput(
  child: ChildProcess,
  label: keyof typeof COLORS,
): void {
  const color = COLORS[label];
  const reset = COLORS.reset;
  const tag = `${color}[${label}]${reset}`;

  if (child.stdout) {
    const rl = createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      process.stdout.write(`${tag} ${line}\n`);
    });
  }

  if (child.stderr) {
    const rl = createInterface({ input: child.stderr });
    rl.on("line", (line) => {
      process.stderr.write(`${tag} ${line}\n`);
    });
  }
}

// ---------------------------------------------------------------------------
// waitForPort
// ---------------------------------------------------------------------------

async function waitForPort(
  port: number,
  host = "127.0.0.1",
  timeoutMs = 30000,
): Promise<void> {
  const start = Date.now();

  return new Promise((res, rej) => {
    function attempt() {
      if (Date.now() - start > timeoutMs) {
        rej(new Error(`Timed out waiting for ${host}:${port}`));
        return;
      }

      const socket = connect({ port, host });

      socket.once("connect", () => {
        socket.destroy();
        res();
      });

      socket.once("error", () => {
        socket.destroy();
        setTimeout(attempt, 500);
      });
    }

    attempt();
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

const children: ChildProcess[] = [];
let shuttingDown = false;

function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("\n\x1b[31m[dev] Shutting down...\x1b[0m");

  // Iterate in reverse: client -> api -> service
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGTERM");
    }
  }

  // Force kill after 5 seconds
  setTimeout(() => {
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(0);
  }, 5000);

  // Exit immediately if all children already exited
  const checkDone = setInterval(() => {
    const allDead = children.every(
      (c) => c.exitCode !== null || c.killed,
    );
    if (allDead) {
      clearInterval(checkDone);
      process.exit(0);
    }
  }, 200);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Prerequisites
  checkPrerequisites();

  // 2. Build yt-downloader (synchronous)
  console.log(`${COLORS.downloader}[downloader]${COLORS.reset} Building...`);
  try {
    execSync("npx nx build yt-downloader", {
      cwd: ROOT,
      stdio: "inherit",
    });
  } catch {
    console.error(
      `${COLORS.downloader}[downloader]${COLORS.reset} Build failed`,
    );
    process.exit(1);
  }
  console.log(
    `${COLORS.downloader}[downloader]${COLORS.reset} Build complete`,
  );

  // Helper: spawn a long-running service and handle unexpected exit
  function spawnService(
    label: keyof typeof COLORS,
    command: string,
    args: string[],
    cwd: string,
  ): ChildProcess {
    const child = spawn(command, args, {
      cwd: resolve(ROOT, cwd),
      stdio: ["pipe", "pipe", "pipe"],
    });

    prefixOutput(child, label);
    children.push(child);

    child.on("exit", (code) => {
      if (!shuttingDown) {
        console.error(
          `${COLORS[label]}[${label}]${COLORS.reset} Exited unexpectedly (code ${code})`,
        );
        shutdown();
      }
    });

    return child;
  }

  // 3. Start yt-service
  console.log(`${COLORS.service}[service]${COLORS.reset} Starting gRPC server...`);
  spawnService("service", "npx", ["tsx", "src/index.ts"], "packages/yt-service");

  // 4. Wait for port 50051
  try {
    await waitForPort(50051);
    console.log(`${COLORS.service}[service]${COLORS.reset} gRPC server ready on port 50051`);
  } catch (err) {
    console.error(
      `${COLORS.service}[service]${COLORS.reset} Failed to start: ${err}`,
    );
    shutdown();
    return;
  }

  // 5. Start yt-api
  console.log(`${COLORS.api}[api]${COLORS.reset} Starting REST API...`);
  spawnService("api", "cargo", ["run"], "packages/yt-api");

  // 6. Wait for port 3000
  try {
    await waitForPort(3000);
    console.log(`${COLORS.api}[api]${COLORS.reset} REST API ready on port 3000`);
  } catch (err) {
    console.error(
      `${COLORS.api}[api]${COLORS.reset} Failed to start: ${err}`,
    );
    shutdown();
    return;
  }

  // 7. Start yt-client
  console.log(`${COLORS.client}[client]${COLORS.reset} Starting Electron app...`);
  spawnService("client", "npx", ["electron-forge", "start"], "packages/yt-client");

  console.log(
    `\n\x1b[1m[dev] All services running. Press Ctrl+C to stop.\x1b[0m\n`,
  );
}

main().catch((err) => {
  console.error("[dev] Fatal error:", err);
  shutdown();
});
