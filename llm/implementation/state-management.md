# State Management Architecture

## Overview

The app uses **Zustand** for state management with a layered storage strategy:
- **expo-secure-store** - Encrypted storage for sensitive credentials
- **AsyncStorage** - Persistent storage for non-sensitive metadata
- **In-memory** - Ephemeral state that resets on app restart

---

## Storage Strategy Diagram

```text
┌──────────────────────────────────────────────────────────────┐
│                    Zustand Stores                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  credentialStore ─────► AsyncStorage (metadata)              │
│         │                                                    │
│         └─────────────► SecureStore (actual credentials)     │
│                                                              │
│  peerStore ───────────► AsyncStorage (policies only)         │
│                                                              │
│  relayStore ──────────► AsyncStorage (relay URLs)            │
│                                                              │
│  signerStore ─────────► In-memory only                       │
│                                                              │
│  logStore ────────────► In-memory only (500 entry buffer)    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Secure Storage Layer

**Location:** `services/storage/secureStorage.ts`

Wraps `expo-secure-store` for credential management:

```typescript
const STORAGE_KEYS = {
  SHARE: 'igloo_bfshare',
  GROUP: 'igloo_bfgroup',
} as const;

export const secureStorage = {
  saveCredentials(share: string, group: string): Promise<void>,
  getCredentials(): Promise<Credentials | null>,
  clearCredentials(): Promise<void>,
  hasCredentials(): Promise<boolean>,
  getShare(): Promise<string | null>,
  getGroup(): Promise<string | null>,
};
```

### Why Separate from Zustand?

1. **Security**: `expo-secure-store` uses Keychain (iOS) and Keystore (Android) for hardware-backed encryption
2. **Async nature**: SecureStore is async-only, while Zustand prefers sync state
3. **Sensitive data isolation**: Credentials never enter Zustand's serialized state

---

## Zustand Stores

### 1. Credential Store

**Location:** `stores/credentialStore.ts`

**Purpose:** Track credential existence and share metadata without storing actual credentials.

```typescript
interface CredentialStoreState {
  hasCredentials: boolean;      // Whether creds exist in SecureStore
  shareDetails: ShareDetails | null;  // Share index, threshold, etc.
  onboardingComplete: boolean;
  echoSent: boolean;
  isHydrated: boolean;          // Whether initial load is complete

  // Actions
  hydrateFromStorage: () => Promise<void>;
  setCredentialsExist: (exists: boolean) => void;
  setShareDetails: (details: ShareDetails | null) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setEchoSent: (sent: boolean) => void;
  clearCredentials: () => Promise<void>;
}
```

**Persistence Config:**

```typescript
persist(
  (set, get) => ({ ... }),
  {
    name: 'igloo-credentials',
    storage: createJSONStorage(() => AsyncStorage),
    // Only persist non-sensitive metadata
    partialize: (state) => ({
      shareDetails: state.shareDetails,
      onboardingComplete: state.onboardingComplete,
      echoSent: state.echoSent,
    }),
    onRehydrateStorage: () => (state) => {
      // After Zustand rehydrates, also check SecureStore
      state?.hydrateFromStorage();
    },
  }
)
```

**Key Pattern - Dual Hydration:**

1. Zustand's `persist` middleware rehydrates `shareDetails`, `onboardingComplete`, `echoSent` from AsyncStorage
2. `onRehydrateStorage` callback triggers `hydrateFromStorage()`
3. `hydrateFromStorage()` checks SecureStore and sets `hasCredentials` + `isHydrated`

This ensures we know if credentials exist without loading them into memory unnecessarily.

---

### 2. Signer Store

**Location:** `stores/signerStore.ts`

**Purpose:** Track ephemeral signer session state. Not persisted.

```typescript
interface SignerStoreState {
  status: SignerStatus;              // 'stopped' | 'connecting' | 'running' | 'error'
  connectedRelays: string[];
  lastError: string | null;
  signingRequestsReceived: number;
  signingRequestsCompleted: number;
  sessionStartTime: Date | null;
  recentRequests: SigningRequest[];  // Rolling buffer of 10

  // Actions
  setStatus: (status: SignerStatus) => void;
  setConnectedRelays: (relays: string[]) => void;
  setError: (error: string | null) => void;
  incrementRequestsReceived: () => void;
  incrementRequestsCompleted: () => void;
  addSigningRequest: (request: SigningRequest) => void;
  updateSigningRequest: (id: string, update: Partial<SigningRequest>) => void;
  resetSession: () => void;
}
```

**No Persistence:**
```typescript
// No persist() wrapper - state resets on app restart
export const useSignerStore = create<SignerStoreState>()((set, get) => ({ ... }));
```

**Session Start Logic:**
```typescript
setStatus: (status: SignerStatus) => {
  set((state) => ({
    status,
    // Set sessionStartTime when transitioning to 'running'
    sessionStartTime: status === 'running' && state.status !== 'running'
      ? new Date()
      : state.sessionStartTime,
    // Clear error when successfully running
    lastError: status === 'running' ? null : state.lastError,
  }));
},
```

---

### 3. Peer Store

**Location:** `stores/peerStore.ts`

**Purpose:** Track peer status and policies. Persists policies only.

```typescript
interface PeerStoreState {
  peers: Record<string, Peer>;    // Keyed by pubkey
  selfPubkey: string | null;
  lastPingTime: Date | null;      // Date object (ephemeral, not persisted)

  // Actions
  setPeers: (peers: Peer[]) => void;
  updatePeer: (pubkey: string, update: Partial<Peer>) => void;
  updatePeerStatus: (pubkey: string, status: PeerStatus, latency?: number) => void;
  updatePeerPolicy: (pubkey: string, policy: { allowSend?: boolean; allowReceive?: boolean }) => void;
  setSelfPubkey: (pubkey: string) => void;
  setLastPingTime: (time: Date) => void;
  clearPeers: () => void;
}
```

**Persistence Config - Policies Only:**

```typescript
persist(
  (set, get) => ({ ... }),
  {
    name: 'igloo-peers',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (state) => ({
      peers: Object.fromEntries(
        Object.entries(state.peers).map(([pubkey, peer]) => [
          pubkey,
          {
            pubkey: peer.pubkey,
            displayName: peer.displayName,
            allowSend: peer.allowSend,
            allowReceive: peer.allowReceive,
            // Don't persist ephemeral state
            status: 'unknown' as const,
            lastSeen: null,
            latency: null,
          },
        ])
      ),
      selfPubkey: state.selfPubkey,
    }),
  }
)
```

**Policy Preservation Pattern:**

When `setPeers()` is called with new peer data, existing policies are preserved:

```typescript
setPeers: (peers: Peer[]) => {
  const peersRecord: Record<string, Peer> = {};
  for (const peer of peers) {
    const existing = get().peers[peer.pubkey];
    peersRecord[peer.pubkey] = {
      ...peer,
      allowSend: existing?.allowSend ?? peer.allowSend,
      allowReceive: existing?.allowReceive ?? peer.allowReceive,
    };
  }
  set({ peers: peersRecord });
},
```

---

### 4. Relay Store

**Location:** `stores/relayStore.ts`

**Purpose:** Manage relay configuration. Fully persisted.

```typescript
interface RelayStoreState {
  relays: string[];

  // Actions
  addRelay: (relay: string) => void;
  removeRelay: (relay: string) => void;
  setRelays: (relays: string[]) => void;
  resetToDefaults: () => void;
}
```

**Default Relays:**
```typescript
export const DEFAULT_RELAYS = [
  'wss://relay.primal.net',
] as const;
```

**URL Normalization:**

All relay URLs are normalized before storage:

```typescript
function normalizeRelayUrl(url: string): string | null {
  let normalized = url.trim();

  // Add wss:// if no protocol
  if (!normalized.startsWith('wss://') && !normalized.startsWith('ws://')) {
    normalized = `wss://${normalized}`;
  }

  // Upgrade ws to wss
  if (normalized.startsWith('ws://')) {
    normalized = normalized.replace('ws://', 'wss://');
  }

  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, '');

  // Validate URL format
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'wss:') return null;

  return normalized;
}
```

**Validation Notes:**
- The UI (settings.tsx) provides immediate feedback, checking for valid WebSocket URLs
- The store performs the actual normalization and enforces `wss://` protocol
- Localhost and IP addresses are allowed in the UI for development
- The store silently rejects invalid URLs by returning early if `normalizeRelayUrl` returns `null`

---

### 5. Log Store

**Location:** `stores/logStore.ts`

**Purpose:** In-memory rolling buffer for verbose event logging.

```typescript
interface LogStoreState {
  entries: LogEntry[];
  maxEntries: number;           // Default: 500
  filter: LogFilter;
  autoScroll: boolean;

  // Actions
  addEntry: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setFilter: (filter: Partial<LogFilter>) => void;
  setMaxEntries: (max: number) => void;
  setAutoScroll: (enabled: boolean) => void;
}
```

**Rolling Buffer Implementation:**

```typescript
addEntry: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
  set((state) => {
    const newEntry: LogEntry = {
      ...entry,
      id: nanoid(),
      timestamp: new Date().toISOString(),
    };

    // Prepend new entry and enforce max limit
    let entries = [newEntry, ...state.entries];
    if (entries.length > state.maxEntries) {
      entries = entries.slice(0, state.maxEntries);
    }

    return { entries };
  });
},
```

**Filter Helpers:**

```typescript
export function getFilteredLogs(state: LogStoreState): LogEntry[] {
  return state.entries.filter(
    (entry) =>
      state.filter.levels.includes(entry.level) &&
      state.filter.categories.includes(entry.category)
  );
}
```

