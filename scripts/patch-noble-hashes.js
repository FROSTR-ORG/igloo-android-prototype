#!/usr/bin/env node
/**
 * Patches @noble/hashes to add ./crypto.js export
 * This fixes Metro's package exports resolution warning
 */
const fs = require('fs');
let pkgPath;
const cryptoJsExport = {
  node: {
    import: './esm/cryptoNode.js',
    default: './cryptoNode.js',
  },
  import: './esm/crypto.js',
  default: './crypto.js',
};

function deriveRootExport(pkg) {
  if (typeof pkg.module === 'string' && typeof pkg.main === 'string') {
    return {
      import: pkg.module,
      require: pkg.main,
      default: pkg.main,
    };
  }
  if (typeof pkg.module === 'string') {
    return {
      import: pkg.module,
      default: pkg.module,
    };
  }
  if (typeof pkg.main === 'string') {
    return pkg.main;
  }
  return './index.js';
}

function normalizeExports(pkg) {
  const exportsField = pkg.exports;
  const isObjectExport = exportsField && typeof exportsField === 'object' && !Array.isArray(exportsField);
  const hasSubpathKeys = isObjectExport && Object.keys(exportsField).some((key) => key.startsWith('.'));

  if (hasSubpathKeys) {
    return exportsField;
  }

  const rootExport = exportsField ?? deriveRootExport(pkg);
  return { '.': rootExport };
}

try {
  pkgPath = require.resolve('@noble/hashes/package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.exports = normalizeExports(pkg);

  // Validate exports field after normalization
  if (!pkg.exports || typeof pkg.exports !== 'object') {
    throw new Error('Exports field is invalid after normalization');
  }

  // Check if already patched
  if (pkg.exports['./crypto.js']) {
    console.log('[@noble/hashes] Already patched');
    process.exit(0);
  }

  // Add ./crypto.js export (mirror ./crypto when available).
  pkg.exports['./crypto.js'] = pkg.exports['./crypto'] || cryptoJsExport;

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[@noble/hashes] Patched successfully - added ./crypto.js export');
} catch (err) {
  console.error('[@noble/hashes] Patch failed:', err.message);
  process.exit(1);
}
