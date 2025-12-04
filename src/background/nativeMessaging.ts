/**
 * Native Messaging Bridge
 * Handles communication with the native puppet server
 */

import type { ExtensionMessage, ApiResponse } from '../api/types.js';

// Native messaging port
let nativePort: chrome.runtime.Port | null = null;
let isConnecting = false;

// Message handlers
type MessageHandler = (message: ExtensionMessage) => Promise<ApiResponse>;
let messageHandler: MessageHandler | null = null;

/**
 * Connect to native messaging host
 */
export function connectNativeMessaging(handler: MessageHandler): void {
  if (nativePort || isConnecting) {
    console.log('[Native Messaging] Already connected or connecting');
    return;
  }

  messageHandler = handler;
  isConnecting = true;

  try {
    console.log('[Native Messaging] Connecting to host: com.supextension.puppet');
    nativePort = chrome.runtime.connectNative('com.supextension.puppet');

    nativePort.onMessage.addListener((message: ExtensionMessage & { id?: string }) => {
      handleNativeMessage(message);
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('[Native Messaging] Disconnected');
      if (chrome.runtime.lastError) {
        console.error('[Native Messaging] Error:', chrome.runtime.lastError.message);
      }
      nativePort = null;
      isConnecting = false;

      // Try to reconnect after a delay
      setTimeout(() => {
        if (!nativePort) {
          console.log('[Native Messaging] Attempting to reconnect...');
          connectNativeMessaging(handler);
        }
      }, 5000);
    });

    isConnecting = false;
    console.log('[Native Messaging] Connected successfully');
  } catch (error) {
    console.error('[Native Messaging] Failed to connect:', error);
    nativePort = null;
    isConnecting = false;

    // Retry after delay
    setTimeout(() => {
      if (!nativePort) {
        connectNativeMessaging(handler);
      }
    }, 5000);
  }
}

/**
 * Handle message from native host
 */
async function handleNativeMessage(message: ExtensionMessage & { id?: string }): Promise<void> {
  if (!messageHandler) {
    console.error('[Native Messaging] No message handler set');
    return;
  }

  try {
    const response = await messageHandler(message);

    // Send response back to native host
    if (nativePort && message.id) {
      nativePort.postMessage({
        id: message.id,
        ...response,
      });
    }
  } catch (error) {
    console.error('[Native Messaging] Error handling message:', error);
    if (nativePort && message.id) {
      nativePort.postMessage({
        id: message.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Send message to native host
 */
export function sendNativeMessage(message: unknown): boolean {
  if (!nativePort) {
    console.warn('[Native Messaging] Not connected, cannot send message');
    return false;
  }

  try {
    nativePort.postMessage(message);
    return true;
  } catch (error) {
    console.error('[Native Messaging] Failed to send message:', error);
    return false;
  }
}

/**
 * Check if native messaging is connected
 */
export function isNativeMessagingConnected(): boolean {
  return nativePort !== null;
}

/**
 * Disconnect from native host
 */
export function disconnectNativeMessaging(): void {
  if (nativePort) {
    nativePort.disconnect();
    nativePort = null;
  }
}
