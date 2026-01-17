const { app, BrowserWindow, dialog, globalShortcut } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

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

const is_mac = process.platform === 'darwin';
const is_packaged = app.isPackaged;
const is_help = args.includes('--help') || args.includes('-h');

// Handle help and version
if ((args.length === 0 && !is_packaged) || is_help) {
  show_help();
}

if (show_version) {
  const pkg = require('../package.json');
  console.log(pkg.version);
  process.exit(0);
}

const is_cli_mode = !!file_path || !!pdf_output || show_version;

// Read input file
if (!file_path) {
  if (is_cli_mode) {
    error_message = 'No markdown file specified.\nUsage: peekdown <file.md> [--pdf output.pdf]\nRun peekdown --help for more options.';
  }
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

function get_app_bundle_path() {
  if (!is_mac || !is_packaged) {
    return null;
  }
  return path.resolve(app.getPath('exe'), '../../..');
}

function get_applications_location() {
  const bundle_path = get_app_bundle_path();
  if (!bundle_path) {
    return null;
  }
  const applications_path = path.join('/Applications', path.sep);
  const user_applications_path = path.join(os.homedir(), 'Applications', path.sep);
  if (bundle_path.startsWith(applications_path)) {
    return '/Applications';
  }
  if (bundle_path.startsWith(user_applications_path)) {
    return path.join(os.homedir(), 'Applications');
  }
  return null;
}

function should_offer_quicklook_setup() {
  return is_mac && is_packaged && !is_cli_mode && !is_help;
}

function load_quicklook_state() {
  try {
    const state_path = path.join(app.getPath('userData'), 'quicklook.json');
    if (!fs.existsSync(state_path)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(state_path, 'utf-8'));
  } catch (err) {
    return null;
  }
}

function save_quicklook_state(state) {
  const state_path = path.join(app.getPath('userData'), 'quicklook.json');
  fs.mkdirSync(path.dirname(state_path), { recursive: true });
  fs.writeFileSync(state_path, JSON.stringify(state, null, 2));
}

function copy_app_bundle(source_path, target_path) {
  if (fs.existsSync(target_path)) {
    fs.rmSync(target_path, { recursive: true, force: true });
  }
  fs.cpSync(source_path, target_path, { recursive: true });
}

function quicklook_helper_fingerprint(bundle_path) {
  const host_binary = path.join(bundle_path, 'Contents', 'MacOS', 'PeekdownQLHost');
  const ext_binary = path.join(bundle_path, 'Contents', 'PlugIns', 'PeekdownQLExt.appex', 'Contents', 'MacOS', 'PeekdownQLExt');
  if (!fs.existsSync(host_binary) || !fs.existsSync(ext_binary)) {
    return null;
  }
  const host_hash = crypto.createHash('sha256').update(fs.readFileSync(host_binary)).digest('hex');
  const ext_hash = crypto.createHash('sha256').update(fs.readFileSync(ext_binary)).digest('hex');
  return `${host_hash}:${ext_hash}`;
}

function relaunch_from(target_path) {
  const executable_name = path.basename(app.getPath('exe'));
  const exec_path = path.join(target_path, 'Contents', 'MacOS', executable_name);
  app.relaunch({ execPath: exec_path });
  app.exit(0);
}

async function prompt_move_to_applications() {
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Move to /Applications', 'Move to ~/Applications', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: 'Move Peekdown to Applications?',
    detail: 'Peekdown can register its Quick Look preview only from the Applications folder.'
  });
  return result.response;
}

function register_quicklook(apps_path) {
  const helper_source = path.join(process.resourcesPath, 'PeekdownQLHost.app.bundled');
  if (!fs.existsSync(helper_source)) {
    console.warn('Quick Look helper app not found in resources.');
    return;
  }

  const helper_target = path.join(apps_path, 'PeekdownQLHost.app');
  copy_app_bundle(helper_source, helper_target);
  const extension_path = path.join(helper_target, 'Contents', 'PlugIns', 'PeekdownQLExt.appex');
  const extension_binary = path.join(extension_path, 'Contents', 'MacOS', 'PeekdownQLExt');
  const helper_fingerprint = quicklook_helper_fingerprint(helper_source);

  const signing_ok = spawnSync('codesign', ['--verify', '--deep', '--strict', helper_target], {
    stdio: 'ignore'
  });
  if (signing_ok.status !== 0) {
    console.warn('Quick Look helper is not properly signed. Run `yarn build:quicklook` before packaging.');
    return;
  }

  const entitlements_check = spawnSync('codesign', ['-d', '--entitlements', '-', extension_binary], {
    encoding: 'utf-8'
  });
  if (entitlements_check.status !== 0 || !entitlements_check.stdout.includes('com.apple.security.app-sandbox')) {
    console.warn('Quick Look extension entitlements are missing. Ensure the helper is pre-signed before packaging.');
    return;
  }

  const state = {
    registered_at: new Date().toISOString(),
    app_path: get_app_bundle_path(),
    helper_path: helper_target,
    helper_fingerprint: helper_fingerprint,
    app_version: app.getVersion()
  };
  save_quicklook_state(state);

  spawn('xattr', ['-dr', 'com.apple.quarantine', helper_target], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  if (fs.existsSync(extension_path)) {
    spawn('pluginkit', ['-a', extension_path], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }

  const open_process = spawn('open', ['-a', helper_target, '--args', '--register'], {
    detached: true,
    stdio: 'ignore'
  });
  open_process.unref();
}

async function maybe_handle_quicklook_setup() {
  if (!should_offer_quicklook_setup()) {
    return false;
  }

  const apps_path = get_applications_location();
  if (!apps_path) {
    const response = await prompt_move_to_applications();
    if (response === 2) {
      app.quit();
      return true;
    }

    const target_root = response === 0 ? '/Applications' : path.join(os.homedir(), 'Applications');
    const bundle_path = get_app_bundle_path();
    if (!bundle_path) {
      app.quit();
      return true;
    }

    try {
      fs.mkdirSync(target_root, { recursive: true });
      const target_path = path.join(target_root, path.basename(bundle_path));
      copy_app_bundle(bundle_path, target_path);
      relaunch_from(target_path);
      return true;
    } catch (err) {
      dialog.showErrorBox('Move Failed', `Could not move Peekdown: ${err.message}`);
      app.quit();
      return true;
    }
  }

  const state = load_quicklook_state();
  const helper_source = path.join(process.resourcesPath, 'PeekdownQLHost.app.bundled');
  const helper_target = path.join(apps_path, 'PeekdownQLHost.app');
  const source_fingerprint = quicklook_helper_fingerprint(helper_source);
  const target_fingerprint = quicklook_helper_fingerprint(helper_target);

  if (state && state.helper_path && state.helper_path !== helper_target && fs.existsSync(state.helper_path)) {
    const stale_extension = path.join(state.helper_path, 'Contents', 'PlugIns', 'PeekdownQLExt.appex');
    spawnSync('pluginkit', ['-r', stale_extension], { stdio: 'ignore' });
    fs.rmSync(state.helper_path, { recursive: true, force: true });
  }

  const needs_register = !state
    || state.app_path !== get_app_bundle_path()
    || state.app_version !== app.getVersion()
    || state.helper_fingerprint !== source_fingerprint
    || (source_fingerprint && target_fingerprint !== source_fingerprint);

  if (needs_register) {
    register_quicklook(apps_path);
  }

  app.quit();
  return true;
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

app.whenReady().then(async () => {
  const handled_quicklook = await maybe_handle_quicklook_setup();
  if (handled_quicklook) {
    return;
  }

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
