import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { LogStoreState, LogEntry, LogLevel, LogCategory, LogFilter } from '@/types';

const DEFAULT_MAX_ENTRIES = 500;

const DEFAULT_FILTER: LogFilter = {
  levels: ['debug', 'info', 'warn', 'error'],
  categories: ['signing', 'relay', 'peer', 'echo'],
};

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  const stringify = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      return input;
    }

    if (seen.has(input as object)) {
      return '[Circular]';
    }
    seen.add(input as object);

    if (Array.isArray(input)) {
      return input.map((item) => stringify(item));
    }

    const obj = input as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = stringify(obj[key]);
    }
    return sorted;
  };

  try {
    return JSON.stringify(stringify(value));
  } catch {
    return String(value);
  }
}

function getEntryKey(entry: Pick<LogEntry, 'level' | 'category' | 'message' | 'data'>): string {
  const dataKey = entry.data ? stableStringify(entry.data) : '';
  return `${entry.level}|${entry.category}|${entry.message}|${dataKey}`;
}

export const useLogStore = create<LogStoreState>()((set, get) => ({
  // State (in-memory only - not persisted)
  entries: [],
  maxEntries: DEFAULT_MAX_ENTRIES,
  filter: DEFAULT_FILTER,
  autoScroll: true,

  // Actions
  addEntry: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    set((state) => {
      const entryKey = getEntryKey(entry);
      const existingIndex = state.entries.findIndex(
        (existing) => getEntryKey(existing) === entryKey
      );

      if (existingIndex >= 0) {
        const existing = state.entries[existingIndex];
        const updatedEntry: LogEntry = {
          ...existing,
          count: (existing.count ?? 1) + 1,
          timestamp: new Date().toISOString(),
        };

        const entries = [...state.entries];
        entries.splice(existingIndex, 1);
        return { entries: [updatedEntry, ...entries] };
      }

      const newEntry: LogEntry = {
        ...entry,
        id: nanoid(),
        timestamp: new Date().toISOString(),
      };

      // Prepend new entry and enforce max limit (rolling buffer)
      let entries = [newEntry, ...state.entries];
      if (entries.length > state.maxEntries) {
        entries = entries.slice(0, state.maxEntries);
      }

      return { entries };
    });
  },

  clearLogs: () => {
    set({ entries: [] });
  },

  setFilter: (filter: Partial<LogFilter>) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },

  setMaxEntries: (max: number) => {
    set((state) => {
      const entries = state.entries.slice(0, max);
      return { maxEntries: max, entries };
    });
  },

  setAutoScroll: (enabled: boolean) => {
    set({ autoScroll: enabled });
  },
}));

/**
 * Get filtered log entries
 */
export function getFilteredLogs(state: LogStoreState): LogEntry[] {
  return state.entries.filter(
    (entry) =>
      state.filter.levels.includes(entry.level) &&
      state.filter.categories.includes(entry.category)
  );
}

/**
 * Helper to check if a log level should be shown
 */
export function isLogLevelEnabled(state: LogStoreState, level: LogLevel): boolean {
  return state.filter.levels.includes(level);
}

/**
 * Helper to check if a log category should be shown
 */
export function isCategoryEnabled(state: LogStoreState, category: LogCategory): boolean {
  return state.filter.categories.includes(category);
}
