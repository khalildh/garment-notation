#!/usr/bin/env node
// CLI entry point for Korosteleva → GNL conversion
// Usage:
//   node converter/convert.js                    # fetch + convert all 23 templates
//   node converter/convert.js path/to/file.json  # convert a single file

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve, dirname } from 'node:path';
import { convert } from './korosteleva-to-gnl.js';

const __dirname = dirname(new URL(import.meta.url).pathname);
const TEMPLATES_DIR = join(__dirname, 'templates');
const OUTPUT_DIR = join(__dirname, 'output');

// GitHub raw content base for the Korosteleva dataset
const GITHUB_API = 'https://api.github.com/repos/maria-korosteleva/Garment-Pattern-Generator/contents/data_generation/Patterns';

// Known template subdirectories and files in the dataset
// Note: "basic tee" directory has a space in the name
const TEMPLATE_PATHS = [
  // Skirts (5)
  'skirts/skirt_2_panels.json',
  'skirts/skirt_2_panels_smaller_front.json',
  'skirts/skirt_4_panels.json',
  'skirts/skirt_8_panels.json',
  'skirts/skirt_waistband.json',
  // Pants (3, skip TA_pose variants)
  'pants/pants_straight_sides.json',
  'pants/pants_flare.json',
  'pants/wb_pants_straight.json',
  // Basic tee (7) — note the space in "basic tee"
  'basic tee/tee.json',
  'basic tee/tee_hood.json',
  'basic tee/tee_sleeveless.json',
  'basic tee/jacket.json',
  'basic tee/jacket_hood.json',
  'basic tee/jacket_hood_sleeveless.json',
  'basic tee/jacket_sleeveless.json',
  // Combos (6)
  'combos/dress.json',
  'combos/dress_sleeveless.json',
  'combos/jumpsuit.json',
  'combos/jumpsuit_sleeveless.json',
  'combos/wb_dress_sleeveless.json',
  'combos/wb_jumpsuit_sleeveless.json',
];

async function main() {
  const args = process.argv.slice(2);
  await mkdir(OUTPUT_DIR, { recursive: true });

  if (args.length > 0 && !args[0].startsWith('-')) {
    // Convert a single file
    const filePath = resolve(args[0]);
    await convertFile(filePath);
  } else {
    // Fetch and convert all templates
    await fetchTemplates();
    await convertAll();
  }
}

/**
 * Fetch all templates from GitHub, caching in templates/.
 */
async function fetchTemplates() {
  await mkdir(TEMPLATES_DIR, { recursive: true });

  // Check if we already have templates
  const existing = existsSync(TEMPLATES_DIR) ? await readdir(TEMPLATES_DIR) : [];
  if (existing.filter(f => f.endsWith('.json')).length >= 20) {
    console.log(`Using ${existing.length} cached templates in ${TEMPLATES_DIR}`);
    return;
  }

  console.log('Fetching templates from GitHub...');

  for (const relPath of TEMPLATE_PATHS) {
    const url = `https://raw.githubusercontent.com/maria-korosteleva/Garment-Pattern-Generator/master/data_generation/Patterns/${relPath}`;
    // Use a flat filename: pants_straight_sides.json, combos_dress.json, etc.
    const flatName = relPath.replace(/\//g, '_');
    const destPath = join(TEMPLATES_DIR, flatName);

    if (existsSync(destPath)) {
      continue;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  SKIP ${relPath} (${res.status})`);
        continue;
      }
      const text = await res.text();
      // Validate JSON
      JSON.parse(text);
      await writeFile(destPath, text);
      console.log(`  OK   ${flatName}`);
    } catch (err) {
      console.warn(`  FAIL ${relPath}: ${err.message}`);
    }
  }

  console.log('Done fetching templates.\n');
}

/**
 * Convert all JSON files in templates/ to GNL in output/.
 */
async function convertAll() {
  const files = (await readdir(TEMPLATES_DIR)).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.error('No template files found. Run without arguments to fetch from GitHub.');
    process.exit(1);
  }

  console.log(`Converting ${files.length} templates...\n`);
  let success = 0, fail = 0;

  for (const file of files.sort()) {
    const filePath = join(TEMPLATES_DIR, file);
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

  const gnl = convert(json, name);

  const outPath = join(OUTPUT_DIR, name + '.gnl');
  await writeFile(outPath, gnl);
  console.log(`  ${basename(filePath)} -> ${basename(outPath)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
