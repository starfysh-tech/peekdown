const { app, BrowserWindow, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let display_name = 'Peekdown';
let main_window = null;
let file_content = null;
let error_message = null;

// Parse CLI args
const args = process.argv.slice(2);
let file_path = null;
let pdf_output = null;
let show_version = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--pdf' && args[i + 1]) {
    pdf_output = args[i + 1];
    i++; // Skip next arg
  } else if (args[i] === '--version' || args[i] === '-v') {
    show_version = true;
  } else if (!args[i].startsWith('--')) {
    file_path = args[i];
  }
}

function show_help() {
  const pkg = require('../package.json');
  console.log(`
${pkg.name} v${pkg.version}
${pkg.description}

Usage:
  peekdown <file.md>                View markdown file
  peekdown <file.md> --pdf out.pdf  Export to PDF

Options:
  -h, --help      Show this help message
  -v, --version   Show version number

Shortcuts:
  Escape          Close window
  Cmd/Ctrl+W      Close window
`);
  process.exit(0);
}

// Handle help and version
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  show_help();
}

if (show_version) {
  const pkg = require('../package.json');
  console.log(pkg.version);
  process.exit(0);
}

// Read input file
if (!file_path) {
  error_message = 'No markdown file specified.\nUsage: peekdown <file.md> [--pdf output.pdf]\nRun peekdown --help for more options.';
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
  const is_pdf_mode = !!pdf_output;

  main_window = new BrowserWindow({
    width: 900,
    height: 700,
    show: !is_pdf_mode,  // Hide window in PDF mode
    titleBarStyle: is_pdf_mode ? 'default' : 'hiddenInset',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  main_window.loadFile(path.join(__dirname, 'index.html'));
  main_window.setTitle(display_name);

  // Forward renderer console to main process
  main_window.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer] ${message}`);
  });

  main_window.webContents.on('did-finish-load', () => {
    if (error_message) {
      if (is_pdf_mode) {
        console.error(error_message);
        app.quit();
      } else {
        main_window.webContents.send('error', error_message);
        dialog.showErrorBox('Error', error_message);
      }
    } else if (file_content) {
      main_window.webContents.send('file-content', file_content, display_name, is_pdf_mode);

      if (is_pdf_mode) {
        // Wait for mermaid diagrams to render (ELK renderer is slow)
        setTimeout(async () => {
          try {
            const pdf_data = await main_window.webContents.printToPDF({
              printBackground: true,
              pageSize: 'Letter',
              margins: {
                top: 0.5,
                bottom: 0.5,
                left: 0.5,
                right: 0.5
              }
            });

            const output_path = path.resolve(pdf_output);
            fs.writeFileSync(output_path, pdf_data);
            console.log(`PDF saved to: ${output_path}`);
            app.quit();
          } catch (err) {
            console.error(`Failed to generate PDF: ${err.message}`);
            app.quit();
          }
        }, 5000);  // 5 second delay for ELK mermaid rendering
      }
    }
  });

  // Only register shortcuts in UI mode
  if (!is_pdf_mode) {
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
  }

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
