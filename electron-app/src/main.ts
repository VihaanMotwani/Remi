import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { WebSocketServer } from 'ws';

// 🧠 Global window reference
let mainWindow: BrowserWindow | null = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// 🪟 Create the main Electron window
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,     // ✅ enable window.require()
      contextIsolation: false,   // ✅ allow require() in renderer
      webSecurity: true,
      sandbox: false,
    },
    
  });

  // ✅ Allow mic/camera permissions
  session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
    if (
      permission === 'media' ||
      (permission as any) === 'microphone' ||
      (permission as any) === 'camera'
    ) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Hide default menu bar
  mainWindow.setMenu(null);

  // Load your Vite dev server or built HTML file
  mainWindow.loadURL('http://localhost:5173');
  // For production builds, uncomment:
  // mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();
};

// 🧩 WebSocket Server (Electron listens for backend messages)
function startWebSocketServer() {
  const wss = new WebSocketServer({ port: 5050 });

  wss.on('connection', (ws) => {
    console.log('🧩 Remi backend connected to Electron WebSocket');

    ws.on('message', (msg) => {
      console.log('📨 Message from backend:', msg.toString());
      if (mainWindow) {
        // Forward state updates (idle, listening, speaking) to renderer
        mainWindow.webContents.send('remi-state', msg.toString());
      }
    });

    ws.on('close', () => console.log('❌ Backend disconnected'));
  });

  console.log('✅ Electron WebSocket server running on ws://localhost:5050');
}

// ⚡ App lifecycle
app.whenReady().then(() => {
  createWindow();
  startWebSocketServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
