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
declare class DOMObserver {
    private observer;
    private callbacks;
    /**
     * Start observing for a specific selector
     */
    watchForSelector(selector: string, callback: (element: Element) => void): void;
    /**
     * Stop all observations
     */
    stopAll(): void;
}
declare const domObserver: DOMObserver;
/**
 * Process incoming messages
 */
declare function handleMessage(message: ContentMessage): Promise<ContentResponse>;
/**
 * Get DOM content
 */
declare function getDOMContent(selector?: string): ContentResponse;
/**
 * Get all visible text from the page
 */
declare function getAllText(): ContentResponse;
/**
 * Inject and execute JavaScript code
 */
declare function injectScript(code?: string, waitForSelector?: string): Promise<ContentResponse>;
/**
 * Wait for an element to appear
 */
declare function waitForElement(selector: string, timeout: number): Promise<Element>;
/**
 * Get storage data
 */
declare function getStorage(storageType?: 'local' | 'session', keys?: string[]): ContentResponse;
/**
 * Set storage data
 */
declare function setStorage(storageType?: 'local' | 'session', data?: Record<string, unknown>): ContentResponse;
/**
 * Watch for a selector to appear
 */
declare function watchSelector(selector?: string): ContentResponse;
//# sourceMappingURL=content.d.ts.map