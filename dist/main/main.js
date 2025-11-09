// Clean ESM version of Electron main process (converted from mixed CJS output)
import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// __dirname replacement for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null; // BrowserWindow | null
let nativeHelper = null; // ChildProcess | null
let sessionToken = null; // string | null

function startNativeHelper() {
  const helperPath = path.join(__dirname, '../../native/ProcessInspector');
  console.log('Starting native helper:', helperPath);
  nativeHelper = spawn(helperPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });
  nativeHelper.stdout?.on('data', (data) => {
    const output = data.toString();
    console.log('[ProcessInspector]', output);
    const match = output.match(/Session Token: ([a-f0-9-]+)/i);
    if (match) {
      sessionToken = match[1];
      console.log('✅ Session token captured');
      if (mainWindow) {
        mainWindow.webContents.send('inspector-token', sessionToken);
      }
    }
  });
  nativeHelper.stderr?.on('data', (data) => {
    console.error('[ProcessInspector Error]', data.toString());
  });
  nativeHelper.on('error', (err) => {
    console.error('Failed to start ProcessInspector:', err);
  });
  nativeHelper.on('exit', (code) => {
    console.log(`ProcessInspector exited with code ${code}`);
    nativeHelper = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: true, // TODO: Harden by disabling and using preload
      contextIsolation: false,
    },
  });
  const htmlPath = path.join(__dirname, '../../src/renderer/index.html');
  mainWindow.loadFile(htmlPath);
  mainWindow.webContents.openDevTools();
  mainWindow.on('closed', () => { mainWindow = null; });
  if (sessionToken) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.send('inspector-token', sessionToken);
    });
  }
}

app.on('ready', () => { startNativeHelper(); createWindow(); });
app.on('window-all-closed', () => { if (nativeHelper) nativeHelper.kill(); if (process.platform !== 'darwin') app.quit(); });
app.on('quit', () => { if (nativeHelper) nativeHelper.kill(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });
