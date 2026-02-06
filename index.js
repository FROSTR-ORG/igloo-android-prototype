/**
 * Custom entry point for Igloo iOS.
 *
 * CRITICAL: This file sets up the crypto polyfill BEFORE any other modules load.
 * The @frostr/bifrost library bundles @noble/hashes which captures crypto.getRandomValues
 * at module evaluation time. ES module imports are hoisted, so polyfills imported
 * via `import` statements run too late.
 *
 * By using require() in a CommonJS entry point, we ensure the polyfill executes
 * synchronously before expo-router and any crypto-dependent libraries are loaded.
 */

// MUST be first - set up crypto polyfill before anything else loads
const { polyfillCrypto } = require('./polyfills/crypto');

// Apply to all possible global scopes
polyfillCrypto(global);
polyfillCrypto(globalThis);
if (typeof window !== 'undefined') {
  polyfillCrypto(window);
}

// Now load the actual app entry point
require('expo-router/entry');
