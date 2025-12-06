const { app, BrowserWindow, dialog, globalShortcut } = require('electron');
const path = require('path');

let display_name = 'Peekdown';
const fs = require('fs');

let main_window = null;
let file_content = null;
let error_message = null;

// Parse CLI args and read file
const file_path = process.argv[2];

if (!file_path) {
  error_message = 'No markdown file specified. Usage: peekdown <file.md>';
} else if (!fs.existsSync(file_path)) {
  error_message = `File not found: ${file_path}`;
} else {
  try {
    file_content = fs.readFileSync(file_path, 'utf-8');
    display_name = path.basename(file_path);
  } catch (err) {
    error_message = `Failed to read file: ${err.message}`;
  }
}

function create_window() {
  main_window = new BrowserWindow({
    width: 900,
    height: 700,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  main_window.loadFile(path.join(__dirname, 'index.html'));
  main_window.setTitle(display_name);

  main_window.webContents.on('did-finish-load', () => {
    if (error_message) {
      main_window.webContents.send('error', error_message);
      dialog.showErrorBox('Error', error_message);
    } else if (file_content) {
      main_window.webContents.send('file-content', file_content, display_name);
    }
  });

  // Register keyboard shortcuts
  globalShortcut.register('Escape', () => {
    if (main_window && !main_window.isDestroyed()) {
      main_window.close();
    }
  });

  globalShortcut.register('CommandOrControl+W', () => {
    if (main_window && !main_window.isDestroyed()) {
      main_window.close();
    }
  });

  main_window.on('closed', () => {
    main_window = null;
  });
}

app.whenReady().then(() => {
  create_window();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      create_window();
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
