import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, FlatList, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FileText,
  Check,
  CheckSquare,
  Square,
  XCircle,
  AlertTriangle,
  Info,
  Bug,
  ChevronUp,
  ChevronDown,
  Trash2,
  Filter,
  Copy,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { nip19, getEventHash } from 'nostr-tools';
import { Card, Badge, Button, IconButton, GradientBackground, HelpTooltip } from '@/components/ui';
import { useCopyFeedback } from '@/hooks';
import { useLogStore, useCredentialStore } from '@/stores';
import type { LogEntry, LogLevel, LogCategory } from '@/types';

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const LOG_CATEGORIES: LogCategory[] = ['signing', 'relay', 'peer', 'echo', 'system'];

export default function LogsTab() {
  const entries = useLogStore((s) => s.entries);
  const filter = useLogStore((s) => s.filter);
  const autoScroll = useLogStore((s) => s.autoScroll);
  const clearLogs = useLogStore((s) => s.clearLogs);
  const setFilter = useLogStore((s) => s.setFilter);
  const setAutoScroll = useLogStore((s) => s.setAutoScroll);
  const shareDetails = useCredentialStore((s) => s.shareDetails);
  const groupPubkey = shareDetails?.groupPubkey;

  const flatListRef = useRef<FlatList>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Get filtered entries
  const filteredEntries = entries.filter(
    (entry) =>
      filter.levels.includes(entry.level) && filter.categories.includes(entry.category)
  );

  // Auto-scroll to top when new entries arrive
  useEffect(() => {
    if (autoScroll && filteredEntries.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [filteredEntries.length, autoScroll]);

  const toggleLevel = useCallback(
    (level: LogLevel) => {
      const newLevels = filter.levels.includes(level)
        ? filter.levels.filter((l) => l !== level)
        : [...filter.levels, level];
      setFilter({ levels: newLevels.length > 0 ? newLevels : [level] }); // Keep at least one
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [filter.levels, setFilter]
  );

  const toggleCategory = useCallback(
    (category: LogCategory) => {
      const newCategories = filter.categories.includes(category)
        ? filter.categories.filter((c) => c !== category)
        : [...filter.categories, category];
      setFilter({ categories: newCategories.length > 0 ? newCategories : [category] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [filter.categories, setFilter]
  );

  const handleClearLogs = useCallback(() => {
    clearLogs();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [clearLogs]);

  const renderLogEntry: ListRenderItem<LogEntry> = useCallback(
    ({ item }) => (
      <LogEntryItem
        entry={item}
        groupPubkey={groupPubkey}
        expanded={expandedId === item.id}
        onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
      />
    ),
    [expandedId, groupPubkey]
  );

  const keyExtractor = useCallback((item: LogEntry) => item.id, []);

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={[]}>
        {/* Filter Bar */}
        <View className="px-4 pt-2 pb-3 border-b border-gray-700/30 bg-gray-900/80">
          {/* Filter Header */}
          <View className="flex-row items-center gap-1 mb-2">
            <Filter size={12} color="#9ca3af" strokeWidth={2} />
            <Text className="text-xs font-medium text-gray-400">Filters</Text>
            <HelpTooltip
              title="Log Filters"
              content="Filter logs by severity level and category. Click a chip to toggle visibility. At least one filter must be active per row."
              size={12}
            />
          </View>
          {/* Level Filters */}
          <View className="flex-row items-center mb-2">
            <Text className="text-xs text-gray-400 mr-2 w-12">Level</Text>
            <View className="flex-row flex-wrap gap-1">
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
          </View>

          {/* Category Filters */}
          <View className="flex-row items-center">
            <Text className="text-xs text-gray-400 mr-2 w-12">Type</Text>
            <View className="flex-row flex-wrap gap-1">
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
        </View>

        {/* Log List */}
        <FlatList
          ref={flatListRef}
          data={filteredEntries}
          renderItem={renderLogEntry}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            <View className="py-12 items-center">
              <FileText size={32} color="#9ca3af" strokeWidth={1.5} />
              <Text className="text-gray-400 mt-2">No log entries</Text>
              <Text className="text-sm text-gray-500 mt-1">
                Events will appear here as they occur
              </Text>
            </View>
          }
        />

        {/* Bottom Actions */}
        <View className="px-4 py-3 border-t border-gray-700/30 bg-gray-900/80 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => setAutoScroll(!autoScroll)}
              className="flex-row items-center"
            >
              {autoScroll ? (
                <CheckSquare size={18} color="#60a5fa" strokeWidth={2} />
              ) : (
                <Square size={18} color="#9ca3af" strokeWidth={2} />
              )}
              <Text className="text-sm text-gray-400 ml-2">Auto-scroll</Text>
            </Pressable>
            <Text className="text-sm text-gray-400 ml-4">
              {filteredEntries.length} / {entries.length} entries
            </Text>
          </View>
          <IconButton
            icon={<Trash2 size={16} color="#9ca3af" strokeWidth={2} />}
            variant="ghost"
            size="md"
            disabled={entries.length === 0}
            onPress={handleClearLogs}
          />
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

function FilterChip({
  label,
  active,
  variant = 'default',
  onPress,
}: {
  label: string;
  active: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`
        px-2 py-1 rounded
        ${active
          ? variant === 'error'
            ? 'bg-red-900/30'
            : variant === 'warning'
              ? 'bg-yellow-900/30'
              : variant === 'info'
                ? 'bg-blue-900/30'
                : variant === 'success'
                  ? 'bg-green-900/30'
                  : 'bg-blue-900/30'
          : 'bg-gray-800'
        }
      `}
    >
      <Text
        className={`
          text-xs capitalize
          ${active
            ? variant === 'error'
              ? 'text-red-400'
              : variant === 'warning'
                ? 'text-yellow-400'
                : variant === 'info'
                  ? 'text-blue-400'
                  : variant === 'success'
                    ? 'text-green-400'
                    : 'text-blue-400'
            : 'text-gray-400'
          }
        `}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LogEntryItem({
  entry,
  groupPubkey,
  expanded,
  onToggle,
}: {
  entry: LogEntry;
  groupPubkey?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasData = entry.data && Object.keys(entry.data).length > 0;
  const signingSummary = entry.category === 'signing'
    ? getSigningSummary(entry, groupPubkey)
    : null;
  const { copied: dataCopied, copy: copyData } = useCopyFeedback({ duration: 1500 });

  const handleCopyData = useCallback(async () => {
    if (entry.data) {
      await copyData(JSON.stringify(entry.data, null, 2));
    }
  }, [entry.data, copyData]);

  const renderLevelIcon = () => {
    const color = getLevelColor(entry.level);
    const props = { size: 14, color, strokeWidth: 2 };

    switch (entry.level) {
      case 'error':
        return <XCircle {...props} />;
      case 'warn':
        return <AlertTriangle {...props} />;
      case 'info':
        return <Info {...props} />;
      default:
        return <Bug {...props} />;
    }
  };

  // Get category badge variant based on category type
  const getCategoryVariant = () => {
    switch (entry.category) {
      case 'signing':
        return 'orange';
      case 'peer':
        return 'purple';
      case 'relay':
        return 'info';
      case 'echo':
        return 'success';
      case 'system':
      default:
        return 'default';
    }
  };

  return (
    <Pressable onPress={hasData ? onToggle : undefined}>
      <Card padding="sm" className={entry.category === 'signing' ? 'border-orange-500/40' : ''}>
        <View className="flex-row items-start">
          {/* Level Icon */}
          <View className="mr-2 mt-0.5">
            {renderLevelIcon()}
          </View>

          {/* Content */}
          <View className="flex-1">
            {/* Header Row */}
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center">
                <Badge label={entry.category} size="sm" variant={getCategoryVariant()} />
                {hasData && (
                  <View className="ml-1.5">
                    {expanded ? (
                      <ChevronUp size={10} color="#9ca3af" strokeWidth={2} />
                    ) : (
                      <ChevronDown size={10} color="#9ca3af" strokeWidth={2} />
                    )}
                  </View>
                )}
              </View>
              <Text className="text-xs text-gray-400">
                {formatTimestamp(entry.timestamp)}
              </Text>
            </View>

            {signingSummary && (
              <View className="mb-2 p-3 rounded-lg border border-orange-500/30 bg-orange-500/10">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs uppercase tracking-widest text-orange-300">
                    {signingSummary.statusLabel}
                  </Text>
                  <Badge
                    label={signingSummary.badgeLabel}
                    size="sm"
                    variant={signingSummary.badgeVariant}
                  />
                </View>

                {signingSummary.noteContent && (
                  <View className="mt-2">
                    <Text className="text-base text-gray-100">
                      {signingSummary.noteContent}
                    </Text>
                    {signingSummary.noteTruncated && (
                      <Text className="text-xs text-gray-400 mt-1">
                        Note truncated — expand data for full payload
                      </Text>
                    )}
                  </View>
                )}

                {(signingSummary.noteKind !== undefined ||
                  signingSummary.createdAtLabel ||
                  signingSummary.sessionType ||
                  signingSummary.sessionHashCount !== undefined ||
                  signingSummary.sessionHashPreview) && (
                  <View className="flex-row flex-wrap gap-2 mt-2">
                    {signingSummary.noteKind !== undefined && (
                      <MetaPill label={`Kind ${signingSummary.noteKind}`} />
                    )}
                    {signingSummary.createdAtLabel && (
                      <MetaPill label={`Created ${signingSummary.createdAtLabel}`} />
                    )}
                    {signingSummary.sessionType && (
                      <MetaPill label={`Type ${signingSummary.sessionType}`} />
                    )}
                    {signingSummary.sessionHashCount !== undefined && (
                      <MetaPill label={`Hashes ${signingSummary.sessionHashCount}`} />
                    )}
                    {signingSummary.sessionHashPreview && (
                      <MetaPill label={`Hash ${truncateId(signingSummary.sessionHashPreview)}`} />
                    )}
                  </View>
                )}

                {signingSummary.tags.length > 0 && (
                  <View className="flex-row flex-wrap gap-2 mt-2">
                    {signingSummary.tags.map((tag) => (
                      <MetaPill key={tag} label={tag} />
                    ))}
                  </View>
                )}

                {(signingSummary.sessionId || signingSummary.requestId) && (
                  <View className="mt-2">
                    {signingSummary.sessionId && (
                      <Text className="text-[11px] text-gray-400 font-mono">
                        session: {truncateId(signingSummary.sessionId)}
                      </Text>
                    )}
                    {signingSummary.requestId && (
                      <Text className="text-[11px] text-gray-400 font-mono">
                        request: {truncateId(signingSummary.requestId)}
                      </Text>
                    )}
                  </View>
                )}

                {(signingSummary.authorNpub || signingSummary.eventBech32) && (
                  <View className="mt-2">
                    {signingSummary.authorNpub && (
                      <CopyRow label="author" value={signingSummary.authorNpub} />
                    )}
                    {signingSummary.eventBech32 && (
                      <CopyRow
                        label={`event (${signingSummary.eventEncoding ?? 'note'})`}
                        value={signingSummary.eventBech32}
                      />
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Message */}
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-100">{entry.message}</Text>
              {entry.count && entry.count > 1 && (
                <Text className="text-xs text-gray-500 ml-2">x{entry.count}</Text>
              )}
            </View>

            {/* Expanded Data */}
            {expanded && hasData && (
              <View className="mt-2 p-2 bg-gray-800 rounded">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-gray-500">Data</Text>
                  <Pressable onPress={handleCopyData} hitSlop={8}>
                    {dataCopied ? (
                      <Check size={12} color="#4ade80" strokeWidth={2} />
                    ) : (
                      <Copy size={12} color="#9ca3af" strokeWidth={2} />
                    )}
                  </Pressable>
                </View>
                <Text className="text-xs font-mono text-gray-400">
                  {JSON.stringify(entry.data, null, 2)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View className="px-2 py-0.5 rounded-full bg-gray-900/70 border border-gray-700/60">
      <Text className="text-xs text-gray-300">{label}</Text>
    </View>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopyFeedback({ duration: 1500 });
  const handleCopy = useCallback(async (event?: { stopPropagation?: () => void }) => {
    event?.stopPropagation?.();
    await copy(value);
  }, [copy, value]);

  return (
    <Pressable
      onPress={handleCopy}
      className="flex-row items-center justify-between py-1"
    >
      <View className="flex-row items-center flex-1 pr-2">
        <Text className="text-[11px] text-gray-400 font-mono mr-1.5">
          {label}:
        </Text>
        <Text className="text-[11px] text-gray-200 font-mono" numberOfLines={1}>
          {truncateBech32(value)}
        </Text>
      </View>
      {copied ? (
        <Check size={12} color="#4ade80" strokeWidth={2} />
      ) : (
        <Copy size={12} color="#9ca3af" strokeWidth={2} />
      )}
    </Pressable>
  );
}

// Returns Tailwind color hex values for RN components
function getLevelColor(level: LogLevel): string {
  switch (level) {
    case 'error':
      return '#ef4444'; // red-500
    case 'warn':
      return '#f59e0b'; // amber-500
    case 'info':
      return '#3b82f6'; // blue-500
    default:
      return '#9ca3af'; // gray-400
  }
}

function getLevelVariant(level: LogLevel): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (level) {
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'default';
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function truncateId(value: string, front = 8, back = 6): string {
  if (value.length <= front + back + 3) return value;
  return `${value.slice(0, front)}...${value.slice(-back)}`;
}

function truncateBech32(value: string, front = 10, back = 8): string {
  if (value.length <= front + back + 3) return value;
  return `${value.slice(0, front)}...${value.slice(-back)}`;
}

function toNpub(pubkey: string): string | undefined {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return undefined;
  }
}

function toNevent(
  eventId: string,
  author?: string,
  kind?: number
): string | undefined {
  try {
    return nip19.neventEncode({
      id: eventId,
      author,
      kind,
    });
  } catch {
    return undefined;
  }
}

function toNote(eventId: string): string | undefined {
  try {
    return nip19.noteEncode(eventId);
  } catch {
    return undefined;
  }
}

function normalizeNostrPubkey(pubkey: string): string | undefined {
  const trimmed = pubkey.trim().toLowerCase();
  if (/^[0-9a-f]+$/.test(trimmed) === false) return undefined;
  if (trimmed.length === 64) return trimmed;
  if (trimmed.length === 66 && (trimmed.startsWith('02') || trimmed.startsWith('03'))) {
    return trimmed.slice(2);
  }
  return undefined;
}

function getEventId(event: ReturnType<typeof parseNostrEvent>): string | undefined {
  if (!event) return undefined;
  if (typeof event.id === 'string') return event.id;
  if (
    typeof event.pubkey !== 'string' ||
    typeof event.created_at !== 'number' ||
    typeof event.kind !== 'number' ||
    typeof event.content !== 'string'
  ) {
    return undefined;
  }
  const tags = Array.isArray(event.tags) ? event.tags : [];
  try {
    return getEventHash({
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags,
      content: event.content,
    });
  } catch {
    return undefined;
  }
}

type SigningSummary = {
  statusLabel: string;
  badgeLabel: string;
  badgeVariant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'orange';
  noteContent?: string;
  noteTruncated: boolean;
  noteKind?: number;
  authorPubkey?: string;
  authorNpub?: string;
  eventBech32?: string;
  eventEncoding?: 'nevent' | 'note';
  createdAtLabel?: string;
  sessionId?: string;
  requestId?: string;
  sessionType?: string;
  sessionHashCount?: number;
  sessionHashPreview?: string;
  tags: string[];
};

function getSigningSummary(entry: LogEntry, groupPubkey?: string): SigningSummary {
  const status = getSigningStatus(entry.message);
  const data = entry.data ?? {};

  const sessionContent =
    typeof data.sessionContent === 'string' ? data.sessionContent : undefined;
  const noteEvent = extractNostrEventFromEntry(data);
  const noteContent = noteEvent?.content ?? sessionContent;
  const contentPreview = noteContent ? truncateText(noteContent, 280) : null;

  const createdAt =
    noteEvent?.created_at ??
    (typeof data.sessionStamp === 'number' ? data.sessionStamp : undefined);

  const authorPubkey = noteEvent?.pubkey ?? groupPubkey;
  const normalizedAuthorPubkey = authorPubkey ? normalizeNostrPubkey(authorPubkey) : undefined;

  const authorNpub = normalizedAuthorPubkey ? toNpub(normalizedAuthorPubkey) : undefined;
  const eventIdFromEvent = getEventId(noteEvent);
  const eventIdFromHash =
    typeof data.sessionHashPreview === 'string' ? data.sessionHashPreview : undefined;
  const eventId = eventIdFromEvent ?? eventIdFromHash;
  const eventKind =
    noteEvent?.kind ??
    (typeof data.kind === 'number' ? data.kind : undefined);
  const eventBech32 = eventId
    ? toNevent(eventId, normalizedAuthorPubkey, eventKind) ?? toNote(eventId)
    : undefined;
  const eventEncoding = eventBech32?.startsWith('nevent1')
    ? 'nevent'
    : eventBech32?.startsWith('note1')
      ? 'note'
      : undefined;

  return {
    statusLabel: status.label,
    badgeLabel: status.badge,
    badgeVariant: status.variant,
    noteContent: contentPreview?.text,
    noteTruncated: contentPreview?.truncated ?? false,
    noteKind:
      noteEvent?.kind ??
      (typeof data.kind === 'number' ? data.kind : undefined),
    authorPubkey,
    authorNpub,
    eventBech32,
    eventEncoding,
    createdAtLabel: createdAt ? formatEpochSeconds(createdAt) : undefined,
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : undefined,
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    sessionType: typeof data.sessionType === 'string' ? data.sessionType : undefined,
    sessionHashCount:
      typeof data.sessionHashCount === 'number' ? data.sessionHashCount : undefined,
    sessionHashPreview:
      typeof data.sessionHashPreview === 'string' ? data.sessionHashPreview : undefined,
    tags: extractTagLabels(noteEvent?.tags),
  };
}

function getSigningStatus(message: string): {
  label: string;
  badge: string;
  variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'orange';
} {
  const normalized = message.toLowerCase();
  if (normalized.includes('received signing request')) {
    return { label: 'Signing Request', badge: 'request', variant: 'orange' };
  }
  if (normalized.includes('signing request completed') || normalized.includes('finalized')) {
    return { label: 'Signature Complete', badge: 'complete', variant: 'success' };
  }
  if (normalized.includes('responses from peers')) {
    return { label: 'Peer Responses', badge: 'responses', variant: 'info' };
  }
  if (normalized.includes('rejected')) {
    return { label: 'Signing Rejected', badge: 'rejected', variant: 'warning' };
  }
  if (normalized.includes('failed') || normalized.includes('error')) {
    return { label: 'Signing Failed', badge: 'failed', variant: 'error' };
  }
  return { label: 'Signing Event', badge: 'signing', variant: 'orange' };
}

function parseNostrEvent(content: string): {
  kind?: number;
  pubkey?: string;
  created_at?: number;
  content?: string;
  tags?: string[][];
  id?: string;
} | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.kind !== 'number' || typeof parsed.content !== 'string') return null;
    return parsed as {
      kind?: number;
      pubkey?: string;
      created_at?: number;
      content?: string;
      tags?: string[][];
      id?: string;
    };
  } catch {
    return null;
  }
}

function extractNostrEventFromEntry(
  data: Record<string, unknown>
): ReturnType<typeof parseNostrEvent> {
  const sessionContent =
    typeof data.sessionContent === 'string' ? data.sessionContent : undefined;
  const fromSession = sessionContent ? parseNostrEvent(sessionContent) : null;
  if (fromSession) return fromSession;

  const payload = data.payload as { env?: { content?: string } } | undefined;
  const envContent = payload?.env?.content;
  if (typeof envContent === 'string') {
    const fromEnv = parseNostrEvent(envContent);
    if (fromEnv) return fromEnv;
  }

  return null;
}


function extractTagLabels(tags?: string[][]): string[] {
  if (!Array.isArray(tags)) return [];
  const labels = tags
    .filter((tag) => Array.isArray(tag) && tag.length > 1)
    .map((tag) => (tag[0] === 't' ? `#${tag[1]}` : `${tag[0]}:${tag[1]}`));
  return labels.slice(0, 6);
}

function truncateText(text: string, maxLength: number): { text: string; truncated: boolean } {
  if (text.length <= maxLength) return { text, truncated: false };
  return { text: `${text.slice(0, maxLength)}…`, truncated: true };
}

function formatEpochSeconds(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  return date.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
