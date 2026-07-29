#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]?.replace(/^--/, '');
    const value = argv[index + 1];
    if (!key || !value) throw new Error(`Invalid argument near ${argv[index] ?? '<end>'}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function loadPackage(name) {
  const require = createRequire(import.meta.url);
  try {
    return require(name);
  } catch (firstError) {
    const root = process.env.CODEX_WORKSPACE_NODE_MODULES;
    if (!root) throw new Error(`Cannot load ${name}. Set CODEX_WORKSPACE_NODE_MODULES.`);
    try {
      return require(path.join(root, name));
    } catch {
      throw firstError;
    }
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args.before || !args.after || !args.diff) {
  console.error('Usage: compare_screenshots.mjs --before before.png --after after.png --diff diff.png [--threshold 0.1]');
  process.exit(2);
}

const { PNG } = loadPackage('pngjs');
const pixelmatchModule = loadPackage('pixelmatch');
const pixelmatch = pixelmatchModule.default ?? pixelmatchModule;
const before = PNG.sync.read(fs.readFileSync(args.before));
const after = PNG.sync.read(fs.readFileSync(args.after));
if (before.width !== after.width || before.height !== after.height) {
  throw new Error(`Image dimensions differ: ${before.width}x${before.height} vs ${after.width}x${after.height}`);
}

const diff = new PNG({ width: before.width, height: before.height });
const mismatchedPixels = pixelmatch(before.data, after.data, diff.data, before.width, before.height, {
  threshold: Number(args.threshold ?? 0.1),
  includeAA: false,
});
fs.mkdirSync(path.dirname(path.resolve(args.diff)), { recursive: true });
fs.writeFileSync(args.diff, PNG.sync.write(diff));

const totalPixels = before.width * before.height;
console.log(JSON.stringify({
  before: path.resolve(args.before),
  after: path.resolve(args.after),
  diff: path.resolve(args.diff),
  width: before.width,
  height: before.height,
  mismatchedPixels,
  mismatchRatio: mismatchedPixels / totalPixels,
  mismatchPercent: (mismatchedPixels / totalPixels) * 100,
}, null, 2));
