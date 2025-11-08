"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
let mainWindow = null;
let nativeHelper = null;
let sessionToken = null;
function startNativeHelper() {
    const helperPath = path.join(__dirname, '../../native/ProcessInspector');
    console.log('Starting native helper:', helperPath);
    nativeHelper = (0, child_process_1.spawn)(helperPath, [], {
        stdio: ['ignore', 'pipe', 'pipe']
    });
    nativeHelper.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[ProcessInspector]', output);
        // Extract session token from output
        const match = output.match(/Session Token: ([a-f0-9-]+)/i);
        if (match) {
            sessionToken = match[1];
            console.log('✅ Session token captured');
            // Send to renderer when ready
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
    mainWindow = new electron_1.BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    // Load HTML from src directory (since it's not copied to dist)
    const htmlPath = path.join(__dirname, '../../src/renderer/index.html');
    mainWindow.loadFile(htmlPath);
    // Open DevTools for debugging
    mainWindow.webContents.openDevTools();
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // Send session token if already captured
    if (sessionToken) {
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow?.webContents.send('inspector-token', sessionToken);
        });
    }
}
electron_1.app.on('ready', () => {
    startNativeHelper();
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    // Kill native helper
    if (nativeHelper) {
        nativeHelper.kill();
    }
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('quit', () => {
    // Ensure native helper is killed
    if (nativeHelper) {
        nativeHelper.kill();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
