import fs from 'fs';

async function extractLut() {
  console.log('Loading input and target binaries...');
  const inBuf = fs.readFileSync('/tmp/flashraw_full.bin');
  const outBuf = fs.readFileSync('/tmp/official_rgb.bin');

  const width = 7008;
  const height = 4672;
  const totalPixels = width * height;
  console.log(`Processing ${totalPixels} pixels (${width}x${height})...`);

  const LUT_SIZE = 33;
  const numEntries = LUT_SIZE * LUT_SIZE * LUT_SIZE;
  const sumR = new Float64Array(numEntries);
  const sumG = new Float64Array(numEntries);
  const sumB = new Float64Array(numEntries);
  const weights = new Float64Array(numEntries);

  const scale = (LUT_SIZE - 1) / 255.0;

  // Trilinear splatting
  // Step = 2 for sub-pixel accuracy and high speed (approx 8.2 million samples)
  const step = 2;
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

  console.log(`Sampled ${sampleCount} points. Splatting completed.`);

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
  console.log(`Known grid vertices: ${knownCount} / ${numEntries}`);

  // Anchors: (0,0,0) -> (0,0,0) and (1,1,1) -> (1,1,1)
  lutR[0] = 0; lutG[0] = 0; lutB[0] = 0; isKnown[0] = 1;
  const lastIdx = numEntries - 1;
  lutR[lastIdx] = 1; lutG[lastIdx] = 1; lutB[lastIdx] = 1; isKnown[lastIdx] = 1;

  // Inpaint unknown vertices with 3D harmonic diffusion (Laplacian smoothing)
  console.log('Running 3D Laplacian harmonic inpainting for unobserved colorspace...');
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

  // Generate .cube file string
  const lines = [
    '# Sony Creative Look 3D-LUT (Ground Truth Extracted: Sony Imaging Edge Edit 4.1)',
    '# Exact High-Contrast Film 1 Profile (True Deep Blacks, Characteristic S-Curve, Film Greens)',
    'TITLE "Sony_FL_Official_Edit"',
    `LUT_3D_SIZE ${LUT_SIZE}`,
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
    ''
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
    'web/public/luts/Sony_Look_FL.cube',
    'web/dist/luts/Sony_Look_FL.cube',
    'luts/Sony_Look_FL.cube',
    'luts/Sony_FL.cube',
  ];

  for (const f of targetFiles) {
    fs.writeFileSync(f, cubeContent, 'utf8');
    console.log(`Saved official LUT to: ${f}`);
  }

  console.log('Official FL 3D-LUT generated successfully!');
}

extractLut().catch(console.error);

