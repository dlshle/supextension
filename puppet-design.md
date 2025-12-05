# Supextension Remote Browser Control - Technical Specification Document

## 1. Executive Summary

This document defines the technical requirements and architecture for extending Supextension to support remote browser control. The system will enable operators to control browsers running on remote machines through a centralized backend server and web-based frontend interface.

---

## 2. Requirements Definition

### 2.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | The browser plugin's background worker SHALL continuously poll the backend server for pending commands | Critical |
| FR-02 | The plugin SHALL execute received commands and return results to the backend server | Critical |
| FR-03 | The frontend UI SHALL provide all capabilities currently available in the popup UI | Critical |
| FR-04 | The system SHALL support multiple browser instances connecting to the same backend | High |
| FR-05 | Commands SHALL be queued when browsers are offline and delivered when reconnected | Medium |
| FR-06 | The system SHALL provide real-time status of connected browser instances | High |
| FR-07 | The frontend SHALL support targeting specific browser instances for commands | Critical |

### 2.2 Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | Command latency SHALL be under 2 seconds (polling interval + network) | High |
| NFR-02 | The system SHALL handle at least 100 concurrent browser connections | Medium |
| NFR-03 | All communication SHALL be encrypted (HTTPS/WSS) | Critical |
| NFR-04 | Browser instances SHALL authenticate with the backend | Critical |
| NFR-05 | The system SHALL gracefully handle network interruptions | High |

### 2.3 Supported Commands

All existing `BrowserController` API methods must be supported remotely:

| Category | Commands |
|----------|----------|
| Navigation | `navigate(url)`, `navigateBack()` |
| DOM Access | `getDOM(selector?)`, `getAllText()` |
| Screenshots | `takeScreenshot(format, quality)` |
| Script Injection | `injectScript(code, timing, waitForSelector)` |
| Storage | `getStorage(type, keys)`, `setStorage(type, data)` |
| Cookies | `getCookies(url?, name?)`, `setCookie(cookie)`, `deleteCookie(url, name)` |
| Network | `startNetworkCapture()`, `stopNetworkCapture()`, `getNetworkLog()`, `clearNetworkLog()` |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OPERATOR SIDE                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Frontend Web UI                                 │  │
│  │  • Browser Instance Dashboard                                          │  │
│  │  • Command Interface (mirrors popup functionality)                     │  │
│  │  • Real-time Status & Response Viewer                                 │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │ HTTPS/WebSocket
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND SERVER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  REST API       │  │  WebSocket Hub  │  │  Command Queue (Redis)      │  │
│  │  • Auth         │  │  • Real-time    │  │  • Pending commands per     │  │
│  │  • Commands     │  │    push to UI   │  │    browser instance         │  │
│  │  • Browser Mgmt │  │  • Status       │  │  • Response storage         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Browser Instance Registry                                              ││
│  │  • Instance ID → Connection Status, Last Seen, Metadata                 ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ HTTPS (Polling) or WebSocket
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REMOTE BROWSER (n instances)                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Supextension Plugin                                 │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Background Service Worker (Enhanced)                           │  │  │
│  │  │  • Remote Command Poller / WebSocket Client                     │  │  │
│  │  │  • Command Executor (existing handleMessage logic)              │  │  │
│  │  │  • Response Dispatcher                                          │  │  │
│  │  │  • Heartbeat / Status Reporter                                  │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                               │                                        │  │
│  │                               ▼                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Content Scripts (existing)                                     │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibilities |
|-----------|------------------|
| **Frontend UI** | Display connected browsers, send commands, show responses, real-time updates |
| **Backend Server** | Authenticate browsers/operators, queue commands, route responses, maintain registry |
| **Browser Plugin** | Poll/receive commands, execute via existing logic, report status, send responses |

---

## 4. Communication Protocols

### 4.1 Option A: HTTP Long Polling (Simpler)

**Plugin → Backend Communication:**

```
┌──────────────┐                     ┌──────────────┐
│   Plugin     │                     │   Backend    │
│  Background  │                     │   Server     │
└──────┬───────┘                     └──────┬───────┘
       │                                    │
       │  POST /api/poll                    │
       │  { instanceId, status, lastCmdId } │
       │ ─────────────────────────────────► │
       │                                    │
       │  Response (holds up to 30s or      │
       │  until command available)          │
       │  { commands: [...] }               │
       │ ◄───────────────────────────────── │
       │                                    │
       │  POST /api/commands/{cmdId}/result │
       │  { success, data, error }          │
       │ ─────────────────────────────────► │
       │                                    │
```

