# Signer Features Implementation

## Overview

The main app consists of four tabs:
1. **Signer** - Start/stop signer, view status and stats
2. **Peers** - View peers, ping for status, manage policies
3. **Logs** - Verbose event log with filtering
4. **Settings** - Relay configuration, credential info, danger zone

---

## Tab Navigation

**Location:** `app/(tabs)/_layout.tsx`

```typescript
<Tabs>
  <Tabs.Screen
    name="signer"
    options={{
      title: 'Signer',
      tabBarIcon: ({ color }) => <TabBarIcon name="key" color={color} />,
    }}
  />
  <Tabs.Screen
    name="sessions"  // Actually the Peers tab
    options={{
      title: 'Peers',
      tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
    }}
  />
  <Tabs.Screen
    name="logs"
    options={{
      title: 'Logs',
      tabBarIcon: ({ color }) => <TabBarIcon name="list-alt" color={color} />,
    }}
  />
  <Tabs.Screen
    name="settings"
    options={{
      title: 'Settings',
      tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
    }}
  />
</Tabs>
```

---

## Signer Tab

**Location:** `app/(tabs)/signer.tsx`

### UI Components

**Status Card:**
```typescript
<Card variant="elevated">
  <StatusIndicator status={status} />  {/* Color-coded circle */}
  <Text>{getStatusText(status)}</Text>
  {lastError && <Text className="text-red-500">{lastError}</Text>}
  <Button
    title={isRunning ? 'Stop Signer' : 'Start Signer'}
    variant={isRunning ? 'danger' : 'primary'}
    loading={isConnecting}
    onPress={handleToggle}
  />
</Card>
```

**Share Info Card:**
```typescript
{shareDetails && (
  <Card>
    <InfoItem label="Share Index" value={`#${shareDetails.idx}`} />
    <InfoItem
      label="Threshold"
      value={`${shareDetails.threshold}-of-${shareDetails.totalMembers}`}
    />
  </Card>
)}
```

**Session Stats Card:**
```typescript
<Card>
  <InfoItem label="Uptime" value={formatUptime(uptime)} />
  <InfoItem
    label="Requests"
    value={`${signingRequestsCompleted}/${signingRequestsReceived}`}
  />
  <InfoItem label="Relays" value={connectedRelays.length} />
</Card>
```

**Recent Activity:**
```typescript
<Card>
  {recentRequests.length === 0 ? (
    <Text>Waiting for requests...</Text>
  ) : (
    recentRequests.slice(0, 5).map((request) => (
      <View key={request.id}>
        <Text>{truncatePubkey(request.pubkey)}</Text>
        <Badge
          label={request.status}
          variant={request.status === 'completed' ? 'success' : 'error'}
        />
      </View>
    ))
  )}
