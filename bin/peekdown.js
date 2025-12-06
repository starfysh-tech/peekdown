#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const electron_path = require('electron');
const app_path = path.join(__dirname, '..');

const args = [app_path, ...process.argv.slice(2)];

const child = spawn(electron_path, args, {
  stdio: 'inherit',
  windowsHide: false
});

child.on('close', (code) => {
  process.exit(code);
});
