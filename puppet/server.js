#!/usr/bin/env node
/**
 * Puppet Server - Remote Coordinator
 * Orchestrates communication between browser agents (extensions) and remote clients
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
    host: '0.0.0.0',
    port: 9222,
  },
  http: {
    enabled: true,
    port: 9223,
  },
  security: {
    apiKey: null,
    agentSecret: null,
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
    agentSecret:
      process.env.PUPPET_AGENT_SECRET || fileConfig.security?.agentSecret || defaultConfig.security.agentSecret,
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
let agentConnection = null;
let requestCounter = 0;
const pendingCommands = new Map(); // id -> { client, timeout }
const clients = new Set();

function isOriginAllowed(origin) {
  if (!origin || config.security.allowedOrigins.includes('*')) {
    return true;
  }
  return config.security.allowedOrigins.includes(origin);
}

function authorizeClient(apiKey) {
  if (!config.security.apiKey) {
    return true;
  }
  return apiKey === config.security.apiKey;
}

function authorizeAgent(secret) {
  if (!config.security.agentSecret) {
    return true;
  }
  return secret === config.security.agentSecret;
}

function log(...args) {
  console.error('[Puppet Server]', ...args);
}

function logError(...args) {
  console.error('[Puppet Server ERROR]', ...args);
}

function setupWebSocketServer() {
  const wss = new WebSocket.Server({
    host: config.websocket.host,
    port: config.websocket.port,
  });

  wss.on('connection', (socket, req) => {
    log(`New connection from ${req.socket.remoteAddress}`);

    let role = null;
    let clientInfo = null;

    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (config.debug) {
          log('Received message:', message);
        }

        if (!role) {
          if (message.type !== 'identify') {
            socket.send(JSON.stringify({ type: 'error', error: 'Identification required' }));
            socket.close(1008, 'Identify first');
            return;
          }

          if (message.role === 'agent') {
            if (!authorizeAgent(message.secret)) {
              socket.send(JSON.stringify({ type: 'error', error: 'Unauthorized agent' }));
              socket.close(1011, 'Unauthorized');
              return;
            }

            role = 'agent';
            registerAgent(socket, message);
            return;
          }

          if (message.role === 'client') {
            if (!authorizeClient(message.apiKey)) {
              socket.send(JSON.stringify({ type: 'error', error: 'Unauthorized client' }));
              socket.close(1011, 'Unauthorized');
              return;
            }

            role = 'client';
            clientInfo = { socket, name: message.name || 'remote-client' };
            clients.add(clientInfo);
            socket.send(JSON.stringify({ type: 'ready', role: 'client' }));
            notifyClientAgentStatus(socket);
            return;
          }

          socket.send(JSON.stringify({ type: 'error', error: 'Unknown role' }));
          socket.close(1008, 'Unknown role');
          return;
        }

        if (role === 'agent') {
          handleAgentMessage(socket, message);
        } else if (role === 'client') {
          handleClientMessage(socket, message);
        }
      } catch (error) {
        logError('Failed to process message:', error);
        socket.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });

    socket.on('close', () => {
      if (role === 'agent' && agentConnection?.socket === socket) {
        log('Agent disconnected');
        agentConnection = null;
        failPendingCommands('Agent disconnected');
        broadcast({ type: 'agent-status', status: 'offline' });
      }

      if (role === 'client' && clientInfo) {
        clients.delete(clientInfo);
        cleanupPendingForClient(socket);
      }
    });

    socket.on('error', (error) => {
      logError('WebSocket error:', error);
    });
  });

  log(`WebSocket server listening on ws://${config.websocket.host}:${config.websocket.port}`);
}

function registerAgent(socket, identifyMessage) {
  agentConnection = {
    socket,
    info: {
      agentId: identifyMessage.agentId || 'default-agent',
      name: identifyMessage.name || 'supextension-agent',
      version: identifyMessage.version || '1.0.0',
    },
  };

  socket.send(
    JSON.stringify({
      type: 'ready',
      role: 'agent',
      agentId: agentConnection.info.agentId,
    })
  );

  broadcast({ type: 'agent-status', status: 'online', info: agentConnection.info });
  log(`Agent connected: ${agentConnection.info.agentId}`);
}

function handleClientMessage(socket, message) {
  if (message.type !== 'command') {
    socket.send(JSON.stringify({ type: 'error', error: 'Unsupported client message type' }));
    return;
  }

  if (!agentConnection) {
    socket.send(
      JSON.stringify({
        type: 'response',
        id: message.id,
        success: false,
        error: 'No agent connected',
      })
    );
    return;
  }

  const commandId = message.id || `cmd_${++requestCounter}`;
  const timeout = setTimeout(() => {
    if (pendingCommands.has(commandId)) {
      const pending = pendingCommands.get(commandId);
      pending.client.send(
        JSON.stringify({
          type: 'response',
          id: commandId,
          success: false,
          error: 'Command timeout',
        })
      );
      pendingCommands.delete(commandId);
    }
  }, 30000);

  pendingCommands.set(commandId, { client: socket, timeout });

  agentConnection.socket.send(
    JSON.stringify({
      type: 'command',
      id: commandId,
      method: message.method,
      params: message.params || {},
    })
  );
}

function handleAgentMessage(socket, message) {
  if (socket !== agentConnection?.socket) {
    logError('Received agent message from unknown socket');
    return;
  }

  if (message.type === 'response') {
    const pending = pendingCommands.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pending.client.send(
      JSON.stringify({
        type: 'response',
        id: message.id,
        success: message.success,
        data: message.data,
        error: message.error,
      })
    );
    pendingCommands.delete(message.id);
    return;
  }

  if (message.type === 'event') {
    broadcast({
      type: 'event',
      event: message.event,
      data: message.data,
    });
  }
}

function failPendingCommands(reason) {
  pendingCommands.forEach((pending, id) => {
    clearTimeout(pending.timeout);
    pending.client.send(
      JSON.stringify({
        type: 'response',
        id,
        success: false,
        error: reason,
      })
    );
  });
  pendingCommands.clear();
}

function cleanupPendingForClient(socket) {
  pendingCommands.forEach((pending, id) => {
    if (pending.client === socket) {
      clearTimeout(pending.timeout);
      pendingCommands.delete(id);
    }
  });
}

function broadcast(message) {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(payload);
    }
  });
}

function notifyClientAgentStatus(socket) {
  const statusMessage = {
    type: 'agent-status',
    status: agentConnection ? 'online' : 'offline',
    info: agentConnection?.info,
  };
  socket.send(JSON.stringify(statusMessage));
}

function setupHttpServer() {
  if (!config.http.enabled) return;

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          agentConnected: Boolean(agentConnection),
          clients: clients.size,
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Not Found' }));
  });

  server.listen(config.http.port, config.websocket.host, () => {
    log(`HTTP server listening on http://${config.websocket.host}:${config.http.port}`);
  });
}

function main() {
  log('Starting Puppet Server...');
  log('Configuration:', JSON.stringify({ ...config, security: { ...config.security, apiKey: config.security.apiKey ? '***' : null, agentSecret: config.security.agentSecret ? '***' : null } }, null, 2));

  setupWebSocketServer();
  setupHttpServer();

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log('Puppet Server ready');
}

function shutdown() {
  log('Shutting down...');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main };