**Pros:**
- Simpler implementation
- Works through most firewalls/proxies
- Stateless server

**Cons:**
- Higher latency (up to polling interval)
- More HTTP overhead

### 4.2 Option B: WebSocket (Real-time, Recommended)

**Bidirectional Communication:**

```
┌──────────────┐                     ┌──────────────┐
│   Plugin     │◄───── WebSocket ───►│   Backend    │
│  Background  │       Connection    │   Server     │
└──────────────┘                     └──────────────┘

Messages:
  Plugin → Server:
    • { type: "register", instanceId, metadata }
    • { type: "heartbeat", status }
    • { type: "commandResult", commandId, result }

  Server → Plugin:
    • { type: "command", commandId, action, params }
    • { type: "ack", commandId }
```

**Pros:**
- Real-time command delivery
- Lower latency (~100ms)
- Efficient (single persistent connection)

**Cons:**
- More complex reconnection logic
- Requires WebSocket support on backend

### 4.3 Recommendation

**Use WebSocket with HTTP fallback:**
- Primary: WebSocket for real-time communication
- Fallback: HTTP polling if WebSocket unavailable
- Registration/Auth: Always via HTTPS REST API

---

## 5. API Design

### 5.1 Backend REST API

#### Authentication

```
POST /api/auth/register-instance
Request:
{
  "apiKey": "secret-key-for-instance",
  "metadata": {
    "userAgent": "...",
    "platform": "...",
    "extensionVersion": "1.0.0"
  }
}
Response:
{
  "instanceId": "uuid-v4",
  "token": "jwt-token",
  "wsEndpoint": "wss://server/ws"
}
```

#### Commands (Frontend → Backend)

```
POST /api/commands
Headers: Authorization: Bearer <operator-token>
Request:
{
  "instanceId": "target-browser-id",  // or "all" for broadcast
  "action": "NAVIGATE",
  "params": {
    "url": "https://example.com"
  },
  "timeout": 30000  // optional, ms
}
Response:
{
  "commandId": "uuid-v4",
  "status": "queued"
}

GET /api/commands/{commandId}
Response:
{
  "commandId": "...",
  "status": "completed",  // queued | sent | completed | failed | timeout
  "result": {
    "success": true,
    "data": { ... }
  },
  "timestamps": {
    "queued": "...",
    "sent": "...",
    "completed": "..."
  }
}
```

#### Browser Instance Management

```
GET /api/instances
Response:
{
  "instances": [
    {
      "instanceId": "...",
      "status": "online",  // online | offline | busy
      "lastSeen": "2024-01-01T00:00:00Z",
      "metadata": { ... },
      "currentUrl": "https://...",
      "pendingCommands": 2
    }
  ]
}

DELETE /api/instances/{instanceId}
// Disconnect and deregister instance
```

### 5.2 WebSocket Protocol

#### Message Types

```typescript
// Plugin → Server
interface RegisterMessage {
  type: 'register';
  token: string;  // JWT from REST auth
}

interface HeartbeatMessage {
  type: 'heartbeat';
  status: 'idle' | 'busy';
  currentUrl?: string;
  tabCount?: number;
}

interface CommandResultMessage {
  type: 'commandResult';
  commandId: string;
  result: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
}

// Server → Plugin
interface CommandMessage {
  type: 'command';
  commandId: string;
  action: MessageType;  // Existing types: NAVIGATE, GET_DOM, etc.
  params: Record<string, unknown>;
}

interface AckMessage {
  type: 'ack';
  commandId: string;
}
```

### 5.3 Command Action Types (Reuse Existing)

```typescript
type CommandAction = 
  | 'NAVIGATE'
  | 'NAVIGATE_BACK'
  | 'GET_DOM'
  | 'GET_ALL_TEXT'
  | 'TAKE_SCREENSHOT'
  | 'INJECT_SCRIPT'
  | 'GET_STORAGE'
  | 'SET_STORAGE'
  | 'GET_COOKIES'
  | 'SET_COOKIE'
  | 'DELETE_COOKIE'
  | 'START_NETWORK_CAPTURE'
  | 'STOP_NETWORK_CAPTURE'
  | 'GET_NETWORK_LOG'
  | 'CLEAR_NETWORK_LOG';
```

