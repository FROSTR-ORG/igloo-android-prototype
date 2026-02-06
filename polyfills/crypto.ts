/**
 * Crypto polyfill for React Native using expo-crypto.
 *
 * IMPORTANT: ES module imports are hoisted and cannot guarantee execution order.
 * This polyfill is loaded via require() from index.js to ensure getRandomValues
 * is set before any crypto-dependent code (like @noble/hashes) is evaluated.
 *
 * Why this is needed: React Native may have a crypto object that exists but
 * doesn't have a working getRandomValues, causing errors like:
 * "crypto.getRandomValues must be defined"
 *
 * @see index.js - the CommonJS entry point that require()s this module
 */
import { getRandomValues } from 'expo-crypto';

/** Set up crypto.getRandomValues polyfill on a target global object */
export function polyfillCrypto(target: typeof globalThis) {
  if (!target.crypto) {
    // @ts-expect-error - Polyfilling crypto object
    target.crypto = {};
  }
  // Always set getRandomValues - don't check if it exists because
  // RN's native crypto object may exist but not work properly
  // @ts-expect-error - Polyfilling getRandomValues
  target.crypto.getRandomValues = getRandomValues;
}

// Polyfill on all possible global objects
if (typeof global !== 'undefined') {
  polyfillCrypto(global as typeof globalThis);
}
if (typeof globalThis !== 'undefined') {
  polyfillCrypto(globalThis);
}
