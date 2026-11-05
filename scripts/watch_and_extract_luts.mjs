import fs from 'fs';
import path from 'path';
import { extractLookLut } from './extract_official_look_lut.mjs';

const WATCH_DIRS = [
  '/Users/kai/Downloads/Sony_Looks_Batch',
  '/Users/kai/Downloads'
];

const LOOK_CODES = ['ST', 'PT', 'NT', 'VV', 'VV2', 'IN', 'SH', 'FL2', 'FL3', 'BW', 'SE'];
const processed = new Set();

console.log('======================================================');
console.log(' Sony Look Official Batch Auto-Extractor & Watcher');
console.log(' Watching directories for exported JPEGs:');
WATCH_DIRS.forEach(d => console.log('   - ' + d));
console.log('======================================================');

async function checkFile(filePath) {
  const f = path.basename(filePath);
  if (!/\.jpe?g$/i.test(f) || f.includes('7008x4672') || processed.has(filePath)) return;

  for (const code of LOOK_CODES) {
    const reg = new RegExp(`(_|\\b)${code}(\\b|_|\\.)`, 'i');
    if (reg.test(f)) {
      processed.add(filePath);
      console.log(`\n[+] Detected new export: ${f} -> Look: ${code}`);
      // Wait 500ms to ensure file writing is completely flushed
      await new Promise(r => setTimeout(r, 600));
      try {
        await extractLookLut(filePath, code);
        console.log(`[✓] Successfully extracted and updated 3D-LUT for ${code}!\n`);
      } catch (err) {
        console.error(`[!] Extraction error on ${f}:`, err.message);
        processed.delete(filePath);
      }
      break;
    }
  }
}

// Initial scan
for (const dir of WATCH_DIRS) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      checkFile(path.join(dir, f));
    }
  }
}

// File watchers
for (const dir of WATCH_DIRS) {
  if (fs.existsSync(dir)) {
    fs.watch(dir, (eventType, filename) => {
      if (filename) {
        checkFile(path.join(dir, filename));
      }
    });
  }
}

console.log('[*] Ready and listening for exported JPEGs... (Press Ctrl+C to exit)');

