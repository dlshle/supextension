/**
 * Remote Server Connection
 * Connects the background worker to the remote puppet server via WebSocket
 */
import type { ApiResponse, ExtensionMessage } from '../api/types.js';
type MessageHandler = (message: ExtensionMessage) => Promise<ApiResponse>;
/**
 * Connect to the puppet server (idempotent)
 */
export declare function connectToServer(handler: MessageHandler, url?: string): void;
/**
 * Optionally emit events back to the server (e.g., streaming logs)
 */
export declare function emitEvent(event: string, data?: Record<string, unknown>): void;
export {};
//# sourceMappingURL=serverConnection.d.ts.map