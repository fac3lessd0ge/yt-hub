import fs from "node:fs/promises";
import path from "node:path";
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  screen,
  shell,
} from "electron";
import started from "electron-squirrel-startup";
import Store from "electron-store";
import { DownloadService, loadYtDlpConfig } from "yt-downloader";
import { getProxyValidationError } from "./lib/proxyValidation";
import { getUrlValidationError } from "./lib/urlValidation";
import { BundledBinaryResolver } from "./main/BundledBinaryResolver";
import { openInFileManager } from "./main/fileManager";
import { showItemInFolder as showItemInFolderImpl } from "./main/showItemInFolder";

if (started) {
  app.quit();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.setName("YT Hub");

const ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "icon.png")
  : path.join(__dirname, "../../assets/icon.png");

if (process.platform === "darwin" && !app.isPackaged) {
  app.whenReady().then(() => {
    app.dock?.setIcon(ICON_PATH);
  });
}

interface Settings {
  theme: "system" | "light" | "dark";
  defaultDownloadDir: string | null;
  defaultFormat: string;
  proxy: string;
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

interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

interface StoreSchema {
  settings: Settings;
  downloadHistory: HistoryEntry[];
  windowBounds: WindowBounds;
}

const DEFAULT_WINDOW_BOUNDS: WindowBounds = {
  width: 1000,
  height: 700,
  isMaximized: false,
};

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
        proxy: {
          type: "string",
          default: "",
        },
      },
      default: {
        theme: "system",
        defaultDownloadDir: null,
        defaultFormat: "mp4",
        proxy: "",
      },
    },
    downloadHistory: {
      type: "array",
      default: [],
    },
    windowBounds: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        isMaximized: { type: "boolean" },
      },
      default: DEFAULT_WINDOW_BOUNDS,
    },
  },
});

const LIGHT_BG = "#ffffff";
const DARK_BG = "#252525";

function resolveBackgroundColor(): string {
  const theme = store.get("settings", defaultSettings).theme;
  const isDark =
    theme === "dark" || (theme === "system" && nativeTheme.shouldUseDarkColors);
  return isDark ? DARK_BG : LIGHT_BG;
}

function isPositionOnScreen(x: number, y: number): boolean {
  return screen.getAllDisplays().some(({ workArea }) => {
    return (
      x >= workArea.x &&
      x <= workArea.x + workArea.width &&
      y >= workArea.y &&
      y <= workArea.y + workArea.height
    );
  });
}

function loadWindowBounds(): WindowBounds {
  const bounds = store.get("windowBounds", DEFAULT_WINDOW_BOUNDS);
  if (
    typeof bounds.x === "number" &&
    typeof bounds.y === "number" &&
    !isPositionOnScreen(bounds.x, bounds.y)
  ) {
    return { ...bounds, x: undefined, y: undefined };
  }
  return bounds;
}

function createBoundsPersister(win: BrowserWindow): () => void {
  let timer: NodeJS.Timeout | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (win.isDestroyed()) return;
      const isMaximized = win.isMaximized();
      const { x, y, width, height } = win.getBounds();
      store.set("windowBounds", {
        width,
        height,
        x,
        y,
        isMaximized,
      });
    }, 300);
  };
}

