/**
 * Crypto polyfill for React Native using expo-crypto.
 * CommonJS version for use in entry point (index.js).
 *
 * IMPORTANT: This unconditionally sets getRandomValues to ensure the expo-crypto
 * implementation is used. React Native may have a crypto object that exists but
 * doesn't have a working getRandomValues, causing errors like:
 * "crypto.getRandomValues must be defined"
 */

const { getRandomValues } = require('expo-crypto');

/**
 * Sets up crypto polyfill on a target object.
 * @param {typeof globalThis} target - The global object to polyfill
 */
function polyfillCrypto(target) {
  if (!target) return;
  if (!target.crypto) {
    target.crypto = {};
  }
  // Always set getRandomValues - don't check if it exists because
  // RN's native crypto object may exist but not work properly
  target.crypto.getRandomValues = getRandomValues;
}

module.exports = { polyfillCrypto };
