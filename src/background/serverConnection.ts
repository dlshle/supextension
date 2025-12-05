/**
 * Remote Server Connection
 * Connects the background worker to the remote puppet server via WebSocket
 */

import type { ApiResponse, ExtensionMessage } from '../api/types.js';

// WebSocket state
let ws: WebSocket | null = null;
let isConnecting = false;
let serverUrl = 'ws://192.168.0.158:9222';

// Handler provided by background.ts
type MessageHandler = (message: ExtensionMessage) => Promise<ApiResponse>;
let messageHandler: MessageHandler | null = null;

// Agent metadata (sent during identification)
const manifest = chrome.runtime.getManifest();
const agentMetadata = {
  agentId: chrome.runtime.id,
  name: manifest.name,
  version: manifest.version,
};

/**
 * Connect to the puppet server (idempotent)
 */
export function connectToServer(handler: MessageHandler, url?: string): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }
  if (isConnecting) {
    return;
  }

  if (url) {
    serverUrl = url;
  }

  messageHandler = handler;
  isConnecting = true;

  try {
    ws = new WebSocket(serverUrl);

    ws.onopen = () => {
      isConnecting = false;
      identifyAgent();
    };

    ws.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data as string);
        await handleServerMessage(payload);
      } catch (error) {
        console.error('[Puppet Agent] Failed to handle server message', error);
      }
    };

    ws.onclose = () => {
      ws = null;
      isConnecting = false;
      // Attempt reconnect after a short delay
      setTimeout(() => {
        connectToServer(handler);
      }, 3000);
    };

    ws.onerror = (event) => {
      console.error('[Puppet Agent] WebSocket error', event);
    };
  } catch (error) {
    console.error('[Puppet Agent] Failed to connect to server', error);
    ws = null;
    isConnecting = false;
    setTimeout(() => {
      connectToServer(handler);
    }, 5000);
  }
}

async function handleServerMessage(message: any): Promise<void> {
  switch (message.type) {
    case 'ready':
      console.log('[Puppet Agent] Connection ready');
      break;

    case 'command':
      if (!messageHandler) {
        console.warn('[Puppet Agent] No message handler registered');
        return;
      }

      if (!message.method) {
        sendResponse(message.id, {
          success: false,
          error: 'Command missing method field',
        });
        return;
      }

      try {
        const extensionMessage = toExtensionMessage(message.method, message.params || {});
        const response = await messageHandler(extensionMessage);
        sendResponse(message.id, response);
      } catch (error) {
        sendResponse(message.id, {
          success: false,
          error: error instanceof Error ? error.message : 'Command failed',
        });
      }
      break;

    case 'ping':
      sendRaw({ type: 'pong' });
      break;

    default:
      console.warn('[Puppet Agent] Unknown server message type', message.type);
  }
}

function toExtensionMessage(method: string, params: Record<string, unknown>): ExtensionMessage {
  const methodMap: Record<string, ExtensionMessage['type']> = {
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

  const type = methodMap[method];
  if (!type) {
    throw new Error(`Unknown method: ${method}`);
  }

  return {
    type,
    ...params,
  } as ExtensionMessage;
}

function identifyAgent(): void {
  sendRaw({
    type: 'identify',
    role: 'agent',
    agentId: agentMetadata.agentId,
    name: agentMetadata.name,
    version: agentMetadata.version,
  });
}

function sendResponse(id: string, response: ApiResponse): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(
    JSON.stringify({
      type: 'response',
      id,
      success: response.success,
      data: response.data,
      error: response.error,
    })
  );
}

function sendRaw(message: Record<string, unknown>): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Optionally emit events back to the server (e.g., streaming logs)
 */
export function emitEvent(event: string, data?: Record<string, unknown>): void {
  sendRaw({ type: 'event', event, data });
}
