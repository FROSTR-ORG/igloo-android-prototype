# IglooService - Core Service Architecture

## Overview

The `IglooService` is the central service layer that wraps `@frostr/igloo-core` for React Native. It provides an EventEmitter-based API that bridges the imperative igloo-core library with React's declarative component model.

**Location:** `services/igloo/IglooService.ts`

---

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                          │
│         (app/(tabs)/*.tsx, app/onboarding/*.tsx)            │
└─────────────────────────┬───────────────────────────────────┘
                          │ hooks
┌─────────────────────────▼───────────────────────────────────┐
│                     React Hooks                              │
│    useIgloo, useSigner, usePeers, useCredentials            │
│         (Subscribe to events, call methods)                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ events + methods
┌─────────────────────────▼───────────────────────────────────┐
│                   IglooService                               │
│              (EventEmitter singleton)                        │
│  - Manages BifrostNode lifecycle                            │
│  - Emits events for state changes                           │
│  - Wraps igloo-core functions                               │
└─────────────────────────┬───────────────────────────────────┘
                          │ calls
┌─────────────────────────▼───────────────────────────────────┐
│                  @frostr/igloo-core                          │
│       (createAndConnectNode, pingPeers, sendEcho, etc.)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Class Definition

```typescript
class IglooService extends EventEmitter<IglooServiceEvents> {
  private node: BifrostNode | null = null;
  private groupCredential: string | null = null;
  private shareCredential: string | null = null;
  private currentRelays: string[] = [];
  private pendingRequests: Map<string, SigningRequest> = new Map();

  // ... methods
}

// Singleton export
export const iglooService = new IglooService();
```

### Why Singleton?

The `BifrostNode` maintains network connections and state. A singleton ensures:
- Only one active node connection at a time
- Consistent state across all components
- Proper cleanup on stop

---

## Event System

The service extends `EventEmitter<IglooServiceEvents>` with strongly-typed events:

```typescript
interface IglooServiceEvents {
  'status:changed': (status: SignerStatus) => void;
  'relay:connected': (relay: string) => void;
  'relay:disconnected': (relay: string) => void;
  'signing:request': (request: SigningRequest) => void;
  'signing:complete': (result: SigningResult) => void;
  'signing:error': (error: Error, requestId?: string) => void;
  'peer:status': (pubkey: string, status: PeerStatus, latency?: number) => void;
  'log': (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  'error': (error: Error) => void;
}
```

### Event Flow Example

```
User taps "Start Signer"
       │
       ▼
useSigner.start()
       │
       ▼
iglooService.startSigner()
       │
       ├──► emit('status:changed', 'connecting')
       │
       ▼
createAndConnectNode() [igloo-core]
       │
       ├──► emit('relay:connected', relay) × N
       │
       ├──► emit('status:changed', 'running')
       │
       └──► emit('log', { level: 'info', message: '...' })
```

---

## Core Methods

### `startSigner()`

```typescript
async startSigner(
  groupCredential: string,
  shareCredential: string,
  relays: string[],
  options: StartSignerOptions = {}
): Promise<void>
```

**Flow:**
1. Check if already running → stop first if so
2. Emit `status:changed` → `'connecting'`
3. Call `createConnectedNode()` from igloo-core (returns `{ node, state }`)
4. Store credentials and only actually connected relays in instance
5. Set up node event listeners
6. Emit `status:changed` → `'running'`
7. Emit `relay:connected` for each connected relay
8. Log warning if some relays failed to connect

**Event Config passed to igloo-core:**
```typescript
const eventConfig: NodeEventConfig = {
  enableLogging: true,
  logLevel: 'debug',
  customLogger: (level, message, data) => {
    this.log(level, 'system', message, data);
  },
};
```

### `stopSigner()`

```typescript
async stopSigner(): Promise<void>
```

**Flow:**
1. Emit `relay:disconnected` for each connected relay
2. Call `cleanupBifrostNode()` from igloo-core
3. Clear instance state (node, credentials, relays)
4. Emit `status:changed` → `'stopped'`

### `validateCredentials()`

```typescript
validateCredentials(share: string, group: string): ValidationResult
```

Wraps `validateShare()` and `validateGroup()` from igloo-core:

```typescript
const shareResult = validateShare(share);
const groupResult = validateGroup(group);

return {
  isValid: shareResult.isValid && groupResult.isValid,
  shareValid: shareResult.isValid,
  groupValid: groupResult.isValid,
  shareError: shareResult.isValid ? undefined : shareResult.message,
  groupError: groupResult.isValid ? undefined : groupResult.message,
};
```

### `getShareDetails()`

```typescript
getShareDetails(share: string, group: string): ShareDetails | null
```

Wraps `decodeShare()` and `decodeGroup()` to extract:
- `idx` - Share index in the group
- `threshold` - Required signers (k)
- `totalMembers` - Total shares (n)
- `groupPubkey` - Public key of the FROST group

Returns `null` if credentials cannot be decoded (corrupted payload, etc.). Callers must handle null before using details.

### `getPeers()`

```typescript
getPeers(groupCredential?: string, shareCredential?: string): string[]
```

Wraps `extractPeersFromCredentials()` to get pubkeys of all peers in the group (excluding self).

### `pingAllPeers()`

```typescript
async pingAllPeers(timeout = 5000): Promise<PingResult[]>
```

Uses `pingPeersAdvanced()` from igloo-core for detailed ping results:

```typescript
const iglooResults = await pingPeersAdvanced(this.node, peers, { timeout });

// Convert to local PingResult type and emit status updates
const results: PingResult[] = iglooResults.map((result) => {
  const status: PeerStatus = result.success ? 'online' : 'offline';
  this.emit('peer:status', result.pubkey, status, result.latency);
  return { ...result };
});
```

### `sendEchoSignal()`

```typescript
async sendEchoSignal(
  challenge: string,
  relays: string[],
  groupCredential?: string,
  shareCredential?: string
): Promise<boolean>
```

Sends an echo signal during onboarding to notify the group that this share is active. Uses stored credentials if not provided.

### `updatePeerPolicies()`

```typescript
async updatePeerPolicies(policies: PeerPolicy[]): Promise<void>
```

Wraps `setNodePolicies()` to update send/receive permissions for peers:

```typescript
await setNodePolicies(
  this.node,
  policies.map((p) => ({
    pubkey: p.pubkey,
    allowSend: p.allowSend,
    allowReceive: p.allowReceive,
    label: p.label,
    note: p.note,
  })),
  { merge: true }
);
```

---

## Node Event Listeners

The service sets up listeners on the `BifrostNode` to forward events:

```typescript
private setupNodeEventListeners(): void {
  const node = this.node as unknown as {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
  };

  // Signing request received
  node.on('/sig/handler/req', (data: unknown) => {
    const request: SigningRequest = {
      id: generateRequestId(),
      pubkey: (data as { pubkey?: string })?.pubkey || 'unknown',
      timestamp: new Date(),
      eventKind: (data as { kind?: number })?.kind,
      status: 'pending',
    };
    this.emit('signing:request', request);
  });

  // Signing completed
  node.on('/sig/handler/ret', (data: unknown) => { ... });

  // Signing error
  node.on('/sig/handler/err', (error: unknown) => { ... });

  // Node error
  node.on('error', (error: unknown) => { ... });

  // Node closed
  node.on('closed', () => { ... });

  // Debug/info messages
  node.on('debug', (message: unknown) => { ... });
  node.on('info', (message: unknown) => { ... });
}
```

**Type Casting Note:**
`BifrostNode` types don't include all internal event names. The service casts to a generic type with an `on()` method.

---

## Signing Request Correlation

The service tracks pending signing requests to correlate them with completion/error events from igloo-core.

### Request Tracking

When a signing request is received, it's stored in `pendingRequests` Map:

```typescript
private pendingRequests: Map<string, SigningRequest> = new Map();
```

### Correlation Logic (`findAndRemovePendingRequest`)

When a completion or error event arrives, the service attempts to match it with a pending request:

1. **Pubkey match** - If the event includes a pubkey, find a pending request with matching pubkey
2. **FIFO fallback** - If exactly one pending request exists (unambiguous), use that
3. **Ambiguous case** - If multiple pending requests exist with no pubkey match, return undefined and log a warning

### Stale Request Cleanup

To prevent memory leaks when correlation fails repeatedly, the service implements timestamp-based eviction:

```typescript
private cleanupStaleRequests(maxAgeMs = 30000): void {
  const now = Date.now();
  for (const [id, request] of this.pendingRequests) {
    const age = now - request.timestamp.getTime();
    if (age > maxAgeMs) {
      this.pendingRequests.delete(id);
      this.log('warn', 'signing', 'Evicted stale signing request (>30s old)', {
        id,
        pubkey: truncatePubkey(request.pubkey),
        ageMs: age,
      });
    }
  }
}
```

This cleanup runs at the start of every `findAndRemovePendingRequest()` call, ensuring stale requests are evicted before correlation logic runs. The default max age is 30 seconds.

**Why this matters:** Without cleanup, the `pendingRequests` Map could grow indefinitely if:
- Multiple signing requests arrive simultaneously
- Completion events lack pubkey data for matching
- The correlation logic cannot safely match requests

The Map is also fully cleared when `stopSigner()` is called.

---

## Internal Logging

All operations log through a central method that emits to listeners:

```typescript
private log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>
): void {
  const entry: Omit<LogEntry, 'id' | 'timestamp'> = {
    level,
    category,
    message,
    data,
  };
  this.emit('log', entry);
}
```

This enables the verbose logging feature - all log entries are captured by `useIgloo` and stored in `logStore`.

---

## Logging Guidelines

### Log Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| `system` | Signer lifecycle, audio events, credential decode | "Signer node started", "Background audio resumed" |
| `relay` | Relay connection/disconnection events | "Connected to N relay(s)", "Disconnecting from relays" |
| `peer` | Peer extraction, ping operations, policy updates | "Extracted N peers", "Ping result" |
| `signing` | Signing requests, completions, errors, correlation | "Received signing request", "Signing request completed" |
| `echo` | Echo signal operations | "Initiating echo signal", "Echo sent successfully" |

### Log Levels

| Level | When to Use |
|-------|-------------|
| `debug` | Verbose per-operation details (ping results, credential decode success, echo initiation) |
| `info` | Normal operational events (signer started, relay connected, signing completed) |
| `warn` | Degraded states that aren't errors (audio interrupted, stale request evicted) |
| `error` | Failures requiring attention (signer failed, decode error, signing error) |

### Guidelines

1. **Category accuracy**: Use specific categories (`relay`, `signing`) over catch-all `system` when applicable
2. **Level appropriateness**: Reserve `info` for significant events; use `debug` for verbose/repeated operations
3. **Message clarity**: Include timeout/threshold values in eviction messages (e.g., ">30s old")
4. **Data payloads**: Include relevant counts and identifiers; truncate pubkeys with `truncatePubkey()`
5. **No duplication**: Don't log the same operation twice; consolidate fallback paths

---

## igloo-core APIs Used

```typescript
import {
  createConnectedNode,     // Create and connect BifrostNode (returns { node, state })
  cleanupBifrostNode,      // Stop and cleanup node
  validateShare,           // Validate bfshare credential
  validateGroup,           // Validate bfgroup credential
  getShareDetailsWithGroup, // Get share index, threshold
  extractPeersFromCredentials, // Get peer pubkeys
  pingPeersAdvanced,       // Ping peers for online status with detailed results
  sendEcho,                // Send echo signal
  setNodePolicies,         // Update peer policies
  extractSelfPubkeyFromCredentials, // Get own pubkey
} from '@frostr/igloo-core';
```

---

## Helper Functions

```typescript
// Truncate pubkey for display: "abc...xyz"
function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
```

---

## Usage in Hooks

The `useIgloo` hook connects events to stores. Since multiple components may call `useIgloo()` (e.g., `_layout.tsx`, `signer.tsx`, `useSigner`), a module-level ref count keeps listeners registered until the last consumer unmounts:

```typescript
// Module-level ref count to prevent duplicate registration
let listenersRefCount = 0;

export function useIgloo() {
  useEffect(() => {
    listenersRefCount += 1;

    if (listenersRefCount === 1) {
      iglooService.on('status:changed', handleStatusChange);
      iglooService.on('log', handleLog);
      // ... more subscriptions
    }

    return () => {
      listenersRefCount -= 1;

      if (listenersRefCount === 0) {
        iglooService.off('status:changed', handleStatusChange);
        // ... cleanup
      }
    };
  }, []);

  // Returns methods regardless of whether this call registered listeners
  return { startSigner, stopSigner, ... };
}
```

This pattern prevents duplicate log entries while ensuring listeners stay active for all mounted hook instances.

See `hooks/useIgloo.ts` for full implementation.
