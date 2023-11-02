#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function main() {
  try {
    const cacheDir = process.argv[2];
    const telemetryFile = process.argv[3];
    const root = dirname(dirname(fileURLToPath(import.meta.url)));
    const { Uploader } = await import(join(root, 'lib', 'uploader.js'));
    const pjsonContents = await readFile(join(root, 'package.json'), 'utf-8');
    const { version } = JSON.parse(pjsonContents);
    await Uploader.upload(cacheDir, telemetryFile, version);
  } catch (err) {
    // We are in a detached process anyways, so nothing will be shown to the user but useful when debugging.
    process.emitWarning(err);
  }
}

await main();
