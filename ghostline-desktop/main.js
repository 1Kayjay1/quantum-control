const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let pythonProcess;
let backendReady = false;

// Determine if we're in development or production
const isDev = !app.isPackaged;

// Get paths for Python runtime and backend
function getPythonPath() {
  if (isDev) {
    // In development, use system Python
    return process.platform === 'win32' ? 'python' : 'python3';
  }
  
  // In production, use embedded Python
  const resourcesPath = process.resourcesPath;
  if (process.platform === 'win32') {
    return path.join(resourcesPath, 'python-runtime', 'python.exe');
  } else if (process.platform === 'darwin') {
    return path.join(resourcesPath, 'python-runtime', 'bin', 'python3');
  } else {
    return path.join(resourcesPath, 'python-runtime', 'bin', 'python3');
  }
}

function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'ghostline-backend', 'websocket_server.py');
  }
  return path.join(process.resourcesPath, 'backend', 'websocket_server.py');
}

// Start Python backend
function startPythonBackend() {
  const pythonPath = getPythonPath();
  const backendScript = getBackendPath();
  
  console.log('Starting Python backend...');
  console.log('Python:', pythonPath);
  console.log('Backend:', backendScript);
  
  pythonProcess = spawn(pythonPath, [backendScript]);
  
  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[Python]', output);
    
    // Check if backend is ready
    if (output.includes('Starting Ghostline WebSocket server')) {
      backendReady = true;
      if (mainWindow) {
        mainWindow.webContents.send('backend-status', { ready: true });
      }
    }
  });
  
  pythonProcess.stderr.on('data', (data) => {
    console.error('[Python Error]', data.toString());
  });
  
  pythonProcess.on('close', (code) => {
    console.log(`Python backend exited with code ${code}`);
    backendReady = false;
    if (mainWindow) {
      mainWindow.webContents.send('backend-status', { ready: false, error: `Backend exited with code ${code}` });
    }
  });
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'Ghostline - CoDrone EDU Route Optimizer',
  });
  
  // Load the web app
  if (isDev) {
    // In development, load from local dev server
    mainWindow.loadURL('http://localhost:5173/ghostline');
  } else {
    // In production, load from deployed site
    mainWindow.loadURL('https://quantum-control.web.app/ghostline');
  }
  
  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  startPythonBackend();
  
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

app.on('before-quit', () => {
  // Kill Python backend
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

// IPC handlers
ipcMain.handle('get-backend-status', () => {
  return { ready: backendReady };
});

ipcMain.handle('restart-backend', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  setTimeout(() => {
    startPythonBackend();
  }, 1000);
  return { success: true };
});