</Card>
```

### Status Indicator

```typescript
function StatusIndicator({ status }: { status: SignerStatus }) {
  const getStatusColor = () => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'running': return 'check-circle';
      case 'connecting': return 'spinner';
      case 'error': return 'exclamation-circle';
      default: return 'power-off';
    }
  };

  return (
    <View className={`w-20 h-20 rounded-full ${getStatusColor()}`}>
      <FontAwesome name={getStatusIcon()} size={36} color="white" />
    </View>
  );
}
```

### Toggle Logic

```typescript
const handleToggle = useCallback(async () => {
  try {
    if (isRunning) {
      await stop();
    } else {
      await start();
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert('Error', error.message);
  }
}, [isRunning, start, stop]);
```

### Uptime Tracking

```typescript
const [uptime, setUptime] = useState(0);

useEffect(() => {
  if (!isRunning) {
    setUptime(0);
    return;
  }

  const interval = setInterval(() => {
    setUptime(getUptime());
  }, 1000);

  return () => clearInterval(interval);
}, [isRunning, getUptime]);

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
```

---

## Peers Tab

**Location:** `app/(tabs)/sessions.tsx`

### Peer List

```typescript
export default function PeersTab() {
  const {
    peers,
    selfPubkey,
    lastPingTime,
    onlineCount,
    totalCount,
    pingPeers,
    setPeerPolicy,
  } = usePeers();
  const { isRunning } = useSigner();

  return (
    <SafeAreaView>
      {/* Header */}
      <View>
        <Text>{onlineCount} of {totalCount} peers online</Text>
        {lastPingTime && <Text>Last ping: {formatTime(lastPingTime)}</Text>}
      </View>

      {/* Ping Button */}
      <Button
        title={isPinging ? 'Pinging...' : 'Ping All'}
        disabled={!isRunning || isPinging}
        onPress={handlePing}
      />

      {/* Peer List */}
      <FlatList
        data={peers}
        renderItem={({ item }) => (
          <PeerCard
            peer={item}
            isSelf={item.pubkey === selfPubkey}
            disabled={!isRunning}
            onPolicyChange={(policy) => setPeerPolicy(item.pubkey, policy)}
          />
        )}
      />
    </SafeAreaView>
  );
}
```

### Peer Card Component

```typescript
function PeerCard({ peer, isSelf, disabled, onPolicyChange }) {
  return (
    <Card>
      <View className="flex-row items-center">
        {/* Status indicator */}
        <View className={`w-3 h-3 rounded-full ${
          peer.status === 'online' ? 'bg-green-500' :
          peer.status === 'offline' ? 'bg-red-500' : 'bg-gray-400'
        }`} />

        {/* Pubkey */}
        <Text>{truncatePubkey(peer.pubkey)}</Text>
        {isSelf && <Badge label="You" size="sm" />}

        {/* Latency */}
        {peer.latency && <Text>{peer.latency}ms</Text>}
      </View>

      {/* Policy toggles (only for non-self peers) */}
      {!isSelf && (
        <View>
          <Switch
            label="Allow Send"
            value={peer.allowSend}
            disabled={disabled}
            onValueChange={(v) => onPolicyChange({ allowSend: v })}
          />
          <Switch
            label="Allow Receive"
            value={peer.allowReceive}
            disabled={disabled}
            onValueChange={(v) => onPolicyChange({ allowReceive: v })}
          />
        </View>
      )}
    </Card>
  );
}
```

### Ping Handler

```typescript
const [isPinging, setIsPinging] = useState(false);

const handlePing = useCallback(async () => {
  setIsPinging(true);
  try {
    await pingPeers(5000);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    Alert.alert('Ping Failed', error.message);
  } finally {
    setIsPinging(false);
  }
}, [pingPeers]);
```

---

## Logs Tab

**Location:** `app/(tabs)/logs.tsx`

### Filter Bar

```typescript
const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const LOG_CATEGORIES: LogCategory[] = ['signing', 'relay', 'peer', 'echo', 'system'];

<View>
  {/* Level Filters */}
  <View className="flex-row">
    <Text>Level</Text>
    {LOG_LEVELS.map((level) => (
      <FilterChip
        key={level}
        label={level}
        active={filter.levels.includes(level)}
        variant={getLevelVariant(level)}
        onPress={() => toggleLevel(level)}
      />
    ))}
  </View>

  {/* Category Filters */}
  <View className="flex-row">
    <Text>Type</Text>
    {LOG_CATEGORIES.map((category) => (
      <FilterChip
        key={category}
        label={category}
        active={filter.categories.includes(category)}
        onPress={() => toggleCategory(category)}
      />
    ))}
  </View>
</View>
```

### Log Entry Item

```typescript
function LogEntryItem({ entry, expanded, onToggle }) {
  const hasData = entry.data && Object.keys(entry.data).length > 0;

  return (
    <Pressable onPress={hasData ? onToggle : undefined}>
      <Card padding="sm">
        {/* Level icon */}
        <FontAwesome
          name={getLevelIcon(entry.level)}
          color={getLevelColor(entry.level)}
        />

        {/* Header */}
        <Badge label={entry.category} size="sm" />
        {hasData && <FontAwesome name={expanded ? 'chevron-up' : 'chevron-down'} />}
        <Text>{formatTimestamp(entry.timestamp)}</Text>

        {/* Message */}
        <Text>{entry.message}</Text>

        {/* Expanded data */}
        {expanded && hasData && (
          <View className="bg-gray-50 rounded">
            <Text className="font-mono">
              {JSON.stringify(entry.data, null, 2)}
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
}
```

### Auto-Scroll & Clear

```typescript
// Auto-scroll to top when new entries arrive
useEffect(() => {
  if (autoScroll && filteredEntries.length > 0) {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }
}, [filteredEntries.length, autoScroll]);

// Bottom actions bar
<View>
  <Pressable onPress={() => setAutoScroll(!autoScroll)}>
    <FontAwesome name={autoScroll ? 'check-square-o' : 'square-o'} />
    <Text>Auto-scroll</Text>
  </Pressable>
  <Text>{filteredEntries.length} / {entries.length} entries</Text>
  <Button title="Clear" onPress={handleClearLogs} />
</View>
```

---

## Settings Tab

**Location:** `app/(tabs)/settings.tsx`

### Relay Configuration

```typescript
const relays = useRelayStore((s) => s.relays);
const addRelay = useRelayStore((s) => s.addRelay);
const removeRelay = useRelayStore((s) => s.removeRelay);
const resetToDefaults = useRelayStore((s) => s.resetToDefaults);

// Current relays list
<Card>
  {relays.map((relay, index) => (
    <View key={relay}>
      <FontAwesome name="server" />
      <Text>{relay}</Text>
      <Pressable onPress={() => handleRemoveRelay(relay)}>
        <FontAwesome name="times" color="#ef4444" />
      </Pressable>
    </View>
  ))}
</Card>

// Add relay input
<Card>
  <View className="flex-row items-start">
    <Input
      className="flex-1 mr-2"
      placeholder="wss://relay.example.com"
      value={newRelay}
      onChangeText={(text) => {
        setNewRelay(text);
        setRelayError(undefined);
      }}
      error={relayError}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="url"
    />
    <Button title="Add" onPress={handleAddRelay} />
  </View>
</Card>

// Reset button
<Pressable onPress={handleResetRelays}>
  <Text>Reset to Default Relays</Text>
</Pressable>
```

### Relay URL Validation Flow

Validation happens in two stages:

1. **UI Validation (settings.tsx)** - Quick feedback for the user:
   - URL must be parseable
   - Protocol must be `ws:` or `wss:`
   - Host must not be empty
   - Accepts localhost and IP addresses for development

2. **Store Normalization (relayStore.ts)** - Actual storage:
   - Adds `wss://` if no protocol specified
   - Upgrades `ws://` to `wss://` (security)
   - Removes trailing slashes
   - Validates final URL has `wss:` protocol
   - Returns `null` for invalid URLs (silently rejected)

**Note:** The store always upgrades to `wss://` for security. Localhost relays (`ws://localhost:7777`) will be converted to `wss://localhost:7777`, which may fail if the local relay doesn't support SSL. This is intentional - production relays should always use SSL.

### Credential Info (Read-Only)

```typescript
{shareDetails && (
  <Card>
    <InfoRow label="Share Index" value={`#${shareDetails.idx}`} />
    <InfoRow
      label="Threshold"
      value={`${shareDetails.threshold}-of-${shareDetails.totalMembers}`}
      isLast={!shareDetails.groupPubkey}
    />
    {shareDetails.groupPubkey && (
      <Pressable onPress={handleCopyGroupPubkey}>
        <InfoRow
          label="Group Pubkey"
          value={truncatePubkey(shareDetails.groupPubkey)}
          copyable
          isLast
        />
      </Pressable>
    )}
  </Card>
)}
```

### Danger Zone

```typescript
<Card className="border-red-200">
  <Text>
    Clearing your credentials will remove all stored data and return you to
    the onboarding screen. Make sure you have a backup.
  </Text>
  <Button
    title="Clear All Credentials"
    variant="danger"
    onPress={handleClearCredentials}
  />
</Card>

const handleClearCredentials = useCallback(async () => {
  Alert.alert(
    'Clear Credentials',
    'This action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          if (isRunning) await stop();
          await deleteCredentials();
          router.replace('/onboarding');
        },
      },
    ]
  );
}, [isRunning, stop, deleteCredentials]);
```

### App Version Display

Versions are read dynamically from `package.json` to stay in sync:

```typescript
import pkg from '../../package.json';

// Extract igloo-core version, stripping semver prefix (^ or ~)
const IGLOO_CORE_VERSION = pkg.dependencies['@frostr/igloo-core']?.replace(/^[\^~]/, '') ?? 'unknown';

// In the About section
<Card>
  <InfoRow label="App Version" value={pkg.version} />
  <InfoRow label="igloo-core" value={IGLOO_CORE_VERSION} isLast />
</Card>
```

**Note:** The regex `/^[\^~]/` strips the leading `^` or `~` from semver ranges (e.g., `^0.2.4` becomes `0.2.4`).

---

## UI Components

**Location:** `components/ui/`

### Button

```typescript
interface ButtonProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
}
```

### Card

```typescript
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}
```

### Input

```typescript
interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  secureTextEntry?: boolean;
}
```

### Badge

```typescript
interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}
```

### Switch

```typescript
interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}
```

---

## Haptic Feedback

Used throughout for tactile feedback:

```typescript
import * as Haptics from 'expo-haptics';

// Success operations
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Error operations
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

// Light interactions (toggles, pastes)
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
```

---

## Screen Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Tab Bar                              │
├───────────┬───────────┬───────────┬─────────────────────────┤
│  Signer   │   Peers   │   Logs    │        Settings         │
├───────────┴───────────┴───────────┴─────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ Start/Stop  │    │  Ping All   │    │ Filter Bar  │      │
│  │   Button    │    │   Button    │    │             │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Status    │    │  Peer List  │    │  Log List   │      │
│  │    Card     │    │  + Policies │    │ (FlatList)  │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                                                             │
│  ┌─────────────┐                                            │
│  │   Share     │                       ┌─────────────┐      │
│  │   Info      │                       │   Relays    │      │
│  └─────────────┘                       │   Config    │      │
│                                        └─────────────┘      │
│  ┌─────────────┐                                            │
│  │  Session    │                       ┌─────────────┐      │
│  │   Stats     │                       │   Danger    │      │
│  └─────────────┘                       │    Zone     │      │
│                                        └─────────────┘      │
│  ┌─────────────┐                                            │
│  │  Recent     │                                            │
│  │  Activity   │                                            │
│  └─────────────┘                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
