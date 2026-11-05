import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const LOOK_NAMES = {
  ST: 'Standard',
  PT: 'Portrait',
  NT: 'Neutral',
  VV: 'Vivid',
  VV2: 'Vivid 2',
  FL: 'Film',
  FL2: 'Film 2 (Warm Vintage)',
  FL3: 'Film 3 (Clear Cinema)',
  IN: 'Instant / Soft High Key',
  SH: 'Soft High Key',
  BW: 'Black & White',
  SE: 'Sepia'
};

/**
 * Extracts a 33x33x33 3D-LUT from an official Edit.app JPEG export and FlashRaw demosaiced RAW.
 * @param {string} officialJpgPath - Path to the official JPEG exported from Sony Imaging Edge Edit
 * @param {string} lookCode - Short code (ST, PT, NT, VV, VV2, FL, IN, SH, BW, SE, FL2, FL3)
 */
export async function extractLookLut(officialJpgPath, lookCode) {
  lookCode = lookCode.toUpperCase();
  const lookFullName = LOOK_NAMES[lookCode] || lookCode;

  console.log(`\n======================================================`);
  console.log(`[LUT Extractor] Processing Look: ${lookCode} (${lookFullName})`);
  console.log(`[LUT Extractor] Reference Image: ${officialJpgPath}`);
  console.log(`======================================================`);

  if (!fs.existsSync(officialJpgPath)) {
    throw new Error(`Official JPEG not found at: ${officialJpgPath}`);
  }

  // 1. Decode official JPEG to raw RGB binary using python3 PIL
  const tempBin = `/tmp/official_${lookCode.toLowerCase()}_rgb.bin`;
  console.log(`Converting reference JPEG to raw RGB binary via Python PIL...`);
  const pyScript = `from PIL import Image; im = Image.open("${officialJpgPath}").convert("RGB"); open("${tempBin}", "wb").write(im.tobytes())`;
  execSync(`python3 -c '${pyScript}'`);

  const outBuf = fs.readFileSync(tempBin);

  // 2. Load input FlashRaw decoded 33MP RGBA binary
  const inBinPath = '/tmp/flashraw_full.bin';
  if (!fs.existsSync(inBinPath)) {
    throw new Error(`FlashRaw base binary not found at ${inBinPath}. Please run flashraw decode on DSC01132.ARW first.`);
  }
  const inBuf = fs.readFileSync(inBinPath);

  const width = 7008;
  const height = 4672;
  const totalPixels = width * height;
  console.log(`Loaded FlashRaw buffer (${inBuf.length} bytes) and Target RGB (${outBuf.length} bytes).`);
  console.log(`Processing ${totalPixels.toLocaleString()} pixels (${width}x${height})...`);

  // 3. Initialize 33x33x33 LUT splatting accumulators
  const LUT_SIZE = 33;
  const numEntries = LUT_SIZE * LUT_SIZE * LUT_SIZE;
  const sumR = new Float64Array(numEntries);
  const sumG = new Float64Array(numEntries);
  const sumB = new Float64Array(numEntries);
  const weights = new Float64Array(numEntries);

  const scale = (LUT_SIZE - 1) / 255.0;
  const step = 2; // Sample approx 8.2 million pixels for speed & sub-pixel density
  let sampleCount = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const inIdx = (y * width + x) * 4;
      const outIdx = (y * width + x) * 3;

      const rin = inBuf[inIdx];
      const gin = inBuf[inIdx + 1];
      const bin = inBuf[inIdx + 2];

      const rout = outBuf[outIdx] / 255.0;
      const gout = outBuf[outIdx + 1] / 255.0;
      const bout = outBuf[outIdx + 2] / 255.0;

      const rf = rin * scale;
      const gf = gin * scale;
      const bf = bin * scale;

      const r0 = Math.floor(rf);
      const r1 = Math.min(r0 + 1, LUT_SIZE - 1);
      const dr = rf - r0;

      const g0 = Math.floor(gf);
      const g1 = Math.min(g0 + 1, LUT_SIZE - 1);
      const dg = gf - g0;

      const b0 = Math.floor(bf);
      const b1 = Math.min(b0 + 1, LUT_SIZE - 1);
      const db = bf - b0;

      const idx000 = b0 * LUT_SIZE * LUT_SIZE + g0 * LUT_SIZE + r0;
      const idx100 = b0 * LUT_SIZE * LUT_SIZE + g0 * LUT_SIZE + r1;
      const idx010 = b0 * LUT_SIZE * LUT_SIZE + g1 * LUT_SIZE + r0;
      const idx110 = b0 * LUT_SIZE * LUT_SIZE + g1 * LUT_SIZE + r1;
      const idx001 = b1 * LUT_SIZE * LUT_SIZE + g0 * LUT_SIZE + r0;
      const idx101 = b1 * LUT_SIZE * LUT_SIZE + g0 * LUT_SIZE + r1;
      const idx011 = b1 * LUT_SIZE * LUT_SIZE + g1 * LUT_SIZE + r0;
      const idx111 = b1 * LUT_SIZE * LUT_SIZE + g1 * LUT_SIZE + r1;

      const w000 = (1 - dr) * (1 - dg) * (1 - db);
      const w100 = dr * (1 - dg) * (1 - db);
      const w010 = (1 - dr) * dg * (1 - db);
      const w110 = dr * dg * (1 - db);
      const w001 = (1 - dr) * (1 - dg) * db;
      const w101 = dr * (1 - dg) * db;
      const w011 = (1 - dr) * dg * db;
      const w111 = dr * dg * db;

      sumR[idx000] += rout * w000; sumG[idx000] += gout * w000; sumB[idx000] += bout * w000; weights[idx000] += w000;
      sumR[idx100] += rout * w100; sumG[idx100] += gout * w100; sumB[idx100] += bout * w100; weights[idx100] += w100;
      sumR[idx010] += rout * w010; sumG[idx010] += gout * w010; sumB[idx010] += bout * w010; weights[idx010] += w010;
      sumR[idx110] += rout * w110; sumG[idx110] += gout * w110; sumB[idx110] += bout * w110; weights[idx110] += w110;
      sumR[idx001] += rout * w001; sumG[idx001] += gout * w001; sumB[idx001] += bout * w001; weights[idx001] += w001;
      sumR[idx101] += rout * w101; sumG[idx101] += gout * w101; sumB[idx101] += bout * w101; weights[idx101] += w101;
      sumR[idx011] += rout * w011; sumG[idx011] += gout * w011; sumB[idx011] += bout * w011; weights[idx011] += w011;
      sumR[idx111] += rout * w111; sumG[idx111] += gout * w111; sumB[idx111] += bout * w111; weights[idx111] += w111;

      sampleCount++;
    }
  }

  console.log(`Trilinear splatting completed (${sampleCount.toLocaleString()} voxel samples).`);

  const lutR = new Float32Array(numEntries);
  const lutG = new Float32Array(numEntries);
  const lutB = new Float32Array(numEntries);
  const isKnown = new Uint8Array(numEntries);

  let knownCount = 0;
  for (let i = 0; i < numEntries; i++) {
    if (weights[i] > 1e-4) {
      lutR[i] = sumR[i] / weights[i];
      lutG[i] = sumG[i] / weights[i];
      lutB[i] = sumB[i] / weights[i];
      isKnown[i] = 1;
      knownCount++;
    }
  }
  console.log(`Observed color volume: ${knownCount} / ${numEntries} nodes (${(knownCount / numEntries * 100).toFixed(1)}%).`);

  // Anchor boundaries: (0,0,0) and (1,1,1)
  if (!isKnown[0]) {
    lutR[0] = 0; lutG[0] = 0; lutB[0] = 0; isKnown[0] = 1;
  }
  const lastIdx = numEntries - 1;
  if (!isKnown[lastIdx]) {
    lutR[lastIdx] = 1; lutG[lastIdx] = 1; lutB[lastIdx] = 1; isKnown[lastIdx] = 1;
  }

  // 4. Inpaint unobserved vertices with 3D harmonic diffusion (Laplacian smoothing)
  console.log(`Diffusing colorspace via 3D Laplacian harmonic inpainting (100 passes)...`);
  for (let iter = 0; iter < 100; iter++) {
    for (let b = 0; b < LUT_SIZE; b++) {
      for (let g = 0; g < LUT_SIZE; g++) {
        for (let r = 0; r < LUT_SIZE; r++) {
          const idx = b * LUT_SIZE * LUT_SIZE + g * LUT_SIZE + r;
          if (isKnown[idx]) continue;

          let nSumR = 0, nSumG = 0, nSumB = 0, nCount = 0;
          if (r > 0) { const ni = idx - 1; nSumR += lutR[ni]; nSumG += lutG[ni]; nSumB += lutB[ni]; nCount++; }
          if (r < LUT_SIZE - 1) { const ni = idx + 1; nSumR += lutR[ni]; nSumG += lutG[ni]; nSumB += lutB[ni]; nCount++; }
          if (g > 0) { const ni = idx - LUT_SIZE; nSumR += lutR[ni]; nSumG += lutG[ni]; nSumB += lutB[ni]; nCount++; }
          if (g < LUT_SIZE - 1) { const ni = idx + LUT_SIZE; nSumR += lutR[ni]; nSumG += lutG[ni]; nSumB += lutB[ni]; nCount++; }
          if (b > 0) { const ni = idx - LUT_SIZE * LUT_SIZE; nSumR += lutR[ni]; nSumG += lutG[ni]; nSumB += lutB[ni]; nCount++; }
          if (b < LUT_SIZE - 1) { const ni = idx + LUT_SIZE * LUT_SIZE; nSumR += lutR[ni]; nSumG += lutG[ni]; nSumB += lutB[ni]; nCount++; }

          if (nCount > 0) {
            lutR[idx] = nSumR / nCount;
            lutG[idx] = nSumG / nCount;
            lutB[idx] = nSumB / nCount;
          }
        }
      }
    }
  }

  // 5. Generate .cube file string
  const lines = [
    `# Sony Creative Look 3D-LUT (Ground Truth Extracted: Sony Imaging Edge Edit 4.1)`,
    `# Look: ${lookCode} (${lookFullName})`,
    `# Demosaic: FlashRaw Rust SIMD128 Native Exposure / BIONZ XR Aligned`,
    `TITLE "Sony_${lookCode}_Official_Edit"`,
    `LUT_3D_SIZE ${LUT_SIZE}`,
    `DOMAIN_MIN 0.0 0.0 0.0`,
    `DOMAIN_MAX 1.0 1.0 1.0`,
    ``
  ];

  for (let b = 0; b < LUT_SIZE; b++) {
    for (let g = 0; g < LUT_SIZE; g++) {
      for (let r = 0; r < LUT_SIZE; r++) {
        const idx = b * LUT_SIZE * LUT_SIZE + g * LUT_SIZE + r;
        const cr = Math.max(0, Math.min(1, lutR[idx])).toFixed(6);
        const cg = Math.max(0, Math.min(1, lutG[idx])).toFixed(6);
        const cb = Math.max(0, Math.min(1, lutB[idx])).toFixed(6);
        lines.push(`${cr} ${cg} ${cb}`);
      }
    }
  }

  const cubeContent = lines.join('\n');
  const targetFiles = [
    `web/public/luts/Sony_Look_${lookCode}.cube`,
    `web/dist/luts/Sony_Look_${lookCode}.cube`,
    `luts/Sony_Look_${lookCode}.cube`,
    `luts/Sony_${lookCode}.cube`
  ];

  for (const f of targetFiles) {
    const dir = path.dirname(f);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(f, cubeContent, 'utf8');
    console.log(`[LUT Extractor] Saved LUT to: ${f}`);
  }

  console.log(`[LUT Extractor] Look ${lookCode} extraction successfully completed!`);
}