---

## 6. Implementation Details

### 6.1 Browser Plugin Modifications

#### New Files to Add

```
src/
├── remote/
│   ├── RemoteClient.ts      # WebSocket/polling client
│   ├── CommandExecutor.ts   # Bridges remote commands to existing handlers
│   └── config.ts            # Server URL, API key config
```

#### `RemoteClient.ts` Implementation

```typescript
/**
 * RemoteClient - Handles communication with backend server
 */

interface RemoteConfig {
  serverUrl: string;
  apiKey: string;
  pollingInterval?: number;  // fallback polling interval in ms
  heartbeatInterval?: number;
}

export class RemoteClient {
  private ws: WebSocket | null = null;
  private instanceId: string | null = null;
  private token: string | null = null;
  private config: RemoteConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private commandHandler: (command: Command) => Promise<CommandResult>;

  constructor(config: RemoteConfig, commandHandler: (cmd: Command) => Promise<CommandResult>) {
    this.config = config;
    this.commandHandler = commandHandler;
  }

  async initialize(): Promise<void> {
    // 1. Register with backend via REST
    const response = await fetch(`${this.config.serverUrl}/api/auth/register-instance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: this.config.apiKey,
        metadata: {
          userAgent: navigator.userAgent,
          extensionVersion: chrome.runtime.getManifest().version,
        },
      }),
    });

    const data = await response.json();
    this.instanceId = data.instanceId;
    this.token = data.token;

    // 2. Connect WebSocket
    await this.connectWebSocket(data.wsEndpoint);

    // 3. Start heartbeat
    this.startHeartbeat();
  }

  private async connectWebSocket(endpoint: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        this.ws!.send(JSON.stringify({ type: 'register', token: this.token }));
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await this.handleServerMessage(message);
      };

      this.ws.onclose = () => {
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[RemoteClient] WebSocket error:', error);
        reject(error);
      };
    });
  }

  private async handleServerMessage(message: ServerMessage): Promise<void> {
    switch (message.type) {
      case 'command':
        // Execute command using existing handler
        const result = await this.commandHandler({
          type: message.action,
          ...message.params,
        });

        // Send result back
        this.ws?.send(JSON.stringify({
          type: 'commandResult',
          commandId: message.commandId,
          result,
        }));
        break;

      case 'ack':
        console.log(`[RemoteClient] Command ${message.commandId} acknowledged`);
        break;
    }
  }

  private startHeartbeat(): void {
    setInterval(async () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        this.ws.send(JSON.stringify({
          type: 'heartbeat',
          status: 'idle',
          currentUrl: tabs[0]?.url,
          tabCount: (await chrome.tabs.query({})).length,
        }));
      }
    }, this.config.heartbeatInterval || 10000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RemoteClient] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    setTimeout(() => {
      this.connectWebSocket(`${this.config.serverUrl.replace('http', 'ws')}/ws`);
    }, delay);
  }
}
```

#### Modified `background.ts`

```typescript
// Add at the top of background.ts
import { RemoteClient } from '../remote/RemoteClient.js';

// Add after existing initialization
const remoteConfig = {
  serverUrl: 'https://your-backend-server.com',  // Configure via storage
  apiKey: 'your-api-key',  // Configure via popup or storage
  heartbeatInterval: 10000,
};

let remoteClient: RemoteClient | null = null;

async function initializeRemoteControl(): Promise<void> {
  // Load config from storage
  const stored = await chrome.storage.local.get(['remoteServerUrl', 'remoteApiKey']);
  
  if (stored.remoteServerUrl && stored.remoteApiKey) {
    remoteClient = new RemoteClient(
      {
        serverUrl: stored.remoteServerUrl,
        apiKey: stored.remoteApiKey,
        heartbeatInterval: 10000,
      },
      // Pass existing handleMessage as command handler
      async (command) => {
        return handleMessage(command as ExtensionMessage, {} as chrome.runtime.MessageSender);
      }
    );

    await remoteClient.initialize();
    console.log('[Supextension] Remote control initialized');
  }
}

