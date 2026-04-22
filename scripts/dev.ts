import { type ChildProcess, execFileSync, execSync, spawn } from "node:child_process";
import { connect } from "node:net";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const IS_WINDOWS = process.platform === "win32";

/** `cargo run` often exceeds 30s on cold compile; override with DEV_YT_API_PORT_WAIT_MS. */
const YT_API_PORT_WAIT_MS = (() => {
  const raw = Number(process.env.DEV_YT_API_PORT_WAIT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 300_000;
})();

const COLORS = {
  downloader: "\x1b[36m", // cyan
  service: "\x1b[33m",    // yellow
  api: "\x1b[32m",        // green
  client: "\x1b[35m",     // magenta
  reset: "\x1b[0m",
};

// ---------------------------------------------------------------------------
// Prerequisite checker
// ---------------------------------------------------------------------------

function checkPrerequisites(): void {
  const required: { binary: string; hint: string }[] = [
    { binary: "yt-dlp",  hint: "brew install yt-dlp  OR  pip install yt-dlp  OR  https://github.com/yt-dlp/yt-dlp/releases" },
    { binary: "ffmpeg",  hint: "brew install ffmpeg  OR  https://ffmpeg.org/download.html" },
    { binary: "protoc",  hint: "brew install protobuf  OR  https://github.com/protocolbuffers/protobuf/releases" },
    { binary: "cargo",   hint: "https://rustup.rs" },
    { binary: "node",    hint: "https://nodejs.org" },
  ];

  const missing: { binary: string; hint: string }[] = [];

  // Use `where` on Windows, `which` on Unix
  const finder = IS_WINDOWS ? "where" : "which";

  for (const req of required) {
    try {
      execFileSync(finder, [req.binary], { stdio: "ignore" });
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

function prefixOutput(child: ChildProcess, label: keyof typeof COLORS): void {
  const color = COLORS[label];
  const reset = COLORS.reset;
  const tag = `${color}[${label}]${reset}`;

  if (child.stdout) {
    const rl = createInterface({ input: child.stdout });
    rl.on("line", (line) => process.stdout.write(`${tag} ${line}\n`));
  }

  if (child.stderr) {
    const rl = createInterface({ input: child.stderr });
    rl.on("line", (line) => process.stderr.write(`${tag} ${line}\n`));
  }
}

// ---------------------------------------------------------------------------
// waitForPort
// ---------------------------------------------------------------------------

async function waitForPort(
  port: number,
  host = "127.0.0.1",
  timeoutMs = 30_000,
): Promise<void> {
  const start = Date.now();

  return new Promise((res, rej) => {
    function attempt() {
      if (Date.now() - start > timeoutMs) {
        rej(new Error(`Timed out waiting for ${host}:${port}`));
        return;
      }

      const socket = connect({ port, host });

      socket.once("connect", () => { socket.destroy(); res(); });
      socket.once("error",   () => { socket.destroy(); setTimeout(attempt, 500); });
    }

    attempt();
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

const children: ChildProcess[] = [];
let shuttingDown = false;

function killChild(child: ChildProcess): void {
  if (child.exitCode !== null || child.killed) return;

  if (IS_WINDOWS) {
    // On Windows, SIGTERM is not supported — use taskkill to kill the whole
    // process tree so child processes (cargo sub-processes, etc.) are included.
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    } catch {
      // Process may have already exited
    }
  } else {
    child.kill("SIGTERM");
  }
}

function forceKillChild(child: ChildProcess): void {
  if (child.exitCode !== null || child.killed) return;

  if (IS_WINDOWS) {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    } catch { /* ignore */ }
  } else {
    child.kill("SIGKILL");
  }
}

function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("\n\x1b[31m[dev] Shutting down...\x1b[0m");

  // Iterate in reverse: client → api → service
  for (let i = children.length - 1; i >= 0; i--) {
    killChild(children[i]);
  }

  // Force-kill survivors after 5 seconds
  const forceTimer = setTimeout(() => {
    for (let i = children.length - 1; i >= 0; i--) {
      forceKillChild(children[i]);
    }
    process.exit(0);
  }, 5_000);

  // Exit as soon as all children are gone
  const checkDone = setInterval(() => {
    const allDead = children.every((c) => c.exitCode !== null || c.killed);
    if (allDead) {
      clearInterval(checkDone);
      clearTimeout(forceTimer);
      process.exit(0);
    }
  }, 200);
}

process.on("SIGINT",  shutdown);
// SIGTERM is not emitted on Windows, but registering it is harmless
process.on("SIGTERM", shutdown);

// ---------------------------------------------------------------------------
// Cross-platform spawn helpers
// ---------------------------------------------------------------------------

/**
 * On Windows, `npx` / `cargo` etc. must be spawned via `cmd /c` or with
 * `shell: true` because they are .cmd wrappers, not native executables.
 */
function spawnCrossplatform(
  command: string,
  args: string[],
  cwd: string,
): ChildProcess {
  if (IS_WINDOWS) {
    // shell: true lets Windows resolve .cmd / .bat wrappers automatically
    return spawn(command, args, {
      cwd: resolve(ROOT, cwd),
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
  }

  return spawn(command, args, {
    cwd: resolve(ROOT, cwd),
    stdio: ["pipe", "pipe", "pipe"],
  });
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Prerequisites
  checkPrerequisites();

  // 2. Build yt-downloader (synchronous)
  console.log(`${COLORS.downloader}[downloader]${COLORS.reset} Building...`);
  try {
    // On Windows npx is a .cmd wrapper — must be invoked through cmd.exe
    const buildCmd = IS_WINDOWS
      ? "cmd /c npx nx build yt-downloader"
      : "npx nx build yt-downloader";

    execSync(buildCmd, { cwd: ROOT, stdio: "inherit" });
  } catch {
    console.error(`${COLORS.downloader}[downloader]${COLORS.reset} Build failed`);
    process.exit(1);
  }
  console.log(`${COLORS.downloader}[downloader]${COLORS.reset} Build complete`);

  // Helper: spawn a long-running service and handle unexpected exit
  function spawnService(
    label: keyof typeof COLORS,
    command: string,
    args: string[],
    cwd: string,
  ): ChildProcess {
    const child = spawnCrossplatform(command, args, cwd);

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
    console.error(`${COLORS.service}[service]${COLORS.reset} Failed to start: ${err}`);
    shutdown();
    return;
  }

  // 5. Start yt-api
  console.log(`${COLORS.api}[api]${COLORS.reset} Starting REST API...`);
  spawnService("api", "cargo", ["run"], "packages/yt-api");

  // 6. Wait for port 3000 (Rust compile may take minutes the first time)
  console.log(
    `${COLORS.api}[api]${COLORS.reset} Waiting for http://127.0.0.1:3000 (up to ${Math.round(YT_API_PORT_WAIT_MS / 1000)}s while cargo compiles)...`,
  );
  try {
    await waitForPort(3000, "127.0.0.1", YT_API_PORT_WAIT_MS);
    console.log(`${COLORS.api}[api]${COLORS.reset} REST API ready on port 3000`);
  } catch (err) {
    console.error(`${COLORS.api}[api]${COLORS.reset} Failed to start: ${err}`);
    shutdown();
    return;
  }

  // 7. Start yt-client
  console.log(`${COLORS.client}[client]${COLORS.reset} Starting Electron app...`);
  spawnService("client", "npx", ["electron-forge", "start"], "packages/yt-client");

  console.log(`\n\x1b[1m[dev] All services running. Press Ctrl+C to stop.\x1b[0m\n`);
}

main().catch((err) => {
  console.error("[dev] Fatal error:", err);
  shutdown();
});
