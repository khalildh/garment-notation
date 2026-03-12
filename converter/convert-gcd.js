#!/usr/bin/env node
// CLI entry point for GarmentCodeData → GNL conversion
// Usage:
//   node converter/convert-gcd.js                    # convert all examples in examples/garmentcodedata/
//   node converter/convert-gcd.js path/to/file.json  # convert a single file

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve, dirname } from 'node:path';
import { convertGCD } from './garmentcodedata-to-gnl.js';

const __dirname = dirname(new URL(import.meta.url).pathname);
const EXAMPLES_DIR = join(__dirname, 'examples', 'garmentcodedata');
const OUTPUT_DIR = join(__dirname, 'output-gcd');

async function main() {
  const args = process.argv.slice(2);
  await mkdir(OUTPUT_DIR, { recursive: true });

  if (args.length > 0 && !args[0].startsWith('-')) {
    // Convert a single file
    const filePath = resolve(args[0]);
    await convertFile(filePath);
  } else {
    // Convert all examples
    await convertAll();
  }
}

/**
 * Convert all JSON files in examples/garmentcodedata/ to GNL in output-gcd/.
 */
async function convertAll() {
  if (!existsSync(EXAMPLES_DIR)) {
    console.error(`Examples directory not found: ${EXAMPLES_DIR}`);
    console.error('Place GarmentCodeData JSON files in converter/examples/garmentcodedata/');
    process.exit(1);
  }

  const files = (await readdir(EXAMPLES_DIR)).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.error('No JSON files found in converter/examples/garmentcodedata/');
    console.error('Generate examples using the GarmentCode Python library.');
    process.exit(1);
  }

  console.log(`Converting ${files.length} GarmentCodeData templates...\n`);
  let success = 0, fail = 0;

  for (const file of files.sort()) {
    const filePath = join(EXAMPLES_DIR, file);
    try {
      await convertFile(filePath);
      success++;
    } catch (err) {
      console.error(`  FAIL ${file}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${success} converted, ${fail} failed.`);
  console.log(`Output: ${OUTPUT_DIR}/`);
}

/**
 * Convert a single JSON file to GNL.
 */
async function convertFile(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  const json = JSON.parse(raw);

  // Derive template name from filename
  const name = basename(filePath, '.json')
    .replace(/[^a-zA-Z0-9_]/g, '_');

  const gnl = convertGCD(json, name);

  const outPath = join(OUTPUT_DIR, name + '.gnl');
  await writeFile(outPath, gnl);
  console.log(`  ${basename(filePath)} -> ${basename(outPath)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
