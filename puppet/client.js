/**
 * Puppet Client - JavaScript client for remote browser control
 * Can be used in Node.js or browser environments
 */

class PuppetClient {
  constructor(config) {
    if (typeof config === 'string') {
      this.config = {
        url: config,
        timeout: 30000,
        reconnect: true,
        reconnectDelay: 5000,
        apiKey: null,
      };
    } else {
      this.config = {
        timeout: 30000,
        reconnect: true,
        reconnectDelay: 5000,
        apiKey: null,
        ...config,
      };
    }

    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.isConnected = false;
    this.shouldReconnect = true;
  }

  /**
   * Connect to the puppet server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : require('ws');
        this.ws = new WebSocketImpl(this.config.url);

        const identifyTimeout = setTimeout(() => {
          reject(new Error('Identification timeout'));
          this.ws?.close();
        }, 5000);

        this.ws.onopen = () => {
          // Send identification as client
          this.ws.send(JSON.stringify({
            type: 'identify',
            role: 'client',
            apiKey: this.config.apiKey,
            name: 'remote-client'
          }));
        };

        this.ws.onmessage = (event) => {
          const data = typeof event.data === 'string' ? event.data : event.data.toString();
          const message = JSON.parse(data);

          // Wait for ready confirmation before marking as connected
          if (!this.isConnected && message.type === 'ready') {
            clearTimeout(identifyTimeout);
            this.isConnected = true;
            console.log('[Puppet Client] Connected and identified');
            resolve();
            return;
          }

          if (!this.isConnected && message.type === 'error') {
            clearTimeout(identifyTimeout);
            reject(new Error(message.error || 'Connection error'));
            this.ws?.close();
            return;
          }

          this.handleMessage(data);
        };

        this.ws.onclose = () => {
          clearTimeout(identifyTimeout);
          this.isConnected = false;
          console.log('[Puppet Client] Disconnected from server');
          
          if (this.shouldReconnect && this.config.reconnect) {
            setTimeout(() => {
              console.log('[Puppet Client] Reconnecting...');
              this.connect();
            }, this.config.reconnectDelay);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[Puppet Client] WebSocket error:', error);
          if (!this.isConnected) {
            clearTimeout(identifyTimeout);
            reject(new Error('Failed to connect to puppet server'));
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the puppet server
   */
  disconnect() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;

    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Client disconnected'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'agent-status') {
        console.log('[Puppet Client] Agent status:', message.status);
        return;
      }

      if (message.type === 'event') {
        console.log('[Puppet Client] Event:', message.event);
        return;
      }

      if (message.type === 'response') {
        const { id, success, data: responseData, error } = message;
        if (id && this.pendingRequests.has(id)) {
          const { resolve, timeout } = this.pendingRequests.get(id);
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          resolve({ success, data: responseData, error });
        }
        return;
      }
    } catch (error) {
      console.error('[Puppet Client] Failed to parse message:', error);
    }
  }

  /**
   * Send command to puppet server
   */
  async sendCommand(method, params = {}) {
    console.log('[Puppet Client] sendCommand called:', { method, params, isConnected: this.isConnected, ws: !!this.ws });
    if (!this.isConnected || !this.ws) {
      console.error('[Puppet Client] Not connected:', { isConnected: this.isConnected, ws: !!this.ws });
      throw new Error('Not connected to puppet server');
    }

    return new Promise((resolve, reject) => {
      const id = `req_${++this.messageId}`;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, this.config.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const message = {
        type: 'command',
        id,
        method,
        params,
      };

      console.log('[Puppet Client] Sending message:', message);
      try {
        this.ws.send(JSON.stringify(message));
        console.log('[Puppet Client] Message sent successfully');
      } catch (error) {
        console.error('[Puppet Client] Error sending message:', error);
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // ==================== Navigation APIs ====================

  async navigate(url, tabId) {
    return this.sendCommand('navigate', { url, tabId });
  }

  async navigateBack(tabId) {
    return this.sendCommand('navigateBack', { tabId });
  }

  async scroll(x, y, behavior, tabId) {
    console.log('[Puppet Client] scroll called with:', { x, y, behavior, tabId });
    return this.sendCommand('scroll', { x, y, behavior, tabId });
  }

  // ==================== DOM APIs ====================

  async getDOM(selector, tabId) {
    return this.sendCommand('getDOM', { selector, tabId });
  }

  async getAllText(tabId) {
    return this.sendCommand('getAllText', { tabId });
  }

  // ==================== Screenshot APIs ====================

  async takeScreenshot(format = 'png', quality, tabId) {
    return this.sendCommand('takeScreenshot', { format, quality, tabId });
  }

  // ==================== Script Injection APIs ====================

  async injectScript(code, timing, waitForSelector, tabId) {
    return this.sendCommand('injectScript', { code, timing, waitForSelector, tabId });
  }

  // ==================== Storage APIs ====================

  async getStorage(storageType, keys, tabId) {
    return this.sendCommand('getStorage', { storageType, keys, tabId });
  }

  async setStorage(storageType, data, tabId) {
    return this.sendCommand('setStorage', { storageType, data, tabId });
  }

  // ==================== Cookie APIs ====================

  async getCookies(url, name) {
    return this.sendCommand('getCookies', { url, name });
  }

  async setCookie(cookie) {
    return this.sendCommand('setCookie', { cookie });
  }

  async deleteCookie(url, name) {
    return this.sendCommand('deleteCookie', { url, name });
  }

  // ==================== Network Capture APIs ====================

  async startNetworkCapture() {
    return this.sendCommand('startNetworkCapture');
  }

  async stopNetworkCapture() {
    return this.sendCommand('stopNetworkCapture');
  }

  async getNetworkLog() {
    return this.sendCommand('getNetworkLog');
  }

  async clearNetworkLog() {
    return this.sendCommand('clearNetworkLog');
  }

  // ==================== Utility Methods ====================

  connected() {
    return this.isConnected;
  }

  async waitForConnection(timeout = 5000) {
    const startTime = Date.now();
    while (!this.isConnected && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!this.isConnected) {
      throw new Error('Connection timeout');
    }
  }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PuppetClient };
}

if (typeof window !== 'undefined') {
  window.PuppetClient = PuppetClient;
}
