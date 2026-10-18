/**
 * Sony ARW Creative Look Full Suite Injector & Profile Porter
 * 索尼全套新创意外观 (FL2/FL3) 纯前端 JavaScript 逆向解密与无损注入引擎
 */

export const BLOCK_SIZE = 3110;

export const ALL_CREATIVE_LOOKS = {
  keep: { name: 'Keep Original',  desc: '保持拍摄原貌 (保留人像/标准等设置，FL2/FL3在下拉菜单备用)' },
  fl2:  { name: 'FL2',            desc: '怀旧复古胶片 2 (高反差、浓郁胶片质感、暗部沉稳内敛)' },
  fl3:  { name: 'FL3',            desc: '清透电影胶片 3 (柔和低反差、亮部通透清爽、柔美空气感)' },
  fl:   { name: 'FL',             desc: '经典冷暖胶片 1 (蓝绿色调、暗部微提、情绪氛围感)' },
  vv2:  { name: 'VV2',            desc: '极清生动 2 (极清透亮、鲜艳度与清晰度增强)' },
  in:   { name: 'IN',             desc: '拍立得 / 即时 (哑光质感、低对比度、复古日系感)' },
  sh:   { name: 'SH',             desc: '柔和高调 (明亮柔和、轻盈空气感、高光柔化)' },
  st:   { name: 'Standard',       desc: '标准自然色彩 (索尼基准真实色彩)' },
  pt:   { name: 'Portrait',       desc: '人像肤色优化 (优化亚洲人肤色、柔和粉嫩)' },
  nt:   { name: 'Neutral',        desc: '中性宽容度 (低饱和与低对比，适合后期精修)' },
  vv:   { name: 'Vivid',          desc: '生动鲜艳 (高对比、高鲜艳风光色彩)' },
};

export const TARGET_MODELS = {
  keep: { name: '保持原机型标定', code: '' },
  a7c2: { name: 'A7C II (ILCE-7CM2)', code: 'ILCE-7CM2' },
  a7m4: { name: 'A7 IV (ILCE-7M4)', code: 'ILCE-7M4\0' },
  a7m5: { name: 'A7 V (ILCE-7M5 预留)', code: 'ILCE-7M5\0' },
  a1m2: { name: 'A1 II (ILCE-1M2)', code: 'ILCE-1M2\0' },
  a9m3: { name: 'A9 III (ILCE-9M3)', code: 'ILCE-9M3\0' },
  a7rm5: { name: 'A7R V (ILCE-7RM5)', code: 'ILCE-7RM5' },
};

export const DEFAULT_FL2_BASE64 = "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";
export const DEFAULT_FL3_BASE64 = "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";

