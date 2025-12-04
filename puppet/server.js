#!/usr/bin/env node
/**
 * Puppet Server - Native Messaging Host
 * Bridges WebSocket/HTTP clients with the Chrome extension
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const configPath = path.join(__dirname, 'config.json');

function readConfigFile() {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      if (content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (error) {
    console.error('[Puppet Server] Failed to read config file:', error);
  }
  return {};
}

const defaultConfig = {
  websocket: {
    host: 'localhost',
    port: 9222,
  },
  http: {
    enabled: true,
    port: 9223,
  },
  security: {
    apiKey: null,
    allowedOrigins: ['*'],
  },
  debug: false,
};

const fileConfig = readConfigFile();

const allowedOriginsEnv = process.env.PUPPET_ALLOWED_ORIGINS
  ? process.env.PUPPET_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null;

const httpEnabledEnv = process.env.PUPPET_HTTP_ENABLED;

const config = {
  websocket: {
    host: process.env.PUPPET_HOST || fileConfig.websocket?.host || defaultConfig.websocket.host,
    port: parseInt(
      process.env.PUPPET_PORT || fileConfig.websocket?.port || defaultConfig.websocket.port,
      10
    ),
  },
  http: {
    enabled:
      typeof httpEnabledEnv !== 'undefined'
        ? httpEnabledEnv === 'true'
        : typeof fileConfig.http?.enabled === 'boolean'
          ? fileConfig.http.enabled
          : defaultConfig.http.enabled,
    port: parseInt(
      process.env.PUPPET_HTTP_PORT || fileConfig.http?.port || defaultConfig.http.port,
      10
    ),
  },
  security: {
    apiKey: process.env.PUPPET_API_KEY || fileConfig.security?.apiKey || defaultConfig.security.apiKey,
    allowedOrigins:
      allowedOriginsEnv || fileConfig.security?.allowedOrigins || defaultConfig.security.allowedOrigins,
  },
  debug:
    typeof process.env.PUPPET_DEBUG !== 'undefined'
      ? process.env.PUPPET_DEBUG === 'true'
      : typeof fileConfig.debug === 'boolean'
        ? fileConfig.debug
        : defaultConfig.debug,
};

// State
let extensionPort = null;
let messageId = 0;
const pendingRequests = new Map();
const wsClients = new Set();

function isOriginAllowed(origin) {
  if (!origin || config.security.allowedOrigins.includes('*')) {
    return true;
  }
  return config.security.allowedOrigins.includes(origin);
}

function authorizeRequest(apiKey) {
  if (!config.security.apiKey) {
    return true;
  }
  return apiKey === config.security.apiKey;
}

function getHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Native Messaging with Chrome Extension
 */
function setupNativeMessaging() {
  const stdin = process.stdin;
  const stdout = process.stdout;
  
  let buffer = Buffer.alloc(0);
  let messageLength = null;

  stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    
    while (buffer.length >= 4) {
      if (messageLength === null) {
        messageLength = buffer.readUInt32LE(0);
        buffer = buffer.slice(4);
      }
      
      if (buffer.length >= messageLength) {
        const messageData = buffer.slice(0, messageLength);
        buffer = buffer.slice(messageLength);
        messageLength = null;
        
        try {
          const message = JSON.parse(messageData.toString('utf-8'));
          handleExtensionMessage(message);
        } catch (error) {
          logError('Failed to parse message from extension:', error);
        }
      } else {
        break;
      }
    }
  });

  stdin.on('end', () => {
    log('Extension disconnected');
    process.exit(0);
  });

  extensionPort = {
    send: (message) => {
      try {
        const messageStr = JSON.stringify(message);
        const messageBuffer = Buffer.from(messageStr, 'utf-8');
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeUInt32LE(messageBuffer.length, 0);
        
        stdout.write(lengthBuffer);
        stdout.write(messageBuffer);
      } catch (error) {
        logError('Failed to send message to extension:', error);
      }
    }
  };
  
  log('Native messaging initialized');
}

/**
 * Handle messages from extension
 */
function handleExtensionMessage(message) {
  if (config.debug) {
    log('Message from extension:', message);
  }

  const { id, success, data, error } = message;
  
  if (pendingRequests.has(id)) {
    const { resolve } = pendingRequests.get(id);
    pendingRequests.delete(id);
    resolve({ success, data, error });
  }
}

/**
 * Send command to extension
 */
async function sendToExtension(command) {
  return new Promise((resolve, reject) => {
    const id = `msg_${++messageId}`;
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Request timeout'));
    }, 30000); // 30 second timeout

    pendingRequests.set(id, {
      resolve: (response) => {
        clearTimeout(timeout);
        resolve(response);
      }
    });

    if (extensionPort) {
      extensionPort.send({ ...command, id });
    } else {
      clearTimeout(timeout);
      pendingRequests.delete(id);
      reject(new Error('Extension not connected'));
    }
  });
}

