/**
 * BrowserController - Main API for browser automation
 * This class provides all the methods to control the browser programmatically.
 */

import type {
  ApiResponse,
  DOMContent,
  NetworkLogEntry,
  StorageData,
  ExtensionMessage,
  TabInfo,
} from './types.js';

export class BrowserController {
  private static instance: BrowserController;

  private constructor() {}

  /**
   * Get singleton instance of BrowserController
   */
  public static getInstance(): BrowserController {
    if (!BrowserController.instance) {
      BrowserController.instance = new BrowserController();
    }
    return BrowserController.instance;
  }

  /**
   * Send message to background script
   */
  private async sendMessage<T>(message: ExtensionMessage): Promise<ApiResponse<T>> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response: ApiResponse<T>) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          resolve(response || { success: false, error: 'No response received' });
        }
      });
    });
  }

  /**
   * Get the current active tab ID
   */
  private async getActiveTabId(): Promise<number | undefined> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]?.id);
      });
    });
  }

  // ==================== Navigation APIs ====================

  /**
   * Navigate to a specific URL
   * @param url - The URL to navigate to
   * @param tabId - Optional tab ID, uses active tab if not provided
   */
  async navigate(url: string, tabId?: number): Promise<ApiResponse<void>> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    return this.sendMessage({
      type: 'NAVIGATE',
      url,
      tabId: targetTabId,
    });
  }

  /**
   * Navigate back in history
   * @param tabId - Optional tab ID, uses active tab if not provided
   */
  async navigateBack(tabId?: number): Promise<ApiResponse<void>> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    return this.sendMessage({
      type: 'NAVIGATE_BACK',
      tabId: targetTabId,
    });
  }

  /**
   * Scroll the page
   * @param x - Horizontal scroll position (pixels)
   * @param y - Vertical scroll position (pixels)
   * @param behavior - Scroll behavior ('auto' or 'smooth')
   * @param tabId - Optional tab ID, uses active tab if not provided
   */
  async scroll(
    x?: number,
    y?: number,
    behavior: 'auto' | 'smooth' = 'smooth',
    tabId?: number
  ): Promise<ApiResponse<void>> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    return this.sendMessage({
      type: 'SCROLL',
      x,
      y,
      behavior,
      tabId: targetTabId,
    });
  }

  // ==================== DOM APIs ====================

  /**
   * Get DOM content from the current page
   * @param selector - Optional CSS selector to get specific elements
   * @param tabId - Optional tab ID
   */
  async getDOM(selector?: string, tabId?: number): Promise<ApiResponse<DOMContent>> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    return this.sendMessage({
      type: 'GET_DOM',
      selector,
      tabId: targetTabId,
    });
  }

  /**
   * Get all visible text from the page
   * @param tabId - Optional tab ID
   */
  async getAllText(tabId?: number): Promise<ApiResponse<string>> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    return this.sendMessage({
      type: 'GET_ALL_TEXT',
      tabId: targetTabId,
    });
  }

  // ==================== Screenshot APIs ====================

  /**
   * Take a screenshot of the visible area
   * @param format - Image format ('png' or 'jpeg')
   * @param quality - JPEG quality (0-100), only for jpeg format
   * @param tabId - Optional tab ID
   */
  async takeScreenshot(
    format: 'png' | 'jpeg' = 'png',
    quality?: number,
    tabId?: number
  ): Promise<ApiResponse<string>> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    return this.sendMessage({
      type: 'TAKE_SCREENSHOT',
      format,
      quality,
      tabId: targetTabId,
    });
  }

  // ==================== Script Injection APIs ====================

  /**
   * Inject JavaScript code into the page
   * @param code - JavaScript code to inject
   * @param timing - When to inject the script
   * @param waitForSelector - Optional selector to wait for before injecting
   * @param tabId - Optional tab ID
   */
  async injectScript(
    code: string,
    timing: 'immediate' | 'document_start' | 'document_end' | 'document_idle' = 'immediate',
    waitForSelector?: string,
    tabId?: number
  ): Promise<ApiResponse<unknown>> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    return this.sendMessage({
      type: 'INJECT_SCRIPT',
      code,
      timing,
      waitForSelector,
      tabId: targetTabId,
    });
  }

  /**
   * Inject a script file into the page
   * @param file - Path to the script file
   * @param tabId - Optional tab ID
   */
  async injectScriptFile(file: string, tabId?: number): Promise<ApiResponse<unknown>> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    return this.sendMessage({
      type: 'INJECT_SCRIPT',
      file,
      tabId: targetTabId,
    });
  }

  // ==================== Storage APIs ====================

  /**
   * Get data from localStorage or sessionStorage
   * @param storageType - 'local' or 'session'
   * @param keys - Optional specific keys to retrieve
   * @param tabId - Optional tab ID
   */
  async getStorage(
    storageType: 'local' | 'session',
    keys?: string[],
    tabId?: number
  ): Promise<ApiResponse<StorageData>> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    return this.sendMessage({
      type: 'GET_STORAGE',
      storageType,
      keys,
      tabId: targetTabId,
    });
  }

  /**
   * Set data in localStorage or sessionStorage
   * @param storageType - 'local' or 'session'
   * @param data - Key-value pairs to store
   * @param tabId - Optional tab ID
   */
  async setStorage(
    storageType: 'local' | 'session',
    data: Record<string, unknown>,
    tabId?: number
  ): Promise<ApiResponse<void>> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    return this.sendMessage({
      type: 'SET_STORAGE',
      storageType,
      data,
      tabId: targetTabId,
    });
  }

  // ==================== Cookie APIs ====================

  /**
   * Get cookies for a URL
   * @param url - Optional URL to get cookies for (defaults to current tab URL)
   * @param name - Optional specific cookie name
   */
  async getCookies(url?: string, name?: string): Promise<ApiResponse<chrome.cookies.Cookie[]>> {
    return this.sendMessage({
      type: 'GET_COOKIES',
      url,
      name,
    });
  }

  /**
   * Set a cookie
   * @param cookie - Cookie details to set
   */
  async setCookie(cookie: chrome.cookies.SetDetails): Promise<ApiResponse<chrome.cookies.Cookie>> {
    return this.sendMessage({
      type: 'SET_COOKIE',
      cookie,
    });
  }

  /**
   * Delete a cookie
   * @param url - URL associated with the cookie
   * @param name - Name of the cookie to delete
   */
  async deleteCookie(url: string, name: string): Promise<ApiResponse<void>> {
    return this.sendMessage({
      type: 'DELETE_COOKIE',
      url,
      name,
    });
  }

  // ==================== Network Interception APIs ====================

  /**
   * Start capturing network traffic
   */
  async startNetworkCapture(): Promise<ApiResponse<void>> {
    return this.sendMessage({
      type: 'START_NETWORK_CAPTURE',
    });
  }

  /**
   * Stop capturing network traffic
   */
  async stopNetworkCapture(): Promise<ApiResponse<void>> {
    return this.sendMessage({
      type: 'STOP_NETWORK_CAPTURE',
    });
  }

  /**
   * Get captured network log
   */
  async getNetworkLog(): Promise<ApiResponse<NetworkLogEntry[]>> {
    return this.sendMessage({
      type: 'GET_NETWORK_LOG',
    });
  }

  /**
   * Clear the network log
   */
  async clearNetworkLog(): Promise<ApiResponse<void>> {
    return this.sendMessage({
      type: 'CLEAR_NETWORK_LOG',
    });
  }

  /**
   * Get all tabs in the current window
   */
  async getAllTabs(): Promise<ApiResponse<TabInfo[]>> {
    return this.sendMessage({
      type: 'GET_ALL_TABS',
    });
  }
}

// Export singleton instance
export const browserController = BrowserController.getInstance();

