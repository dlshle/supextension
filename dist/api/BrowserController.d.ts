/**
 * BrowserController - Main API for browser automation
 * This class provides all the methods to control the browser programmatically.
 */
import type { ApiResponse, DOMContent, NetworkLogEntry, StorageData, TabInfo } from './types.js';
export declare class BrowserController {
    private static instance;
    private constructor();
    /**
     * Get singleton instance of BrowserController
     */
    static getInstance(): BrowserController;
    /**
     * Send message to background script
     */
    private sendMessage;
    /**
     * Get the current active tab ID
     */
    private getActiveTabId;
    /**
     * Navigate to a specific URL
     * @param url - The URL to navigate to
     * @param tabId - Optional tab ID, uses active tab if not provided
     */
    navigate(url: string, tabId?: number): Promise<ApiResponse<void>>;
    /**
     * Navigate back in history
     * @param tabId - Optional tab ID, uses active tab if not provided
     */
    navigateBack(tabId?: number): Promise<ApiResponse<void>>;
    /**
     * Scroll the page
     * @param x - Horizontal scroll position (pixels)
     * @param y - Vertical scroll position (pixels)
     * @param behavior - Scroll behavior ('auto' or 'smooth')
     * @param tabId - Optional tab ID, uses active tab if not provided
     */
    scroll(x?: number, y?: number, behavior?: 'auto' | 'smooth', tabId?: number): Promise<ApiResponse<void>>;
    /**
     * Get DOM content from the current page
     * @param selector - Optional CSS selector to get specific elements
     * @param tabId - Optional tab ID
     */
    getDOM(selector?: string, tabId?: number): Promise<ApiResponse<DOMContent>>;
    /**
     * Get all visible text from the page
     * @param tabId - Optional tab ID
     */
    getAllText(tabId?: number): Promise<ApiResponse<string>>;
    /**
     * Take a screenshot of the visible area
     * @param format - Image format ('png' or 'jpeg')
     * @param quality - JPEG quality (0-100), only for jpeg format
     * @param tabId - Optional tab ID
     */
    takeScreenshot(format?: 'png' | 'jpeg', quality?: number, tabId?: number): Promise<ApiResponse<string>>;
    /**
     * Inject JavaScript code into the page
     * @param code - JavaScript code to inject
     * @param timing - When to inject the script
     * @param waitForSelector - Optional selector to wait for before injecting
     * @param tabId - Optional tab ID
     */
    injectScript(code: string, timing?: 'immediate' | 'document_start' | 'document_end' | 'document_idle', waitForSelector?: string, tabId?: number): Promise<ApiResponse<unknown>>;
    /**
     * Inject a script file into the page
     * @param file - Path to the script file
     * @param tabId - Optional tab ID
     */
    injectScriptFile(file: string, tabId?: number): Promise<ApiResponse<unknown>>;
    /**
     * Get data from localStorage or sessionStorage
     * @param storageType - 'local' or 'session'
     * @param keys - Optional specific keys to retrieve
     * @param tabId - Optional tab ID
     */
    getStorage(storageType: 'local' | 'session', keys?: string[], tabId?: number): Promise<ApiResponse<StorageData>>;
    /**
     * Set data in localStorage or sessionStorage
     * @param storageType - 'local' or 'session'
     * @param data - Key-value pairs to store
     * @param tabId - Optional tab ID
     */
    setStorage(storageType: 'local' | 'session', data: Record<string, unknown>, tabId?: number): Promise<ApiResponse<void>>;
    /**
     * Get cookies for a URL
     * @param url - Optional URL to get cookies for (defaults to current tab URL)
     * @param name - Optional specific cookie name
     */
    getCookies(url?: string, name?: string): Promise<ApiResponse<chrome.cookies.Cookie[]>>;
    /**
     * Set a cookie
     * @param cookie - Cookie details to set
     */
    setCookie(cookie: chrome.cookies.SetDetails): Promise<ApiResponse<chrome.cookies.Cookie>>;
    /**
     * Delete a cookie
     * @param url - URL associated with the cookie
     * @param name - Name of the cookie to delete
     */
    deleteCookie(url: string, name: string): Promise<ApiResponse<void>>;
    /**
     * Start capturing network traffic
     */
    startNetworkCapture(): Promise<ApiResponse<void>>;
    /**
     * Stop capturing network traffic
     */
    stopNetworkCapture(): Promise<ApiResponse<void>>;
    /**
     * Get captured network log
     */
    getNetworkLog(): Promise<ApiResponse<NetworkLogEntry[]>>;
    /**
     * Clear the network log
     */
    clearNetworkLog(): Promise<ApiResponse<void>>;
    /**
     * Get all tabs in the current window
     */
    getAllTabs(): Promise<ApiResponse<TabInfo[]>>;
}
export declare const browserController: BrowserController;
//# sourceMappingURL=BrowserController.d.ts.map