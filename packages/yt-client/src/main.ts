import fs from "node:fs/promises";
import path from "node:path";
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  net,
  shell,
} from "electron";
import started from "electron-squirrel-startup";
import Store from "electron-store";

if (started) {
  app.quit();
}

interface Settings {
  theme: "system" | "light" | "dark";
  defaultDownloadDir: string | null;
  defaultFormat: string;
}

interface HistoryEntry {
  id: string;
  title: string;
  author: string;
  format: string;
  formatType: "video" | "audio";
  link: string;
  localPath: string;
  downloadedAt: number;
}

interface StoreSchema {
  settings: Settings;
  downloadHistory: HistoryEntry[];
}

const MAX_HISTORY_ENTRIES = 500;

const store = new Store<StoreSchema>({
  schema: {
    settings: {
      type: "object",
      properties: {
        theme: {
          type: "string",
          enum: ["system", "light", "dark"],
          default: "system",
        },
        defaultDownloadDir: {
          type: ["string", "null"],
          default: null,
        },
        defaultFormat: {
          type: "string",
          default: "mp4",
        },
      },
      default: {
        theme: "system",
        defaultDownloadDir: null,
        defaultFormat: "mp4",
      },
    },
    downloadHistory: {
      type: "array",
      default: [],
    },
  },
});

const createWindow = () => {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
  }

  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

ipcMain.handle("dialog:selectFolder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("shell:showItemInFolder", (_event, filePath: string) => {
  if (typeof filePath !== "string" || filePath.includes("\0")) {
    throw new Error("Invalid file path");
  }
  const resolved = path.resolve(filePath);
  const home = app.getPath("home");
  if (!resolved.startsWith(home)) {
    throw new Error("File path must be within user home directory");
  }
  shell.showItemInFolder(resolved);
});

ipcMain.handle(
  "dialog:saveDownload",
  async (
    _event,
    downloadUrl: string,
    suggestedFilename: string,
    destDir?: string,
  ) => {
    if (
      typeof downloadUrl !== "string" ||
      typeof suggestedFilename !== "string"
    ) {
      throw new Error("Invalid arguments");
    }

    const parsed = new URL(downloadUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https URLs are allowed");
    }

    let filePath: string;

    if (destDir && typeof destDir === "string") {
      // Direct save mode — skip save dialog
      const dirExists = await fs
        .access(destDir)
        .then(() => true)
        .catch(() => false);

      if (!dirExists) {
        // Directory deleted — fall back to save dialog
        const result = await dialog.showSaveDialog({
          defaultPath: suggestedFilename,
          filters: [{ name: "All Files", extensions: ["*"] }],
        });
        if (result.canceled || !result.filePath) return null;
        filePath = result.filePath;
      } else {
        // Resolve filename collisions: video.mp4 → video (1).mp4 → video (2).mp4
        const ext = path.extname(suggestedFilename);
        const base = path.basename(suggestedFilename, ext);
        let candidate = path.join(destDir, suggestedFilename);
        let counter = 0;

        while (
          await fs
            .access(candidate)
            .then(() => true)
            .catch(() => false)
        ) {
          counter++;
          candidate = path.join(destDir, `${base} (${counter})${ext}`);
        }
        filePath = candidate;
      }
    } else {
      // Original behavior — show save dialog
      const result = await dialog.showSaveDialog({
        defaultPath: suggestedFilename,
        filters: [{ name: "All Files", extensions: ["*"] }],
      });
      if (result.canceled || !result.filePath) return null;
      filePath = result.filePath;
    }

    const response = await net.fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }
    if (!response.body) {
      throw new Error("Response has no body");
    }

    const { Readable } = await import("node:stream");
    const { createWriteStream } = await import("node:fs");
    const { pipeline } = await import("node:stream/promises");

    const readable = Readable.fromWeb(
      response.body as import("node:stream/web").ReadableStream,
    );
    const writable = createWriteStream(filePath);

    try {
      await pipeline(readable, writable);
    } catch (err) {
      await fs.unlink(filePath).catch(() => {});
      throw err;
    }

    return { filePath };
  },
);

ipcMain.on("config:getApiBaseUrl", (event) => {
  event.returnValue = process.env.YT_HUB_API_URL ?? "";
});

// Async handler for future use
ipcMain.handle("config:getApiBaseUrl", () => {
  return process.env.YT_HUB_API_URL ?? "";
});

ipcMain.handle("clipboard:readText", () => {
  return clipboard.readText();
});

ipcMain.handle("dialog:openTextFile", async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: "Text files", extensions: ["txt"] }],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return fs.readFile(result.filePaths[0], "utf-8");
});

// --- Settings IPC ---

const defaultSettings: Settings = {
  theme: "system",
  defaultDownloadDir: null,
  defaultFormat: "mp4",
};

ipcMain.handle("settings:getAll", () => {
  return store.get("settings", defaultSettings);
});

ipcMain.handle("settings:get", (_event, key: string) => {
  const settings = store.get("settings", defaultSettings);
  if (!(key in settings)) {
    throw new Error(`Unknown setting key: ${key}`);
  }
  return settings[key as keyof Settings];
});

ipcMain.handle("settings:set", (_event, key: string, value: unknown) => {
  const settings = store.get("settings", defaultSettings);
  if (!(key in settings)) {
    throw new Error(`Unknown setting key: ${key}`);
  }
  const updated = { ...settings, [key]: value };
  store.set("settings", updated);
  return updated[key as keyof Settings];
});

// Sync handler for FOUC prevention — preload reads theme before renderer loads
ipcMain.on("settings:getTheme", (event) => {
  const settings = store.get("settings", defaultSettings);
  event.returnValue = settings.theme;
});

// --- History IPC ---

ipcMain.handle("history:getAll", () => {
  return store.get("downloadHistory", []);
});

ipcMain.handle("history:add", (_event, entry: Omit<HistoryEntry, "id">) => {
  const history = store.get("downloadHistory", []);
  const newEntry: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
  };
  // Prepend (newest first), prune to max
  const updated = [newEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);
  store.set("downloadHistory", updated);
  return newEntry;
});

ipcMain.handle("history:remove", (_event, id: string) => {
  const history = store.get("downloadHistory", []);
  store.set(
    "downloadHistory",
    history.filter((e) => e.id !== id),
  );
});

ipcMain.handle("history:clear", () => {
  store.set("downloadHistory", []);
});

ipcMain.handle("history:checkFile", async (_event, filePath: string) => {
  if (typeof filePath !== "string") return false;
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
});

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
