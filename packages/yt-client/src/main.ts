import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, net, shell } from "electron";
import started from "electron-squirrel-startup";

if (started) {
  app.quit();
}

const createWindow = () => {
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
  async (_event, downloadUrl: string, suggestedFilename: string) => {
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

    const result = await dialog.showSaveDialog({
      defaultPath: suggestedFilename,
      filters: [{ name: "All Files", extensions: ["*"] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
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
    const writable = createWriteStream(result.filePath);

    try {
      await pipeline(readable, writable);
    } catch (err) {
      // Clean up partial file on failure
      await fs.unlink(result.filePath).catch(() => {});
      throw err;
    }

    return { filePath: result.filePath };
  },
);

ipcMain.on("config:getApiBaseUrl", (event) => {
  event.returnValue = process.env.YT_HUB_API_URL ?? "";
});

// Async handler for future use
ipcMain.handle("config:getApiBaseUrl", () => {
  return process.env.YT_HUB_API_URL ?? "";
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