// Call during initialization
initialize();
initializeRemoteControl();
```

### 6.2 Backend Server Implementation

#### Tech Stack Recommendation

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js + TypeScript | Matches plugin codebase |
| Framework | Fastify or Express | High performance REST API |
| WebSocket | ws or Socket.io | Reliable WebSocket handling |
| Queue | Redis or BullMQ | Command queuing, pub/sub for scaling |
| Database | PostgreSQL or SQLite | Instance registry, command history |
| Auth | JWT | Stateless authentication |

#### Project Structure

```
backend/
├── src/
│   ├── server.ts              # Entry point
│   ├── routes/
│   │   ├── auth.ts            # Instance registration
│   │   ├── commands.ts        # Command CRUD
│   │   └── instances.ts       # Instance management
│   ├── websocket/
│   │   ├── handler.ts         # WebSocket message handling
│   │   └── connectionManager.ts
│   ├── services/
│   │   ├── commandQueue.ts    # Redis queue operations
│   │   └── instanceRegistry.ts
│   ├── types/
│   │   └── index.ts           # Shared types
│   └── middleware/
│       └── auth.ts            # JWT validation
├── package.json
└── tsconfig.json
```

#### Core Backend Code (`server.ts`)

```typescript
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth';
import { commandRoutes } from './routes/commands';
import { instanceRoutes } from './routes/instances';
import { handleWebSocket } from './websocket/handler';

const server = Fastify({ logger: true });

await server.register(cors, { origin: true });
await server.register(websocket);

// REST routes
server.register(authRoutes, { prefix: '/api/auth' });
server.register(commandRoutes, { prefix: '/api/commands' });
server.register(instanceRoutes, { prefix: '/api/instances' });

// WebSocket endpoint
server.get('/ws', { websocket: true }, (connection, req) => {
  handleWebSocket(connection.socket, req);
});

server.listen({ port: 3000, host: '0.0.0.0' });
```

#### WebSocket Handler (`websocket/handler.ts`)

```typescript
import { WebSocket } from 'ws';
import { verifyToken } from '../middleware/auth';
import { instanceRegistry } from '../services/instanceRegistry';
import { commandQueue } from '../services/commandQueue';

interface Connection {
  ws: WebSocket;
  instanceId: string;
  authenticated: boolean;
}

const connections = new Map<string, Connection>();

export function handleWebSocket(ws: WebSocket, req: any): void {
  let connection: Connection = { ws, instanceId: '', authenticated: false };

  ws.on('message', async (data) => {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'register':
        const payload = verifyToken(message.token);
        if (payload) {
          connection.instanceId = payload.instanceId;
          connection.authenticated = true;
          connections.set(payload.instanceId, connection);
          await instanceRegistry.setOnline(payload.instanceId);

          // Send any pending commands
          const pending = await commandQueue.getPending(payload.instanceId);
          for (const cmd of pending) {
            ws.send(JSON.stringify({ type: 'command', ...cmd }));
          }
        }
        break;

      case 'heartbeat':
        if (connection.authenticated) {
          await instanceRegistry.updateStatus(connection.instanceId, message);
        }
        break;

      case 'commandResult':
        if (connection.authenticated) {
          await commandQueue.setResult(message.commandId, message.result);
          // Notify frontend via pub/sub
          broadcastToFrontend({
            type: 'commandCompleted',
            commandId: message.commandId,
            instanceId: connection.instanceId,
            result: message.result,
          });
        }
        break;
    }
  });

  ws.on('close', async () => {
    if (connection.instanceId) {
      await instanceRegistry.setOffline(connection.instanceId);
      connections.delete(connection.instanceId);
    }
  });
}