/**
 * WebSocket Server
 */
function setupWebSocketServer() {
  const wss = new WebSocket.Server({
    host: config.websocket.host,
    port: config.websocket.port
  });

  wss.on('connection', (ws, req) => {
    log(`WebSocket client connected from ${req.socket.remoteAddress}`);
    
    const origin = req.headers.origin || '';
    if (origin && !isOriginAllowed(origin)) {
      log(`Rejected connection from unauthorized origin: ${origin}`);
      ws.close(1008, 'Unauthorized origin');
      return;
    }
    
    wsClients.add(ws);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (config.debug) {
          log('WebSocket message:', message);
        }
        
        if (!authorizeRequest(message.apiKey)) {
          ws.send(JSON.stringify({
            id: message.id,
            success: false,
            error: 'Unauthorized: Invalid API key'
          }));
          return;
        }

        const response = await handleClientCommand(message);
        
        ws.send(JSON.stringify({
          id: message.id,
          ...response
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });

    ws.on('close', () => {
      log('WebSocket client disconnected');
      wsClients.delete(ws);
    });

    ws.on('error', (error) => {
      logError('WebSocket error:', error);
      wsClients.delete(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to Puppet Server',
      version: '1.0.0'
    }));
  });

  log(`WebSocket server listening on ws://${config.websocket.host}:${config.websocket.port}`);
}

/**
 * HTTP Server (for REST API)
 */
function setupHttpServer() {
  if (!config.http.enabled) return;

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || '';
    if (origin && !isOriginAllowed(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Origin not allowed' }));
      return;
    }

    const responseOrigin = origin || '*';
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const message = JSON.parse(body);
          const headerApiKey = getHeaderValue(req.headers['x-api-key']);
          if (!message.apiKey && headerApiKey) {
            message.apiKey = headerApiKey;
          }
          const response = await handleClientCommand(message);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              error: error.message,
            })
          );
        }
      });
    } else if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          extensionConnected: extensionPort !== null,
          clients: wsClients.size,
        })
      );
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Not Found' }));
    }
  });

  server.listen(config.http.port, config.websocket.host, () => {
    log(`HTTP server listening on http://${config.websocket.host}:${config.http.port}`);
  });
}

/**
 * Handle command from client (WebSocket or HTTP)
 */
async function handleClientCommand(message) {
  const { method, params = {}, apiKey } = message;

  if (!authorizeRequest(apiKey)) {
    return {
      success: false,
      error: 'Unauthorized: Invalid API key'
    };
  }

  // Map method to extension message type
  const methodMap = {
    navigate: 'NAVIGATE',
    navigateBack: 'NAVIGATE_BACK',
    getDOM: 'GET_DOM',
    getAllText: 'GET_ALL_TEXT',
    takeScreenshot: 'TAKE_SCREENSHOT',
    injectScript: 'INJECT_SCRIPT',
    getStorage: 'GET_STORAGE',
    setStorage: 'SET_STORAGE',
    getCookies: 'GET_COOKIES',
    setCookie: 'SET_COOKIE',
    deleteCookie: 'DELETE_COOKIE',
    startNetworkCapture: 'START_NETWORK_CAPTURE',
    stopNetworkCapture: 'STOP_NETWORK_CAPTURE',
    getNetworkLog: 'GET_NETWORK_LOG',
    clearNetworkLog: 'CLEAR_NETWORK_LOG',
  };

  const messageType = methodMap[method];
  if (!messageType) {
    return {
      success: false,
      error: `Unknown method: ${method}`,
    };
  }

  return await sendToExtension({
    type: messageType,
    ...params,
  });
}

/**
 * Broadcast message to all WebSocket clients
 */
function broadcastToClients(message) {
  const messageStr = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

/**
 * Logging utilities
 */
function log(...args) {
  console.error('[Puppet Server]', ...args);
}

function logError(...args) {
  console.error('[Puppet Server ERROR]', ...args);
}

/**
 * Initialize server
 */
function main() {
  log('Starting Puppet Server...');
  log('Configuration:', JSON.stringify(config, null, 2));

  // Setup communication channels
  setupNativeMessaging();
  setupWebSocketServer();
  setupHttpServer();

  // Handle process termination
  process.on('SIGINT', () => {
    log('Shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Shutting down...');
    process.exit(0);
  });

  log('Puppet Server ready');
}

// Start server
if (require.main === module) {
  main();
}

module.exports = { main };