---

## React Hooks

### `useIgloo` - Event Bridge

**Location:** `hooks/useIgloo.ts`

Connects `IglooService` events to Zustand stores:

```typescript
useEffect(() => {
  const handleStatusChange = (status: SignerStatus) => {
    setStatus(status);
  };

  const handleLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    addLogEntry(entry);
  };

  iglooService.on('status:changed', handleStatusChange);
  iglooService.on('log', handleLog);
  // ... more subscriptions

  return () => {
    iglooService.off('status:changed', handleStatusChange);
    iglooService.off('log', handleLog);
    // ... cleanup
  };
}, [setStatus, addLogEntry, ...]);
```

### `useSigner` - Signer Control

**Location:** `hooks/useSigner.ts`

High-level hook for signer operations:

```typescript
export function useSigner() {
  const { startSigner, stopSigner, isRunning } = useIgloo();

  // Select state from stores
  const status = useSignerStore((s) => s.status);
  const relays = useRelayStore((s) => s.relays);

  const start = useCallback(async () => {
    const credentials = await secureStorage.getCredentials();
    if (!credentials) throw new Error('No credentials found');
    await startSigner(credentials.group, credentials.share, relays);
  }, [startSigner, relays]);

  return {
    status,
    isRunning: status === 'running',
    start,
    stop,
    toggle,
    ...
  };
}
```

### `usePeers` - Peer Management

**Location:** `hooks/usePeers.ts`

```typescript
export function usePeers() {
  const { getPeers, getSelfPubkey, pingAllPeers, updatePolicies } = useIgloo();
  const peers = Object.values(usePeerStore((s) => s.peers));

  const loadPeers = useCallback(async () => {
    const credentials = await secureStorage.getCredentials();
    if (!credentials) return;

    const peerPubkeys = getPeers(credentials.group, credentials.share);
    // Create peer objects with default values
    setPeers(peerPubkeys.map(pubkey => ({ pubkey, status: 'unknown', ... })));
  }, []);

  // Auto-load peers when credentials become available
  useEffect(() => {
    if (hasCredentials) loadPeers();
  }, [hasCredentials]);

  return { peers, pingPeers, setPeerPolicy, ... };
}
```

### `useCredentials` - Credential Management

**Location:** `hooks/useCredentials.ts`

```typescript
export function useCredentials() {
  const { validateCredentials, getShareDetails, sendEcho } = useIgloo();

  const saveCredentials = useCallback(async (share, group) => {
    // 1. Validate format (bech32 prefix/checksum)
    const validation = validateCredentials(share, group);
    if (!validation.isValid) throw new Error(...);

    // 2. Decode credentials (catches corrupted payloads)
    // Returns null if decode fails - must check before persisting
    const details = getShareDetails(share, group);
    if (!details) throw new Error('Failed to decode credentials');

    // 3. Only persist after decode succeeds
    await secureStorage.saveCredentials(share, group);
    setCredentialsExist(true);
    setShareDetails(details);

    // 4. Send echo (non-blocking)
    try {
      const challenge = generateHexChallenge(32);
      const echoSuccess = await sendEcho(challenge, relays, group, share);
      setEchoSent(echoSuccess);
    } catch { /* Continue even if echo fails */ }

    setOnboardingComplete(true);
    return { success: true, echoSent };
  }, [...]);

  return { validate, saveCredentials, deleteCredentials, ... };
}
```

---

## Type Definitions

**Location:** `types/index.ts`

All store state interfaces and related types are centralized:

```typescript
// Credential types
export interface ShareDetails { ... }
export interface Credentials { ... }
export interface ValidationResult { ... }

// Signer types
export type SignerStatus = 'stopped' | 'connecting' | 'running' | 'error';
export interface SigningRequest { ... }

// Peer types
export type PeerStatus = 'online' | 'offline' | 'unknown';
export interface Peer { ... }
export interface PeerPolicy { ... }
export interface PingResult { ... }

// Log types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'signing' | 'relay' | 'peer' | 'echo' | 'system';
export interface LogEntry { ... }  // timestamp is ISO 8601 string for serializability
export interface LogFilter { ... }

// Store state interfaces
export interface CredentialStoreState { ... }
export interface SignerStoreState { ... }
export interface PeerStoreState { ... }
export interface RelayStoreState { ... }
export interface LogStoreState { ... }
```

---

## Store Index

**Location:** `stores/index.ts`

Barrel export for clean imports:

```typescript
export { useCredentialStore } from './credentialStore';
export { useSignerStore } from './signerStore';
export { usePeerStore } from './peerStore';
export { useRelayStore } from './relayStore';
export { useLogStore, getFilteredLogs, isLogLevelEnabled, isCategoryEnabled } from './logStore';
```

Usage:
```typescript
import { useCredentialStore, useSignerStore } from '@/stores';
```
