#!/usr/bin/env node
/**
 * Patches @noble/hashes to add ./crypto.js export
 * This fixes Metro's package exports resolution warning
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'node_modules', '@noble', 'hashes', 'package.json');

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Check if already patched
  if (pkg.exports['./crypto.js']) {
    console.log('[@noble/hashes] Already patched');
    process.exit(0);
  }

  // Add ./crypto.js export (mirrors ./crypto)
  pkg.exports['./crypto.js'] = {
    node: {
      import: './esm/cryptoNode.js',
      default: './cryptoNode.js'
    },
    import: './esm/crypto.js',
    default: './crypto.js'
  };

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[@noble/hashes] Patched successfully - added ./crypto.js export');
} catch (err) {
  console.error('[@noble/hashes] Patch failed:', err.message);
  // Don't fail the install
  process.exit(0);
}
