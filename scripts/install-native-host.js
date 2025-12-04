#!/usr/bin/env node
/**
 * Install native messaging host manifest for Supextension puppet service
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

function parseArgs(argv) {
  const args = {};
  argv.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value === undefined ? true : value;
    }
  });
  return args;
}

function normalizeExtensionIds(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function resolveAllowedOrigins(extensionIds) {
  return extensionIds.map((id) => `chrome-extension://${id}/`);
}

function ensureExecutable(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const mode = stats.mode | 0o755;
    fs.chmodSync(filePath, mode);
  } catch (error) {
    console.warn(`[install-host] Warning: Failed to set executable flag on ${filePath}:`, error.message);
  }
}

function installManifest(manifestPath, manifestContent) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
  console.log(`✓ Installed manifest to ${manifestPath}`);
}

function registerWindowsManifest(manifestName, manifestPath) {
  const registryPath = `HKCU/Software/Google/Chrome/NativeMessagingHosts/${manifestName}`;
  const command = `reg add "${registryPath}" /ve /t REG_SZ /d "${manifestPath}" /f`;
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✓ Registered manifest in Windows registry (${registryPath})`);
  } catch (error) {
    console.error('[install-host] Failed to register manifest in registry:', error.message);
    throw error;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const extensionIds = normalizeExtensionIds(args['extension-id'] || process.env.PUPPET_EXTENSION_ID);

  if (!extensionIds.length) {
    console.error('Error: --extension-id is required (comma separated for multiple IDs).');
    console.error('Example: npm run install:host -- --extension-id=abcdefghijklmnopabcdefghijklmnop');
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '..');
  const serverPath = path.resolve(projectRoot, 'puppet', 'server.js');

  if (!fs.existsSync(serverPath)) {
    console.error(`Error: Puppet server not found at ${serverPath}`);
    process.exit(1);
  }

  ensureExecutable(serverPath);

  const manifestContent = {
    name: 'com.supextension.puppet',
    description: 'Puppet native messaging host for Supextension',
    path: serverPath,
    type: 'stdio',
    allowed_origins: resolveAllowedOrigins(extensionIds),
  };

  const platform = os.platform();
  let manifestPath;

  if (platform === 'linux') {
    const dir = path.join(os.homedir(), '.config/google-chrome/NativeMessagingHosts');
    manifestPath = path.join(dir, 'com.supextension.puppet.json');
    installManifest(manifestPath, manifestContent);
  } else if (platform === 'darwin') {
    const dir = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Google',
      'Chrome',
      'NativeMessagingHosts'
    );
    manifestPath = path.join(dir, 'com.supextension.puppet.json');
    installManifest(manifestPath, manifestContent);
  } else if (platform === 'win32') {
    const dir = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts');
    if (!dir.trim()) {
      console.error('Error: Unable to determine LOCALAPPDATA path.');
      process.exit(1);
    }
    manifestPath = path.join(dir, 'com.supextension.puppet.json');
    installManifest(manifestPath, manifestContent);
    registerWindowsManifest(manifestContent.name, manifestPath);
  } else {
    console.error(`Error: Unsupported platform ${platform}.`);
    process.exit(1);
  }

  console.log('Native messaging host installed successfully.');
}

main();
