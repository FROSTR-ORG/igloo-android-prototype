/**
 * Nostr SimplePool shim for React Native.
 *
 * This patches the nostr-tools SimplePool to fix a relay compatibility issue
 * where some relays reject filter arrays with a single element.
 *
 * Error: "ERROR: bad req: provided filter is not an object"
 *
 * The fix: When subscribeMany is called with a single-element filter array,
 * unwrap it and pass the filter object directly instead of the array.
 *
 * This matches the behavior in igloo-desktop/server and igloo-web.
 */
import { SimplePool } from 'nostr-tools';

// Track if we've already applied the patch
const PATCH_FLAG = '__iglooSubscribeFixApplied';

/**
 * Apply the SimplePool subscription fix.
 * This is called automatically when the module is imported.
 */
function applyNostrShim(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = SimplePool.prototype as any;

  // Only apply once
  if (proto[PATCH_FLAG]) {
    return;
  }

  const originalSubscribeMany = proto.subscribeMany;

  proto.subscribeMany = function (
    relays: string[],
    filters: unknown,
    params: unknown
  ) {
    try {
      // If filters is an array with exactly one element that is an object (not an array),
      // unwrap it and pass the object directly to avoid the "filter is not an object" error
      if (
        Array.isArray(filters) &&
        filters.length === 1 &&
        typeof filters[0] === 'object' &&
        filters[0] !== null &&
        !Array.isArray(filters[0])
      ) {
        return originalSubscribeMany.call(this, relays, filters[0], params);
      }
    } catch (error) {
      console.warn('[nostr-shim] Error in subscribeMany wrapper:', error);
    }

    // For all other cases, call the original method unchanged
    return originalSubscribeMany.call(this, relays, filters, params);
  };

  // Mark as applied
  proto[PATCH_FLAG] = true;

  console.log('[nostr-shim] Applied SimplePool subscribeMany fix');
}

// Auto-apply the shim when this module is imported
applyNostrShim();
