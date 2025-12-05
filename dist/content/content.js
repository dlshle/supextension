"use strict";
/**
 * Content Script
 * Runs in the context of web pages and provides DOM access
 */
/**
 * Observer for watching DOM changes
 */
class DOMObserver {
    constructor() {
        this.observer = null;
        this.callbacks = new Map();
    }
    /**
     * Start observing for a specific selector
     */
    watchForSelector(selector, callback) {
        this.callbacks.set(selector, callback);
        // Check if element already exists
        const existing = document.querySelector(selector);
        if (existing) {
            callback(existing);
            return;
        }
        // Start observer if not already running
        if (!this.observer) {
            this.observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const [sel, cb] of this.callbacks.entries()) {
                            const element = document.querySelector(sel);
                            if (element) {
                                cb(element);
                                this.callbacks.delete(sel);
                            }
                        }
                    }
                }
                // Stop observing if no more callbacks
                if (this.callbacks.size === 0 && this.observer) {
                    this.observer.disconnect();
                    this.observer = null;
                }
            });
            this.observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
            });
        }
    }
    /**
     * Stop all observations
     */
    stopAll() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.callbacks.clear();
    }
}
const domObserver = new DOMObserver();
/**
 * Handle messages from background script
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // Keep channel open for async response
});
/**
 * Process incoming messages
 */
async function handleMessage(message) {
    try {
        switch (message.type) {
            case 'GET_DOM':
                return getDOMContent(message.selector);
            case 'GET_ALL_TEXT':
                return getAllText();
            case 'INJECT_SCRIPT':
                return injectScript(message.code, message.waitForSelector);
            case 'GET_STORAGE':
                return getStorage(message.storageType, message.keys);
            case 'SET_STORAGE':
                return setStorage(message.storageType, message.data);
            case 'WATCH_SELECTOR':
                return watchSelector(message.selector);
            default:
                return { success: false, error: 'Unknown message type' };
        }
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
/**
 * Get DOM content
 */
function getDOMContent(selector) {
    try {
        if (selector) {
            const element = document.querySelector(selector);
            return {
                success: true,
                data: {
                    html: element?.outerHTML || '',
                    url: window.location.href,
                    title: document.title,
                },
            };
        }
        return {
            success: true,
            data: {
                html: document.documentElement.outerHTML,
                url: window.location.href,
                title: document.title,
            },
        };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Get all visible text from the page
 */
function getAllText() {
    try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent)
                    return NodeFilter.FILTER_REJECT;
                const tagName = parent.tagName.toLowerCase();
                if (['script', 'style', 'noscript'].includes(tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Check if element is visible
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }
                const text = node.textContent?.trim();
                if (!text)
                    return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });
        const texts = [];
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent?.trim();
            if (text)
                texts.push(text);
        }
        return { success: true, data: texts.join('\n') };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Inject and execute JavaScript code
 */
async function injectScript(code, waitForSelector) {
    try {
        // Wait for selector if specified
        if (waitForSelector) {
            await waitForElement(waitForSelector, 10000);
        }
        if (!code) {
            return { success: false, error: 'No code provided' };
        }
        // Create and inject script element for page context execution
        const script = document.createElement('script');
        script.textContent = code;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Wait for an element to appear
 */
function waitForElement(selector, timeout) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for selector: ${selector}`));
        }, timeout);
        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearTimeout(timeoutId);
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
    });
}
/**
 * Get storage data
 */
function getStorage(storageType, keys) {
    try {
        const storage = storageType === 'session' ? sessionStorage : localStorage;
        const result = {};
        if (keys && keys.length > 0) {
            keys.forEach((key) => {
                const value = storage.getItem(key);
                if (value !== null) {
                    try {
                        result[key] = JSON.parse(value);
                    }
                    catch {
                        result[key] = value;
                    }
                }
            });
        }
        else {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key) {
                    const value = storage.getItem(key);
                    if (value !== null) {
                        try {
                            result[key] = JSON.parse(value);
                        }
                        catch {
                            result[key] = value;
                        }
                    }
                }
            }
        }
        return { success: true, data: result };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Set storage data
 */
function setStorage(storageType, data) {
    try {
        if (!data) {
            return { success: false, error: 'No data provided' };
        }
        const storage = storageType === 'session' ? sessionStorage : localStorage;
        Object.entries(data).forEach(([key, value]) => {
            storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        });
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Watch for a selector to appear
 */
function watchSelector(selector) {
    if (!selector) {
        return { success: false, error: 'No selector provided' };
    }
    return new Promise((resolve) => {
        domObserver.watchForSelector(selector, (element) => {
            resolve({
                success: true,
                data: {
                    found: true,
                    html: element.outerHTML,
                },
            });
        });
        // Timeout after 30 seconds
        setTimeout(() => {
            resolve({
                success: false,
                error: 'Timeout waiting for selector',
            });
        }, 30000);
    });
}
// Log that content script is loaded
console.log('[Supextension] Content script loaded');
//# sourceMappingURL=content.js.map