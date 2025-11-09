import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'node:path';
// import started from 'electron-squirrel-startup';

// Auto-quit for squirrel events (Windows installer create/remove shortcuts)
// if (started) app.quit();

// Register permission handler only after app is ready to avoid defaultSession access error
function registerPermissionHandler() {
  session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
    const allow = ['media', 'microphone', 'camera'];
    callback(allow.includes(permission as string));
  });
}

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // show after ready-to-show for smoother UX
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.setMenu(null);

  // Load renderer from dev server or built file
  const devServerUrl = process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL;
  if (isDev) {
    // Use Forge Vite plugin URL if available, otherwise fallback to default Vite port
    mainWindow.loadURL(devServerUrl || 'http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/index.html`));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
}

// Example IPC handlers for preload bridge
ipcMain.handle('ping', () => 'pong');

// Feature flag to disable spawning orchestrator workflow by default.
// Set REMI_ENABLE_ORCHESTRATOR=1 to re-enable.
const ENABLE_ORCHESTRATOR = process.env.REMI_ENABLE_ORCHESTRATOR === '1';

ipcMain.handle('run-orchestrator', async () => {
  if (!ENABLE_ORCHESTRATOR) {
    return '[orchestrator disabled] Set REMI_ENABLE_ORCHESTRATOR=1 to enable.';
  }
  // Spawn the Python orchestrator workflow and return collected output
  return await new Promise<string>((resolve, reject) => {
    try {
      const { spawn } = require('node:child_process');
      const pythonCmd = process.env.REMI_PYTHON || 'python';
      const scriptPath = path.resolve(process.cwd(), 'backend', 'orchestrator.py');
      const child = spawn(pythonCmd, [scriptPath], { cwd: path.resolve(process.cwd(), 'backend') });
      let buffer = '';
      child.stdout.on('data', (d: Buffer) => { buffer += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { buffer += '\n[stderr] ' + d.toString(); });
      child.on('error', (e: Error) => reject(e));
      child.on('close', () => resolve(buffer));
    } catch (e) {
      reject(e);
    }
  });
});

app.whenReady().then(() => {
  registerPermissionHandler();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Additional main process code can be placed in separate modules.