export function base64ToUint8Array(base64) {
  const binaryString = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function sonySr2Crypt(dataBytes, key = 0x44332211) {
  const bytes = new Uint8Array(dataBytes);
  const words = Math.floor(bytes.length / 4);
  const pad = new Uint32Array(128);

  let currKey = key >>> 0;
  for (let i = 0; i < 4; i++) {
    const lo = (((currKey & 0xffff) * 0x0edd) + 1) >>> 0;
    const hi = (
      ((currKey >>> 16) * 0x0edd) +
      ((currKey & 0xffff) * 0x02e9) +
      (lo >>> 16)
    ) >>> 0;
    currKey = (((hi & 0xffff) << 16) | (lo & 0xffff)) >>> 0;
    pad[i] = currKey;
  }

  pad[3] = ((pad[3] << 1) | ((pad[0] ^ pad[2]) >>> 31)) >>> 0;
  for (let i = 4; i < 0x7f; i++) {
    pad[i] = (
      ((pad[i - 4] ^ pad[i - 2]) << 1) |
      ((pad[i - 3] ^ pad[i - 1]) >>> 31)
    ) >>> 0;
  }

  const result = new Uint8Array(bytes.length);
  result.set(bytes);
  const view = new DataView(result.buffer, result.byteOffset, result.byteLength);

  let padI = 0x7f;
  for (let j = 0; j < words; j++) {
    const idx = padI & 0x7f;
    const pad1 = (padI + 1) & 0x7f;
    const pad65 = (padI + 65) & 0x7f;
    pad[idx] = (pad[pad1] ^ pad[pad65]) >>> 0;

    const currentWord = view.getUint32(j * 4, false);
    const newWord = (currentWord ^ pad[idx]) >>> 0;
    view.setUint32(j * 4, newWord, false);
    padI++;
  }

  return result;
}

export function findSr2Subifd(raw) {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const maxScan = Math.min(0x40000, raw.length - 36);

  for (let i = 0x100; i < maxScan; i += 2) {
    if (view.getUint16(i, true) === 0x7200 && view.getUint16(i + 2, true) === 0x0004) {
      const offset = view.getUint32(i + 8, true);
      if (view.getUint16(i + 12, true) === 0x7201 && view.getUint16(i + 14, true) === 0x0004) {
        const length = view.getUint32(i + 20, true);
        const key = 0x44332211;
        if (offset > 0 && offset < raw.length && length > 0 && length <= raw.length - offset) {
          return { offset, length, key };
        }
      }
    }
  }

  return { offset: 65826, length: 35526, key: 0x44332211 };
}

export function inspectArw(rawBytes, fileName = '') {
  const raw = new Uint8Array(rawBytes);
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);

  const fileSizeMb = (raw.length / (1024 * 1024)).toFixed(2);
  const isTiff = (raw[0] === 0x49 && raw[1] === 0x49 && raw[2] === 0x2a && raw[3] === 0x00) ||
                 (raw[0] === 0x4d && raw[1] === 0x4d && raw[2] === 0x00 && raw[3] === 0x2a);

  let model = '未知机型';
  const headerLen = Math.min(0x20000, raw.length);
  let rawStrHeader = '';
  for (let i = 0; i < headerLen; i++) {
    rawStrHeader += (raw[i] >= 32 && raw[i] <= 126) ? String.fromCharCode(raw[i]) : ' ';
  }

  const models = ['ILCE-7CM2', 'ILCE-7M4', 'ILCE-7RM5', 'ILCE-7M5', 'ILCE-1M2', 'ILCE-9M3', 'ILCE-7SM3', 'ILCE-6700'];
  for (const m of models) {
    if (rawStrHeader.includes(m)) {
      model = m;
      break;
    }
  }
  if (model === '未知机型') {
    const match = rawStrHeader.match(/ILCE-[0-9A-Za-z]+/);
    if (match) model = match[0];
  }

  let activeLook = '未知';
  const styles = ['FL2', 'FL3', 'Standard', 'Vivid', 'Neutral', 'Portrait', 'FL', 'VV2', 'IN', 'SH', 'BW', 'Sepia'];
  for (const s of styles) {
    if (rawStrHeader.includes(s)) {
      activeLook = s;
      break;
    }
  }

  const { offset, length, key } = findSr2Subifd(raw);
  const sr2Found = (offset > 0 && offset < raw.length && length > 0 && length <= raw.length - offset);

  const slots = [];
  let hasFl2 = false;
  let hasFl3 = false;

  if (sr2Found) {
    const sr2Enc = raw.slice(offset, offset + length);
    const sr2Dec = sonySr2Crypt(sr2Enc, key);
    const decView = new DataView(sr2Dec.buffer, sr2Dec.byteOffset, sr2Dec.byteLength);

    let p = 0;
    let slotIdx = 1;
    while (p < sr2Dec.length - 4) {
      const numTags = decView.getUint16(p, true);
      if (numTags === 114 && p + BLOCK_SIZE <= sr2Dec.length) {
        const block = sr2Dec.slice(p, p + BLOCK_SIZE);
        let name = '';
        for (let k = 3094; k < 3110; k++) {
          if (block[k] === 0) break;
          name += String.fromCharCode(block[k]);
        }
        name = name.trim();

        let status = '原厂保留';
        if (name === 'FL2') {
          hasFl2 = true;
          status = '⚡ [已解锁] 真实 FL2 3D-LUT 已注入 (原 BW 槽位)';
        } else if (name === 'FL3') {
          hasFl3 = true;
          status = '⚡ [已解锁] 真实 FL3 3D-LUT 已注入 (原 Sepia 槽位)';
        } else if (name === 'BW') {
          status = '原厂保留 (单色黑白)';
        } else if (name === 'Sepia') {
          status = '原厂保留 (怀旧褐色)';
        }

        slots.push({
          index: slotIdx++,
          offset: p,
          name: name || 'Unknown',
          status,
        });

        p += BLOCK_SIZE;
        continue;
      }
      p += 2;
    }
  }

  return {
    fileName,
    fileSizeMb,
    isTiff,
    cameraModel: model,
    activeLook,
    sr2Found,
    sr2Offset: offset,
    sr2Length: length,
    slots,
    hasFl2,
    hasFl3,
    isFullyUnlocked: hasFl2 && hasFl3,
  };
}

export function injectLookProfileBlock(sr2Buf, sr2Offset, srcBlock, dstStart, newNameStr) {
  const block = new Uint8Array(srcBlock.slice(0, BLOCK_SIZE));
  const blockView = new DataView(block.buffer, block.byteOffset, block.byteLength);

  let originalIfdBase = null;
  for (let k = 0; k < block.length - 12; k += 2) {
    if (blockView.getUint16(k, true) === 0x7770 && blockView.getUint16(k + 2, true) === 0x0002) {
      const val = blockView.getUint32(k + 8, true);
      originalIfdBase = val - 3094;
      break;
    }
  }

  const dstIfdBase = sr2Offset + dstStart;
  if (originalIfdBase === null) {
    originalIfdBase = dstIfdBase;
  }

  const delta = dstIfdBase - originalIfdBase;

  let p = 0;
  while (p < block.length - 4) {
    const nt = blockView.getUint16(p, true);
    if (nt >= 1 && nt <= 150 && p + 2 + nt * 12 <= block.length) {
      let valid = true;
      for (let k = 0; k < Math.min(nt, 3); k++) {
        const ep = p + 2 + k * 12;
        const t = blockView.getUint16(ep, true);
        const tt = blockView.getUint16(ep + 2, true);
        if (![1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12].includes(tt) || t < 0x7000 || t > 0x8000) {
          valid = false;
          break;
        }
      }

      if (valid) {
        for (let k = 0; k < nt; k++) {
          const ep = p + 2 + k * 12;
          const t = blockView.getUint16(ep, true);
          const v = blockView.getUint32(ep + 8, true);

          if (v >= originalIfdBase && v < originalIfdBase + BLOCK_SIZE) {
            const newV = (v + delta) >>> 0;
            blockView.setUint32(ep + 8, newV, true);
          }

          if (t === 0x7770 && newNameStr) {
            const relNamePos = (v + delta) - dstIfdBase;
            if (relNamePos >= 0 && relNamePos <= block.length - 16) {
              for (let n = 0; n < 16; n++) {
                block[relNamePos + n] = n < newNameStr.length ? newNameStr.charCodeAt(n) : 0;
              }
            }
          }
        }

        p += 2 + nt * 12 + 4;
        continue;
      }
    }
    p += 2;
  }

  sr2Buf.set(block, dstStart);
}

