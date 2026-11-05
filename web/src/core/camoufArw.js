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

export const FACTORY_FL2_BASE64 = "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";
export const FACTORY_FL3_BASE64 = "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";
export const BALANCED_FL2_BASE64 = "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";
export const BALANCED_FL3_BASE64 = "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";

export const DEFAULT_FL2_BASE64 = BALANCED_FL2_BASE64;
export const DEFAULT_FL3_BASE64 = BALANCED_FL3_BASE64;

export const PROFILE_MODES = {
  balanced: {
    id: 'balanced',
    name: '通透平衡校准 (推荐)',
    tag: '中性白平衡 · 肤色校正',
    desc: '重归一化色彩矩阵，修正室内及白底偏黄，人像肤色通透自然，同时保持 FL2/FL3 胶片反差'
  },
  factory: {
    id: 'factory',
    name: '原厂高暖色彩',
    tag: '原厂矩阵 · 浓郁暖调',
    desc: '原相机未校准提取矩阵，高光与阴影保留浓郁暖色胶片调性'
  }
};

export const WB_OFFSETS = {
  '-400': {
    id: '-400',
    kelvin: -400,
    name: '-400K (肤色通透 / 推荐)',
    desc: '自动消除 FL2/FL3 原生偏暖胶片倾向，呈现通透白皙人像肤色'
  },
  '-200': {
    id: '-200',
    kelvin: -200,
    name: '-200K (自然微冷)',
    desc: '微调色温，使画面清爽自然'
  },
  '-600': {
    id: '-600',
    kelvin: -600,
    name: '-600K (清冷冷调)',
    desc: '较大幅度降低色温，增强青蓝空气感'
  },
  '0': {
    id: '0',
    kelvin: 0,
    name: '0K (保持原拍摄色温)',
    desc: '保留拍摄时的原始白平衡增益参数'
  }
};

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
          const matB = decView.getInt16(p + 1580, true);
          const isBal = Math.abs(matB - (-80)) < 25;
          status = isBal
            ? '⚡ [已解锁] FL2 · 通透平衡版 (推荐 · 修正偏黄白底)'
            : '⚡ [已解锁] FL2 · 原厂浓郁极暖版 (原始矩阵)';
        } else if (name === 'FL3') {
          hasFl3 = true;
          const matB = decView.getInt16(p + 1580, true);
          const isBal = Math.abs(matB - (-33)) < 25;
          status = isBal
            ? '⚡ [已解锁] FL3 · 通透平衡版 (推荐 · 修正偏黄白底)'
            : '⚡ [已解锁] FL3 · 原厂浓郁极暖版 (原始矩阵)';
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

export function applyWhitebalanceOffset(raw, sr2Dec, sr2Offset, offsetKelvin = -400) {
  if (!offsetKelvin || Number(offsetKelvin) === 0) return 0;
  const numK = Number(offsetKelvin);

  // 黑体辐射微倒度近似：每降 100K，R 通道减少约 1.7%，B 通道增加约 1.8%
  const step = numK / 100;
  const factorR = Math.max(0.65, Math.min(1.45, 1.0 + step * 0.017));
  const factorB = Math.max(0.65, Math.min(1.45, 1.0 - step * 0.018));

  let modifiedCount = 0;

  const adjustBuffer = (buf, baseOffset = 0) => {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const maxSearch = buf.length - 12;

    for (let p = 0; p < maxSearch; p += 2) {
      const tag = view.getUint16(p, true);
      const count = view.getUint32(p + 4, true);

      // 0x7313 (WB_RGGBLevels) 或 0x7312 (WB_RGGBLevelsAuto)
      if ((tag === 0x7313 || tag === 0x7312) && count === 4) {
        const valOff = view.getUint32(p + 8, true);
        let targetPos = null;

        if (valOff + 8 <= buf.length) {
          targetPos = valOff;
        } else if (baseOffset > 0 && valOff >= baseOffset && (valOff - baseOffset + 8) <= buf.length) {
          targetPos = valOff - baseOffset;
        }

        if (targetPos !== null) {
          const r = view.getUint16(targetPos, true);
          const g1 = view.getUint16(targetPos + 2, true);
          const g2 = view.getUint16(targetPos + 4, true);
          const b = view.getUint16(targetPos + 6, true);

          if ((g1 === 1024 || g2 === 1024) && r > 400 && r < 9000 && b > 400 && b < 9000) {
            const newR = Math.max(1, Math.min(8192, Math.round(r * factorR)));
            const newB = Math.max(1, Math.min(8192, Math.round(b * factorB)));
            view.setUint16(targetPos, newR, true);
            view.setUint16(targetPos + 6, newB, true);
            modifiedCount++;
          }
        }
      }
    }
  };

  adjustBuffer(sr2Dec, sr2Offset);
  adjustBuffer(raw, 0);

  return modifiedCount;
}

export function unlockAllCreativeLooks(
  raw,
  defaultLook = 'fl2',
  profileMode = 'balanced',
  customFl2Bin = null,
  customFl3Bin = null,
  wbOffset = -400
) {
  const { offset, length, key } = findSr2Subifd(raw);
  const sr2Enc = raw.slice(offset, offset + length);
  const sr2Dec = sonySr2Crypt(sr2Enc, key);

  // 1. 注入 Slot 9 (BW 槽位, 偏移 29306) 为 FL2 (支持通透平衡版与原厂版)
  const activeFl2Base64 = profileMode === 'factory' ? FACTORY_FL2_BASE64 : BALANCED_FL2_BASE64;
  const fl2Bytes = customFl2Bin || base64ToUint8Array(activeFl2Base64);
  if (fl2Bytes && fl2Bytes.length >= BLOCK_SIZE) {
    injectLookProfileBlock(sr2Dec, offset, fl2Bytes, 29306, 'FL2');
  } else {
    cloneLookSlot(sr2Dec, offset, 16866, 29306, 'FL2');
  }

  // 2. 注入 Slot 10 (Sepia 槽位, 偏移 32416) 为 FL3 (支持通透平衡版与原厂版)
  const activeFl3Base64 = profileMode === 'factory' ? FACTORY_FL3_BASE64 : BALANCED_FL3_BASE64;
  const fl3Bytes = customFl3Bin || base64ToUint8Array(activeFl3Base64);
  if (fl3Bytes && fl3Bytes.length >= BLOCK_SIZE) {
    injectLookProfileBlock(sr2Dec, offset, fl3Bytes, 32416, 'FL3');
  } else {
    cloneLookSlot(sr2Dec, offset, 16866, 32416, 'FL3');
  }

  // 3. 自动白平衡色温补偿 (根据用户反馈默认自动 -400K 修正偏暖胶片感)
  if (wbOffset && Number(wbOffset) !== 0) {
    applyWhitebalanceOffset(raw, sr2Dec, offset, Number(wbOffset));
  }

  // 4. 设置默认载入外观 (Tag 0xb020)
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

/**
 * 替换 ARW 文件内嵌的高清 JPEG 预览图为新外观渲染后的 JPEG
 * 并同步更新 TIFF IFD 中的 Tag 0x0202 (JPEGInterchangeFormatLength)
 * @param {Uint8Array} rawBytes ARW 文件完整数据 (Uint8Array)
 * @param {Uint8Array} newJpegBytes 渲染后的新外观 JPEG 数据 (Uint8Array)
 * @returns {{ success: boolean, updatedRaw: Uint8Array, message: string }}
 */
export function replaceEmbeddedPreviewInArw(rawBytes, newJpegBytes) {
  if (!rawBytes || rawBytes.length < 100 || !newJpegBytes || newJpegBytes.length < 100) {
    return { success: false, updatedRaw: rawBytes, message: '输入数据无效' };
  }

  const isLe = rawBytes[0] === 0x49 && rawBytes[1] === 0x49; // 'II' = Little Endian
  const u16 = (off) =>
    isLe ? rawBytes[off] | (rawBytes[off + 1] << 8) : (rawBytes[off] << 8) | rawBytes[off + 1];
  const u32 = (off) =>
    isLe
      ? ((rawBytes[off] |
          (rawBytes[off + 1] << 8) |
          (rawBytes[off + 2] << 16) |
          (rawBytes[off + 3] << 24)) >>>
        0)
      : (((rawBytes[off] << 24) |
          (rawBytes[off + 1] << 16) |
          (rawBytes[off + 2] << 8) |
          rawBytes[off + 3]) >>>
        0);

  const writeU32 = (target, off, val) => {
    if (isLe) {
      target[off] = val & 0xff;
      target[off + 1] = (val >> 8) & 0xff;
      target[off + 2] = (val >> 16) & 0xff;
      target[off + 3] = (val >> 24) & 0xff;
    } else {
      target[off] = (val >> 24) & 0xff;
      target[off + 1] = (val >> 16) & 0xff;
      target[off + 2] = (val >> 8) & 0xff;
      target[off + 3] = val & 0xff;
    }
  };

  const firstIfd = u32(4);
  const visited = new Set();
  const queue = [firstIfd];
  const jpegSlots = [];

  while (queue.length > 0) {
    const off = queue.shift();
    if (visited.has(off) || off + 2 > rawBytes.length) continue;
    visited.add(off);

    const cnt = u16(off);
    let curr = off + 2;
    let w = 0, h = 0, jOff = 0, jLen = 0;
    let jOffValPos = -1;
    let jLenValPos = -1;

    for (let i = 0; i < cnt; i++) {
      if (curr + 12 > rawBytes.length) break;
      const tag = u16(curr);
      const typ = u16(curr + 2);
      const c = u32(curr + 4);
      const val = typ === 4 ? u32(curr + 8) : (typ === 3 ? u16(curr + 8) : 0);

      if (tag === 0x0100) w = val; // ImageWidth
      else if (tag === 0x0101) h = val; // ImageHeight
      else if (tag === 0x0201) {
        jOff = val;
        jOffValPos = curr + 8;
      } else if (tag === 0x0202) {
        jLen = val;
        jLenValPos = curr + 8;
      } else if (tag === 0x014a) {
        // SubIFDs
        if (c === 1) queue.push(val);
        else if (c > 1 && val + c * 4 <= rawBytes.length) {
          for (let k = 0; k < c; k++) queue.push(u32(val + k * 4));
        }
      } else if (tag === 0x8769) {
        // ExifIFDPointer
        if (val > 0 && val < rawBytes.length) queue.push(val);
      }
      curr += 12;
    }

    if (jOff > 0 && jLen > 0 && jOffValPos > 0 && jLenValPos > 0) {
      jpegSlots.push({
        width: w,
        height: h,
        offset: jOff,
        length: jLen,
        offValPos: jOffValPos,
        lenValPos: jLenValPos,
      });
    }

    if (curr + 4 <= rawBytes.length) {
      const nextIfd = u32(curr);
      if (nextIfd > 0) queue.push(nextIfd);
    }
  }

  if (jpegSlots.length === 0) {
    return { success: false, updatedRaw: rawBytes, message: '未找到内嵌 JPEG 槽位' };
  }

  // 选取全像素高清大图主槽位 (如 7008x4672，空间通常 1.5MB~5MB，通常位于 IFD2)
  jpegSlots.sort((a, b) => b.length - a.length);
  const target = jpegSlots[0];

  // 1. 若新 JPEG 尺寸 <= 旧 JPEG 空间：原地安全替换（零位移，最安全稳定）
  if (newJpegBytes.length <= target.length) {
    rawBytes.set(newJpegBytes, target.offset);
    if (newJpegBytes.length < target.length) {
      rawBytes.fill(0, target.offset + newJpegBytes.length, target.offset + target.length);
    }
    writeU32(rawBytes, target.lenValPos, newJpegBytes.length);
    return { success: true, updatedRaw: rawBytes, message: '全像素高清内嵌 JPEG 原地安全更新完成' };
  }

  // 2. 若新 JPEG 尺寸 > 旧 JPEG 空间：追加到文件末尾并更新 TIFF 指针
  const newRaw = new Uint8Array(rawBytes.length + newJpegBytes.length);
  newRaw.set(rawBytes, 0);
  const newOffset = rawBytes.length;
  newRaw.set(newJpegBytes, newOffset);

  writeU32(newRaw, target.offValPos, newOffset);
  writeU32(newRaw, target.lenValPos, newJpegBytes.length);

  return { success: true, updatedRaw: newRaw, message: '全像素高清内嵌 JPEG 末尾追加更新完成' };
}

export function processArw(inputData, options = {}) {
  let raw = new Uint8Array(
    inputData instanceof ArrayBuffer
      ? inputData.slice(0)
      : inputData.buffer.slice(inputData.byteOffset, inputData.byteOffset + inputData.byteLength)
  );

  const targetModel = options.targetModel || 'a7c2';
  const defaultLook = options.defaultLook || 'fl2';
  const profileMode = options.profileMode || 'balanced';
  const customFl2Bin = options.customFl2Bin || null;
  const customFl3Bin = options.customFl3Bin || null;
  const replacementJpegBytes = options.replacementJpegBytes || null;

  const wbOffset = options.wbOffset !== undefined ? options.wbOffset : -400;

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

  // 1. 注入全套创意外观元数据与白平衡
  unlockAllCreativeLooks(raw, defaultLook, profileMode, customFl2Bin, customFl3Bin, wbOffset);

  // 2. 将 ARW 内嵌的预览 JPEG 按新的创意外观渲染结果写回替换
  if (replacementJpegBytes && replacementJpegBytes.length > 0) {
    const replaceRes = replaceEmbeddedPreviewInArw(raw, replacementJpegBytes);
    if (replaceRes.success && replaceRes.updatedRaw) {
      raw = replaceRes.updatedRaw;
    }
  }

  return raw;
}