const createWindow = () => {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
  }

  const bounds = loadWindowBounds();

  const mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    backgroundColor: resolveBackgroundColor(),
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Defense-in-depth: the renderer only ever loads local app content. Deny any
  // attempt to open new windows or navigate away (external links go through the
  // allowlisted shell:openExternal IPC instead).
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  mainWindow.once("ready-to-show", () => {
    if (bounds.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  const persistBounds = createBoundsPersister(mainWindow);
  mainWindow.on("resize", persistBounds);
  mainWindow.on("move", persistBounds);
  mainWindow.on("maximize", persistBounds);
  mainWindow.on("unmaximize", persistBounds);

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

ipcMain.handle("shell:showItemInFolder", (_event, filePath: unknown) => {
  return showItemInFolderImpl(filePath, {
    access: (p) => fs.access(p),
    revealItem: (p) => openInFileManager("ShowItems", p),
    revealFolder: (p) => openInFileManager("ShowFolders", p),
    showItemInFolder: (p) => shell.showItemInFolder(p),
    openPath: (p) => shell.openPath(p),
  });
});

const ALLOWED_EXTERNAL_HOSTS = new Set(["github.com"]);

ipcMain.handle("shell:openExternal", async (_event, url: string) => {
  if (typeof url !== "string") {
    throw new Error("Invalid URL");
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    ALLOWED_EXTERNAL_HOSTS.has(host) ||
    [...ALLOWED_EXTERNAL_HOSTS].some((h) => host.endsWith(`.${h}`));
  if (!allowed) {
    throw new Error(`Host ${host} is not in the external-link allowlist`);
  }
  await shell.openExternal(url);
});

// --- Download IPC (in-process via yt-downloader DownloadService) ---

const binaryResolver = new BundledBinaryResolver({
  userBinDir: path.join(app.getPath("userData"), "bin"),
  resourcesBinDir: path.join(process.resourcesPath, "bin"),
});

/**
 * Build a DownloadService for the current settings. A configured proxy is
 * threaded into yt-dlp via YtDlpConfig so downloads can tunnel around DPI/geo
 * blocks (e.g. when youtube is reachable in the browser but yt-dlp's CDN
 * connection is throttled). The binary resolver is shared across instances.
 */
function createDownloadService(proxy?: string): DownloadService {
  return new DownloadService({
    binaryResolver,
    ytDlpConfig: proxy ? { ...loadYtDlpConfig(), proxy } : undefined,
  });
}

// Metadata / formats / backends are proxy-independent — use a base instance.
const downloadService = createDownloadService();

const inFlightDownloads = new Map<string, AbortController>();

interface DownloadStartParams {
  downloadId: string;
  link: string;
  format: string;
  name: string;
}

ipcMain.handle("download:start", (event, params: DownloadStartParams): void => {
  if (
    !params ||
    typeof params.downloadId !== "string" ||
    params.downloadId.length === 0 ||
    typeof params.link !== "string" ||
    typeof params.format !== "string" ||
    typeof params.name !== "string"
  ) {
    throw new Error("Invalid download parameters");
  }

  const urlError = getUrlValidationError(params.link);
  if (urlError) {
    throw new Error(urlError);
  }

  const { downloadId } = params;
  const controller = new AbortController();
  inFlightDownloads.set(downloadId, controller);

  // Read destination + proxy from the settings store — never trust a
  // renderer-supplied path, and apply the user's proxy if configured.
  const settings = store.get("settings", defaultSettings);
  const destination = settings.defaultDownloadDir ?? undefined;
  const proxy = settings.proxy?.trim() || undefined;
  const service = proxy ? createDownloadService(proxy) : downloadService;

  const { sender } = event;

  service
    .download(
      {
        link: params.link,
        format: params.format,
        name: params.name,
        destination,
      },
      (progress) => {
        if (sender.isDestroyed()) return;
        sender.send("download:progress", {
          downloadId,
          percent: progress.percent,
          speed: progress.speed,
          eta: progress.eta,
        });
      },
      controller.signal,
    )
    .then((result) => {
      if (!sender.isDestroyed()) {
        sender.send("download:complete", {
          downloadId,
          filePath: result.outputPath,
          result: {
            output_path: result.outputPath,
            title: result.metadata.title,
            author_name: result.metadata.authorName,
            format_id: result.format.id,
            format_label: result.format.label,
          },
        });
      }
    })
    .catch((err: unknown) => {
      if (sender.isDestroyed()) return;
      const aborted =
        controller.signal.aborted ||
        (err instanceof Error &&
          (err.name === "AbortError" || err.name === "CancellationError"));
      if (aborted) return;
      sender.send("download:error", {
        downloadId,
        code: err instanceof Error ? err.name : "DOWNLOAD_FAILED",
        message: err instanceof Error ? err.message : "Download failed",
      });
    })
    .finally(() => {
      inFlightDownloads.delete(downloadId);
    });
});

ipcMain.handle("download:cancel", (_event, downloadId: string) => {
  const controller = inFlightDownloads.get(downloadId);
  if (controller) {
    controller.abort();
    inFlightDownloads.delete(downloadId);
  }
});

ipcMain.handle("metadata:get", async (_event, url: string) => {
  if (typeof url !== "string") {
    throw new Error("Invalid url");
  }
  // Same trusted-side gate as download:start — keep validation consistent.
  const urlError = getUrlValidationError(url);
  if (urlError) {
    throw new Error(urlError);
  }
  const metadata = await downloadService.getMetadata(url);
  return { title: metadata.title, author_name: metadata.authorName };
});

ipcMain.handle("formats:list", () => {
  return { formats: downloadService.listFormats() };
});

ipcMain.handle("backends:list", () => {
  return { backends: downloadService.listBackends() };
});

ipcMain.on("app:getVersion", (event) => {
  event.returnValue = app.getVersion();
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
  proxy: "",
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
  // Trusted-side validation for the proxy (the renderer also validates, but the
  // main process should not persist a value the UI gate would have rejected).
  if (key === "proxy") {
    if (typeof value !== "string") {
      throw new Error("Proxy must be a string");
    }
    const proxyError = getProxyValidationError(value);
    if (proxyError) {
      throw new Error(proxyError);
    }
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

app.on("ready", () => {
  app.setAboutPanelOptions({
    applicationName: "YT Hub",
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: "© 2026 Arseniy",
    website: "https://github.com/fac3lessd0ge/yt-hub",
  });
  createWindow();
});

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