// Called when frontend sends a command
export async function sendCommandToInstance(instanceId: string, command: Command): Promise<void> {
  const connection = connections.get(instanceId);
  
  if (connection?.ws.readyState === WebSocket.OPEN) {
    connection.ws.send(JSON.stringify({ type: 'command', ...command }));
    await commandQueue.markSent(command.commandId);
  } else {
    // Instance offline, command stays queued
    await commandQueue.enqueue(instanceId, command);
  }
}
```

### 6.3 Frontend Web UI Implementation

#### Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | React + TypeScript |
| State | Zustand or React Query |
| Real-time | Socket.io-client |
| UI | Tailwind CSS + shadcn/ui |
| Build | Vite |

#### Project Structure

```
frontend/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── api/
│   │   └── client.ts          # REST + WebSocket client
│   ├── components/
│   │   ├── InstanceList.tsx   # Browser instance cards
│   │   ├── CommandPanel.tsx   # Command interface
│   │   ├── ResponseViewer.tsx # Command results display
│   │   └── StatusIndicator.tsx
│   ├── hooks/
│   │   ├── useInstances.ts
│   │   └── useCommands.ts
│   ├── stores/
│   │   └── appStore.ts
│   └── types/
│       └── index.ts
├── package.json
└── vite.config.ts
```

#### Main App Component

```tsx
// App.tsx
import { useEffect } from 'react';
import { useInstances } from './hooks/useInstances';
import { useCommands } from './hooks/useCommands';
import { InstanceList } from './components/InstanceList';
import { CommandPanel } from './components/CommandPanel';
import { ResponseViewer } from './components/ResponseViewer';

export function App() {
  const { instances, selectedInstance, selectInstance } = useInstances();
  const { sendCommand, lastResponse } = useCommands();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 p-4">
        <h1 className="text-xl font-bold">Supextension Remote Control</h1>
      </header>

      <div className="grid grid-cols-12 gap-4 p-4">
        {/* Browser Instances Sidebar */}
        <aside className="col-span-3">
          <InstanceList 
            instances={instances}
            selectedId={selectedInstance?.instanceId}
            onSelect={selectInstance}
          />
        </aside>

        {/* Main Command Panel */}
        <main className="col-span-6">
          <CommandPanel 
            instance={selectedInstance}
            onSendCommand={sendCommand}
          />
        </main>

        {/* Response Viewer */}
        <aside className="col-span-3">
          <ResponseViewer response={lastResponse} />
        </aside>
      </div>
    </div>
  );
}
```

#### Command Panel (Mirrors Popup UI)

```tsx
// components/CommandPanel.tsx
interface CommandPanelProps {
  instance: BrowserInstance | null;
  onSendCommand: (action: string, params: Record<string, any>) => void;
}

export function CommandPanel({ instance, onSendCommand }: CommandPanelProps) {
  const [url, setUrl] = useState('');

  if (!instance) {
    return <div className="text-gray-500">Select a browser instance</div>;
  }

  return (
    <div className="space-y-6">
      {/* Navigation Section */}
      <section className="bg-gray-900 rounded-lg p-4">
        <h2 className="font-semibold mb-3">Navigation</h2>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL..."
            className="flex-1 bg-gray-800 rounded px-3 py-2"
          />
          <button
            onClick={() => onSendCommand('NAVIGATE', { url })}
            className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded"
          >
            Go
          </button>
        </div>
        <button
          onClick={() => onSendCommand('NAVIGATE_BACK', {})}
          className="mt-2 w-full bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded"
        >
          ← Navigate Back
        </button>
      </section>

      {/* Content Section */}
      <section className="bg-gray-900 rounded-lg p-4">
        <h2 className="font-semibold mb-3">Content</h2>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onSendCommand('GET_DOM', {})} className="btn">
            Get DOM
          </button>
          <button onClick={() => onSendCommand('GET_ALL_TEXT', {})} className="btn">
            Get Text
          </button>
          <button onClick={() => onSendCommand('TAKE_SCREENSHOT', { format: 'png' })} className="btn">
            Screenshot
          </button>
          <button onClick={() => openScriptModal()} className="btn">
            Inject JS
          </button>
        </div>
      </section>

      {/* Storage & Cookies */}
      <section className="bg-gray-900 rounded-lg p-4">
        <h2 className="font-semibold mb-3">Storage & Cookies</h2>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onSendCommand('GET_STORAGE', { storageType: 'local' })} className="btn">
            Local Storage
          </button>
          <button onClick={() => onSendCommand('GET_STORAGE', { storageType: 'session' })} className="btn">
            Session Storage
          </button>
          <button onClick={() => onSendCommand('GET_COOKIES', {})} className="btn col-span-2">
            Get Cookies
          </button>
        </div>
      </section>

      {/* Network Capture */}
      <section className="bg-gray-900 rounded-lg p-4">
        <h2 className="font-semibold mb-3">Network Capture</h2>
        <div className="flex gap-2">
          <button onClick={() => onSendCommand('START_NETWORK_CAPTURE', {})} className="btn-accent">
            Start Capture
          </button>
          <button onClick={() => onSendCommand('STOP_NETWORK_CAPTURE', {})} className="btn">
            Stop
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={() => onSendCommand('GET_NETWORK_LOG', {})} className="btn flex-1">
            View Log
          </button>
          <button onClick={() => onSendCommand('CLEAR_NETWORK_LOG', {})} className="btn flex-1">
            Clear
          </button>
        </div>
      </section>
    </div>
  );
}
```

---

## 7. Security Considerations

### 7.1 Authentication Flow

```
1. Browser Plugin Registration:
   - Plugin sends API key (pre-configured) to backend
   - Backend validates API key, generates instanceId + JWT
   - JWT includes instanceId, expiry, permissions