export function cloneLookSlot(sr2Buf, sr2Offset, srcStart, dstStart, newNameStr) {
  injectLookProfileBlock(sr2Buf, sr2Offset, sr2Buf.slice(srcStart, srcStart + BLOCK_SIZE), dstStart, newNameStr);
}

export function unlockAllCreativeLooks(raw, defaultLook = 'fl2', customFl2Bin = null, customFl3Bin = null) {
  const { offset, length, key } = findSr2Subifd(raw);
  const sr2Enc = raw.slice(offset, offset + length);
  const sr2Dec = sonySr2Crypt(sr2Enc, key);

  // 1. 注入 Slot 9 (BW 槽位, 偏移 29306) 为 FL2
  const fl2Bytes = customFl2Bin || base64ToUint8Array(DEFAULT_FL2_BASE64);
  if (fl2Bytes && fl2Bytes.length >= BLOCK_SIZE) {
    injectLookProfileBlock(sr2Dec, offset, fl2Bytes, 29306, 'FL2');
  } else {
    cloneLookSlot(sr2Dec, offset, 16866, 29306, 'FL2');
  }

  // 2. 注入 Slot 10 (Sepia 槽位, 偏移 32416) 为 FL3
  const fl3Bytes = customFl3Bin || base64ToUint8Array(DEFAULT_FL3_BASE64);
  if (fl3Bytes && fl3Bytes.length >= BLOCK_SIZE) {
    injectLookProfileBlock(sr2Dec, offset, fl3Bytes, 32416, 'FL3');
  } else {
    cloneLookSlot(sr2Dec, offset, 16866, 32416, 'FL3');
  }

  // 3. 设置默认载入外观 (Tag 0xb020)
  if (defaultLook && defaultLook !== 'keep' && ALL_CREATIVE_LOOKS[defaultLook]) {
    const lookName = ALL_CREATIVE_LOOKS[defaultLook].name;
    const styles = ['Standard', 'Vivid', 'Neutral', 'Portrait', 'FL', 'VV2', 'IN', 'SH'];

    let maxSearch = Math.min(0x20000, raw.length - 16);
    for (const s of styles) {
      const pattern = s + '\0';
      for (let i = 0; i < maxSearch; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
          if (raw[i + j] !== pattern.charCodeAt(j)) {
            match = false;
            break;
          }
        }
        if (match) {
          for (let k = 0; k < 16; k++) {
            raw[i + k] = k < lookName.length ? lookName.charCodeAt(k) : 0;
          }
          maxSearch = 0;
          break;
        }
      }
    }
  }

  // 重新加密封包写回原位 (零位移)
  const sr2Reenc = sonySr2Crypt(sr2Dec, key);
  raw.set(sr2Reenc, offset);
}

export function processArw(inputData, options = {}) {
  const raw = new Uint8Array(
    inputData instanceof ArrayBuffer
      ? inputData.slice(0)
      : inputData.buffer.slice(inputData.byteOffset, inputData.byteOffset + inputData.byteLength)
  );
  const origLen = raw.length;

  const targetModel = options.targetModel || 'a7c2';
  const defaultLook = options.defaultLook || 'fl2';
  const customFl2Bin = options.customFl2Bin || null;
  const customFl3Bin = options.customFl3Bin || null;

  if (targetModel && targetModel !== 'keep' && TARGET_MODELS[targetModel] && TARGET_MODELS[targetModel].code) {
    const targetCode = TARGET_MODELS[targetModel].code;
    const targetPattern = 'ILCE-7CM2';

    for (let i = 0; i < Math.min(0x20000, raw.length - 9); i++) {
      let match = true;
      for (let j = 0; j < targetPattern.length; j++) {
        if (raw[i + j] !== targetPattern.charCodeAt(j)) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let k = 0; k < 9; k++) {
          raw[i + k] = k < targetCode.length ? targetCode.charCodeAt(k) : 0;
        }
      }
    }
  }

  unlockAllCreativeLooks(raw, defaultLook, customFl2Bin, customFl3Bin);

  if (raw.length !== origLen) {
    throw new Error('File size mismatch error!');
  }

  return raw;
}
