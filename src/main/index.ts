import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const isDev = process.env.NODE_ENV === 'development';
const userDataPath = app.getPath('userData');
const configPath = join(userDataPath, 'config.json');

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Config helpers
function readConfig(): Record<string, unknown> | null {
  try {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    }
    return null;
  } catch {
    return null;
  }
}

function writeConfig(config: Record<string, unknown>): void {
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true });
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// IPC Handlers
ipcMain.handle('getTerminalConfig', async () => {
  return readConfig();
});

ipcMain.handle('saveTerminalConfig', async (_event, config) => {
  try {
    writeConfig(config);
    return { success: true };
  } catch (error) {
    console.error('Error saving terminal config:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('getStoredToken', async () => {
  const config = readConfig();
  if (!config?.token) return null;
  if (config.tokenEncrypted && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(config.token as string, 'base64'));
    } catch { return null; }
  }
  return config.token;
});

ipcMain.handle('saveStoredToken', async (_event, token) => {
  try {
    const config = readConfig() || {};
    config.token = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(token).toString('base64')
      : token;
    config.tokenEncrypted = safeStorage.isEncryptionAvailable();
    writeConfig(config);
    return { success: true };
  } catch (error) {
    console.error('Error saving stored token:', error);
    return { success: false, error: String(error) };
  }
});