// CLI handler: single file or directory scan
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.log(`Usage:`);
    console.log(`  node scripts/extract_official_look_lut.mjs <official_jpg_path> <LOOK_CODE>`);
    console.log(`  node scripts/extract_official_look_lut.mjs --scan [directory_path]`);
    console.log(`\nExample:`);
    console.log(`  node scripts/extract_official_look_lut.mjs /Users/kai/Downloads/DSC01132_IN.JPG IN`);
    console.log(`  node scripts/extract_official_look_lut.mjs --scan /Users/kai/Downloads`);
    return;
  }

  if (args[0] === '--scan') {
    const scanDir = args[1] || '/Users/kai/Downloads';
    console.log(`Scanning ${scanDir} for official Sony Edit JPEG exports...`);
    const files = fs.readdirSync(scanDir);
    const validCodes = Object.keys(LOOK_NAMES);

    let foundCount = 0;
    for (const f of files) {
      if (!/\.jpe?g$/i.test(f)) continue;
      // Pattern: DSC01132_<LOOK>.jpg or DSC01132_<LOOK>_*.jpg or <LOOK>.jpg
      for (const code of validCodes) {
        const regex = new RegExp(`(_|\\b)${code}(\\b|_|\\.)`, 'i');
        if (regex.test(f) && !f.includes('7008x4672')) {
          const fullPath = path.join(scanDir, f);
          try {
            await extractLookLut(fullPath, code);
            foundCount++;
          } catch (err) {
            console.error(`Error processing ${f}:`, err.message);
          }
          break;
        }
      }
    }
    console.log(`Scan finished. Processed ${foundCount} look(s).`);
    return;
  }

  const [jpgPath, lookCode] = args;
  if (!lookCode) {
    console.error('Error: Please provide a look code (e.g. ST, PT, NT, VV, VV2, IN, SH, BW, SE)');
    process.exit(1);
  }

  await extractLookLut(jpgPath, lookCode);
}

if (process.argv[1] && process.argv[1].endsWith('extract_official_look_lut.mjs')) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
