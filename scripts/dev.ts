import { type ChildProcess, execFileSync, execSync, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const IS_WINDOWS = process.platform === "win32";

const COLORS = {
  downloader: "\x1b[36m", // cyan
  client: "\x1b[35m",     // magenta
  reset: "\x1b[0m",
};

// ---------------------------------------------------------------------------
// Prerequisite checker
// ---------------------------------------------------------------------------

function checkPrerequisites(): void {
  const required: { binary: string; hint: string }[] = [
    { binary: "node",   hint: "https://nodejs.org" },
    { binary: "yt-dlp", hint: "brew install yt-dlp  OR  pip install yt-dlp  OR  https://github.com/yt-dlp/yt-dlp/releases" },
    { binary: "ffmpeg", hint: "brew install ffmpeg  OR  https://ffmpeg.org/download.html" },
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
// Graceful shutdown
// ---------------------------------------------------------------------------

const children: ChildProcess[] = [];
let shuttingDown = false;

function killChild(child: ChildProcess): void {
  if (child.exitCode !== null || child.killed) return;

  if (IS_WINDOWS) {
    // On Windows, SIGTERM is not supported — use taskkill to kill the whole
    // process tree so child processes (electron sub-processes, etc.) are included.
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
 * On Windows, `npx` etc. must be spawned via `cmd /c` or with `shell: true`
 * because they are .cmd wrappers, not native executables.
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

  // 2. Build yt-downloader (synchronous) — yt-client consumes it in-process.
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

  // 3. Start the Electron client (electron-forge start via nx serve)
  console.log(`${COLORS.client}[client]${COLORS.reset} Starting Electron app...`);
  const child = spawnCrossplatform("npx", ["nx", "serve", "yt-client"], ".");

  prefixOutput(child, "client");
  children.push(child);

  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(
        `${COLORS.client}[client]${COLORS.reset} Exited unexpectedly (code ${code})`,
      );
      shutdown();
    }
  });

  console.log(`\n\x1b[1m[dev] Client running. Press Ctrl+C to stop.\x1b[0m\n`);
}

main().catch((err) => {
  console.error("[dev] Fatal error:", err);
  shutdown();
});
