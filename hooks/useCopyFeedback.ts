import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

// Type declarations for timer functions in React Native
declare const setTimeout: typeof globalThis.setTimeout;
declare const clearTimeout: typeof globalThis.clearTimeout;

interface UseCopyFeedbackOptions {
  /** Duration to show the copied state (in ms). Default: 2000 */
  duration?: number;
  /** Whether to trigger haptic feedback. Default: true */
  haptic?: boolean;
}

interface UseCopyFeedbackReturn {
  /** Whether the content was recently copied */
  copied: boolean;
  /** Function to copy text to clipboard */
  copy: (text: string) => Promise<void>;
  /** Manually reset the copied state */
  reset: () => void;
}

/**
 * Hook for copying text with visual feedback.
 * Returns a copied state that auto-resets after a duration.
 * Use this to show Copy -> Check icon animations.
 *
 * @example
 * const { copied, copy } = useCopyFeedback();
 *
 * <IconButton
 *   icon={copied ? <Check size={14} /> : <Copy size={14} />}
 *   onPress={() => copy(text)}
 * />
 */
export function useCopyFeedback(options: UseCopyFeedbackOptions = {}): UseCopyFeedbackReturn {
  const { duration = 2000, haptic = true } = options;
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCopied(false);
  }, []);

  const copy = useCallback(async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);

      if (haptic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setCopied(true);

      // Auto-reset after duration
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, duration);
    } catch (error) {
      console.error('[useCopyFeedback] Failed to copy:', error);
      if (haptic) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [duration, haptic]);

  // Cleanup timeout on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return { copied, copy, reset };
}

/**
 * Hook for managing multiple copy states (e.g., for a list of items).
 * Each key tracks its own copied state independently.
 *
 * @example
 * const { getCopied, copy } = useMultiCopyFeedback();
 *
 * {items.map((item) => (
 *   <IconButton
 *     icon={getCopied(item.id) ? <Check /> : <Copy />}
 *     onPress={() => copy(item.id, item.value)}
 *   />
 * ))}
 */
export function useMultiCopyFeedback(options: UseCopyFeedbackOptions = {}) {
  const { duration = 2000, haptic = true } = options;
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const getCopied = useCallback((key: string) => copiedKeys.has(key), [copiedKeys]);

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);

      if (haptic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Clear existing timeout for this key
      const existingTimeout = timeoutsRef.current.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      setCopiedKeys((prev) => new Set(prev).add(key));

      // Auto-reset after duration
      const timeout = setTimeout(() => {
        setCopiedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        timeoutsRef.current.delete(key);
      }, duration);

      timeoutsRef.current.set(key, timeout);
    } catch (error) {
      console.error('[useMultiCopyFeedback] Failed to copy:', error);
      if (haptic) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [duration, haptic]);

  const reset = useCallback((key?: string) => {
    if (key) {
      const timeout = timeoutsRef.current.get(key);
      if (timeout) {
        clearTimeout(timeout);
        timeoutsRef.current.delete(key);
      }
      setCopiedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      // Reset all
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
      setCopiedKeys(new Set());
    }
  }, []);

  // Cleanup all timeouts on unmount to prevent state updates after unmount
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  return { getCopied, copy, reset };
}
