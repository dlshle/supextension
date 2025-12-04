/**
 * Content Script
 * Runs in the context of web pages and provides DOM access
 */

interface ContentMessage {
  type: string;
  selector?: string;
  code?: string;
  waitForSelector?: string;
  storageType?: 'local' | 'session';
  keys?: string[];
  data?: Record<string, unknown>;
}

interface ContentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Observer for watching DOM changes
 */
class DOMObserver {
  private observer: MutationObserver | null = null;
  private callbacks: Map<string, (element: Element) => void> = new Map();

  /**
   * Start observing for a specific selector
   */
  watchForSelector(selector: string, callback: (element: Element) => void): void {
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
  stopAll(): void {
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
chrome.runtime.onMessage.addListener(
  (message: ContentMessage, _sender, sendResponse: (response: ContentResponse) => void) => {
    handleMessage(message).then(sendResponse);
    return true; // Keep channel open for async response
  }
);

/**
 * Process incoming messages
 */
async function handleMessage(message: ContentMessage): Promise<ContentResponse> {
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get DOM content
 */
function getDOMContent(selector?: string): ContentResponse {
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
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get all visible text from the page
 */
function getAllText(): ContentResponse {
  try {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

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
          if (!text) return NodeFilter.FILTER_REJECT;

          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const texts: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text) texts.push(text);
    }

    return { success: true, data: texts.join('\n') };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Inject and execute JavaScript code
 */
async function injectScript(code?: string, waitForSelector?: string): Promise<ContentResponse> {
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
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Wait for an element to appear
 */
function waitForElement(selector: string, timeout: number): Promise<Element> {
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
function getStorage(
  storageType?: 'local' | 'session',
  keys?: string[]
): ContentResponse {
  try {
    const storage = storageType === 'session' ? sessionStorage : localStorage;
    const result: Record<string, unknown> = {};

    if (keys && keys.length > 0) {
      keys.forEach((key) => {
        const value = storage.getItem(key);
        if (value !== null) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        }
      });
    } else {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key) {
          const value = storage.getItem(key);
          if (value !== null) {
            try {
              result[key] = JSON.parse(value);
            } catch {
              result[key] = value;
            }
          }
        }
      }
    }

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Set storage data
 */
function setStorage(
  storageType?: 'local' | 'session',
  data?: Record<string, unknown>
): ContentResponse {
  try {
    if (!data) {
      return { success: false, error: 'No data provided' };
    }

    const storage = storageType === 'session' ? sessionStorage : localStorage;

    Object.entries(data).forEach(([key, value]) => {
      storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Watch for a selector to appear
 */
function watchSelector(selector?: string): ContentResponse {
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
  }) as unknown as ContentResponse;
}

// Log that content script is loaded
console.log('[Supextension] Content script loaded');

