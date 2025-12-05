/**
 * Types for the Supextension API
 */

// Message types for communication between components
export type MessageType =
  | 'NAVIGATE'
  | 'NAVIGATE_BACK'
  | 'GET_DOM'
  | 'TAKE_SCREENSHOT'
  | 'GET_ALL_TEXT'
  | 'INJECT_SCRIPT'
  | 'GET_STORAGE'
  | 'SET_STORAGE'
  | 'GET_COOKIES'
  | 'SET_COOKIE'
  | 'DELETE_COOKIE'
  | 'GET_NETWORK_LOG'
  | 'CLEAR_NETWORK_LOG'
  | 'START_NETWORK_CAPTURE'
  | 'STOP_NETWORK_CAPTURE'
  | 'SCROLL';

export interface BaseMessage {
  type: MessageType;
  tabId?: number;
}

export interface NavigateMessage extends BaseMessage {
  type: 'NAVIGATE';
  url: string;
}

export interface NavigateBackMessage extends BaseMessage {
  type: 'NAVIGATE_BACK';
}

export interface ScrollMessage extends BaseMessage {
  type: 'SCROLL';
  x?: number;
  y?: number;
  behavior?: 'auto' | 'smooth';
}

export interface GetDOMMessage extends BaseMessage {
  type: 'GET_DOM';
  selector?: string;
}

export interface TakeScreenshotMessage extends BaseMessage {
  type: 'TAKE_SCREENSHOT';
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface GetAllTextMessage extends BaseMessage {
  type: 'GET_ALL_TEXT';
}

export interface InjectScriptMessage extends BaseMessage {
  type: 'INJECT_SCRIPT';
  code?: string;
  file?: string;
  timing?: 'immediate' | 'document_start' | 'document_end' | 'document_idle';
  waitForSelector?: string;
}

export interface GetStorageMessage extends BaseMessage {
  type: 'GET_STORAGE';
  storageType: 'local' | 'session';
  keys?: string[];
}

export interface SetStorageMessage extends BaseMessage {
  type: 'SET_STORAGE';
  storageType: 'local' | 'session';
  data: Record<string, unknown>;
}

export interface GetCookiesMessage extends BaseMessage {
  type: 'GET_COOKIES';
  url?: string;
  name?: string;
}

export interface SetCookieMessage extends BaseMessage {
  type: 'SET_COOKIE';
  cookie: chrome.cookies.SetDetails;
}

export interface DeleteCookieMessage extends BaseMessage {
  type: 'DELETE_COOKIE';
  url: string;
  name: string;
}

export interface GetNetworkLogMessage extends BaseMessage {
  type: 'GET_NETWORK_LOG';
}

export interface ClearNetworkLogMessage extends BaseMessage {
  type: 'CLEAR_NETWORK_LOG';
}

export interface StartNetworkCaptureMessage extends BaseMessage {
  type: 'START_NETWORK_CAPTURE';
}

export interface StopNetworkCaptureMessage extends BaseMessage {
  type: 'STOP_NETWORK_CAPTURE';
}

export type ExtensionMessage =
  | NavigateMessage
  | NavigateBackMessage
  | GetDOMMessage
  | TakeScreenshotMessage
  | GetAllTextMessage
  | InjectScriptMessage
  | GetStorageMessage
  | SetStorageMessage
  | GetCookiesMessage
  | SetCookieMessage
  | DeleteCookieMessage
  | GetNetworkLogMessage
  | ClearNetworkLogMessage
  | StartNetworkCaptureMessage
  | StopNetworkCaptureMessage
  | ScrollMessage;

// Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Network log entry
export interface NetworkLogEntry {
  id: string;
  type: 'http' | 'websocket';
  timestamp: number;
  url: string;
  method?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  statusCode?: number;
  requestBody?: string;
  responseBody?: string;
  wsMessages?: WebSocketMessage[];
}

export interface WebSocketMessage {
  timestamp: number;
  direction: 'sent' | 'received';
  data: string;
  opcode?: number;
}

// DOM content result
export interface DOMContent {
  html: string;
  url: string;
  title: string;
}

// Storage data
export interface StorageData {
  [key: string]: unknown;
}