2. Operator Authentication:
   - Operator logs in via frontend (username/password or SSO)
   - Backend issues operator JWT with allowed instanceIds
   - Frontend sends JWT with all commands

3. Command Authorization:
   - Backend verifies operator can access target instance
   - Commands logged with operator identity
```

### 7.2 Security Measures

| Measure | Implementation |
|---------|----------------|
| Transport | TLS 1.3 for all HTTP/WebSocket |
| API Keys | Rotate regularly, store hashed |
| JWT | Short expiry (1h), refresh tokens |
| Rate Limiting | 100 commands/min per operator |
| Input Validation | Sanitize URLs, script code |
| Audit Log | All commands logged with timestamps |

---

## 8. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Production                               │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Frontend   │    │   Backend    │    │    Redis     │       │
│  │   (Vercel/   │◄──►│  (Docker/    │◄──►│   (Queue)    │       │
│  │   Netlify)   │    │   K8s)       │    │              │       │
│  └──────────────┘    └──────┬───────┘    └──────────────┘       │
│                             │                                    │
│                             │ WebSocket                          │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Load Balancer (sticky sessions)              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│              ┌──────────────┼──────────────┐                    │
│              ▼              ▼              ▼                    │
│         ┌────────┐    ┌────────┐    ┌────────┐                  │
│         │ Plugin │    │ Plugin │    │ Plugin │                  │
│         │   #1   │    │   #2   │    │   #n   │                  │
│         └────────┘    └────────┘    └────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Backend server with REST API for registration and commands
- [ ] WebSocket connection handling
- [ ] Plugin RemoteClient with WebSocket support
- [ ] Basic frontend with instance list and manual command input

### Phase 2: Full Feature Parity (Week 3-4)
- [ ] Complete CommandPanel UI matching popup functionality
- [ ] Response viewer with formatting for different response types
- [ ] Screenshot display and download
- [ ] Network log viewer

### Phase 3: Production Readiness (Week 5-6)
- [ ] Authentication and authorization
- [ ] Error handling and reconnection logic
- [ ] Logging and monitoring
- [ ] Load testing and optimization

### Phase 4: Enhanced Features (Week 7+)
- [ ] Command history and replay
- [ ] Batch commands to multiple instances
- [ ] Scheduled/automated command sequences
- [ ] Instance grouping and labeling

---

## 10. Configuration

### Plugin Configuration (via `chrome.storage`)

```json
{
  "remoteServerUrl": "https://supextension-backend.example.com",
  "remoteApiKey": "sk_live_xxxxxxxxxxxx",
  "remoteEnabled": true,
  "heartbeatInterval": 10000,
  "autoReconnect": true
}
```

### Backend Configuration (`.env`)

```env
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/supextension
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
API_KEY_HASH_SALT=random-salt
CORS_ORIGIN=https://supextension-ui.example.com
```

---

## 11. Summary

This technical specification provides a complete blueprint for extending Supextension to support remote browser control. The architecture uses:

1. **WebSocket** for real-time bidirectional communication
2. **REST API** for registration, authentication, and command management
3. **Existing command handling** logic in the background worker (reused)
4. **React-based frontend** mirroring the popup UI capabilities

The implementation maintains backward compatibility with the existing popup interface while adding powerful remote control capabilities through a centralized backend server.
