/**
 * 相机 MakerNote 厂商专有私有数据结构化解析器
 * 核心支持：索尼 (Sony)、尼康 (Nikon)、富士 (Fuji)、佳能 (Canon)、奥林巴斯 (Olympus)、宾得 (Pentax)
 * 特别针对索尼微单 Tag 0x9050 专用加密置换表解密与全系硬件快门释放次数解析
 */

/**
 * 索尼 MakerNote Tag 0x9050 / 0x2010 / 0x94xx 专用解密置换表
 * 算法原理 (ExifTool Image::ExifTool::Sony):
 * 公式: c = (b * b * b) % 249 (b 从 2 到 247)
 */
const SONY_ENC_STR =
  '\x08\x1b\x40\x7d\xd8\x5e\x0e\xe7\x04V\xea\xcd\x05\x8ap\xb6i\x88\x200\xbe\xd7\x81\xbb\x92\x0c\x28\xecl\xa0\x95Q\xd3\x2f\x5dj\x5c9\x07\xc5\x87L\x1a\xf0\xe2\xef\x24y\x02\xb7\xac\xe0\x60\x2bG\xba\x91\xcbu\x8e\x233\xc4\xe3\x96\xdc\xc2N\x7fb\xf6OeE\xeet\xcf\x138KRST\x5bn\x93\xd02\xb1aAW\xa9D\x27X\xdd\xc3\x10\xbc\xdbs\x83\x181\xd4\x15\xe5_\x7bF\xbf\xf3\xe8\xa4\x2d\x82\xb0\xbd\xaf\x8cZ\x1f\xda\x9fmJ\x3cIw\xccU\x11\x06\x3a\xb3\x7e\x9a\x14\xe4\x25\xc8\xe1v\x86\x1e\x3d\xe96\x1c\xa1\xd2\xb5P\xa2\xb8\x98H\xc7\x29f\x8b\x9e\xa5\xa6\xa7\xae\xc1\xe6\x2a\x85\x0b\xb4\x94\xaa\x03\x97z\xab7\x1dc\x165\xc6\xd6k\x84\x2eh\x3f\xb2\xce\x99\x19MB\xf7\x80\xd5\x0a\x17\x09\xdf\xadr4\xf2\xc0\x9d\x8f\x9c\xca\x26\xa8dY\x8d\x0d\xd1\xedg\x3ex\x22\x3b\xc9\xd9q\x90C\x89o\xf4\x2c\x0f\xa3\xf5\x12\xeb\x9b\x21\x7c\xb9\xde\xf1';

const SONY_DEC_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i++) SONY_DEC_TABLE[i] = i;
for (let i = 0; i < SONY_ENC_STR.length; i++) {
  SONY_DEC_TABLE[SONY_ENC_STR.charCodeAt(i)] = i + 2;
}

/**
 * 解密 Sony 加密数据块
 */
export function decipherSony(bytes) {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = SONY_DEC_TABLE[bytes[i]];
  }
  return out;
}

/**
 * 读取 32-bit 无符号小端整数
 */
function readUint32LE(bytes, offset) {
  if (offset + 4 > bytes.length) return 0;
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

/**
 * 在目标字节数组中查找子序列偏移量
 */
function findBytes(haystack, needle, maxScan = haystack.length) {
  if (needle.length === 0 || haystack.length < needle.length) return -1;
  const limit = Math.min(haystack.length - needle.length, maxScan);
  for (let i = 0; i <= limit; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * 智能探测文件内的 TIFF 标头基准偏移量 (0 或 JPEG APP1 内的 Exif\0\0 偏移)
 */
function detectTiffHeaderOffset(fullFileBytes) {
  if (!fullFileBytes || fullFileBytes.length < 8) return 0;

  // 1. 检查是否直接以 TIFF 头部开头 (RAW / ARW / DNG / TIFF)
  if (
    (fullFileBytes[0] === 0x49 && fullFileBytes[1] === 0x49 && fullFileBytes[2] === 42 && fullFileBytes[3] === 0) ||
    (fullFileBytes[0] === 0x4d && fullFileBytes[1] === 0x4d && fullFileBytes[2] === 0 && fullFileBytes[3] === 42)
  ) {
    return 0;
  }

  // 2. 检查 JPEG 中的 APP1 Exif 标记: "Exif\0\0" (0x45 0x78 0x69 0x66 0x00 0x00)
  const exifMarker = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  const exifPos = findBytes(fullFileBytes, exifMarker, 4096);
  if (exifPos >= 0) {
    return exifPos + 6;
  }

  // 3. 扫描前 4KB 查找 TIFF 标头
  const tiffLittle = new Uint8Array([0x49, 0x49, 42, 0]);
  const tiffBig = new Uint8Array([0x4d, 0x4d, 0, 42]);
  const posLittle = findBytes(fullFileBytes, tiffLittle, 4096);
  if (posLittle >= 0) return posLittle;
  const posBig = findBytes(fullFileBytes, tiffBig, 4096);
  if (posBig >= 0) return posBig;

  return 0;
}

/**
 * 依据 TIFF 标准基准偏移量解析相对指针
 */
function resolveTiffOffset(
  valOrOffset,
  count,
  bytes,
  mnTiffOffset,
  tiffHeaderOffset,
  fullFileBytes
) {
  // 1. 如果 valOrOffset 直接落在 bytes 内部 (如独立 MakerNote 缓冲区)
  if (valOrOffset + count <= bytes.length) {
    return bytes.subarray(valOrOffset, valOrOffset + count);
  }
  // 2. 如果 valOrOffset 是相对于 TIFF 标头的偏移，且在 bytes 的跨度范围内
  if (
    mnTiffOffset >= 0 &&
    valOrOffset >= mnTiffOffset &&
    valOrOffset - mnTiffOffset + count <= bytes.length
  ) {
    return bytes.subarray(valOrOffset - mnTiffOffset, valOrOffset - mnTiffOffset + count);
  }
  // 3. 如果 valOrOffset 是相对于 TIFF 标头的偏移，直接从全量文件字节中提取
  if (
    fullFileBytes &&
    tiffHeaderOffset >= 0 &&
    tiffHeaderOffset + valOrOffset + count <= fullFileBytes.length
  ) {
    return fullFileBytes.subarray(
      tiffHeaderOffset + valOrOffset,
      tiffHeaderOffset + valOrOffset + count
    );
  }
  return null;
}

/**
 * 结构化解析 MakerNote 二进制数据块
 */
export function parseMakerNoteData(
  makerNoteRaw,
  fullFileBytes,
  cameraModel,
  cameraMake,
  flatData
) {
  const result = {
    tags: [],
    parsedMap: {},
  };

  const model = (cameraModel || '').trim();
  const make = (cameraMake || '').trim().toLowerCase();

  let bytes = null;
  if (makerNoteRaw instanceof Uint8Array) {
    bytes = makerNoteRaw;
  } else if (makerNoteRaw instanceof ArrayBuffer) {
    bytes = new Uint8Array(makerNoteRaw);
  } else if (Array.isArray(makerNoteRaw)) {
    bytes = new Uint8Array(makerNoteRaw);
  }

  const isSony =
    make.includes('sony') ||
    model.toLowerCase().includes('ilce') ||
    model.toLowerCase().includes('slt-') ||
    model.toLowerCase().includes('nex-') ||
    (bytes && startsWithAscii(bytes, 'SONY'));

  const isNikon =
    make.includes('nikon') ||
    model.toLowerCase().includes('nikon') ||
    (bytes && startsWithAscii(bytes, 'Nikon'));

  const isCanon = make.includes('canon') || model.toLowerCase().includes('canon');

  const isFuji =
    make.includes('fujifilm') ||
    make.includes('fuji') ||
    (bytes && startsWithAscii(bytes, 'FUJIFILM'));

  const isPentax = make.includes('pentax') || make.includes('ricoh');

  const isOlympus =
    make.includes('olympus') ||
    make.includes('om digital') ||
    (bytes && (startsWithAscii(bytes, 'OLYMP') || startsWithAscii(bytes, 'OLYMPUS')));

  if (isSony) {
    result.maker = 'Sony';
    parseSonyMakerNote(bytes, fullFileBytes, model, result);
  }

  if (isNikon && bytes && bytes.length >= 16 && result.shutterCount === undefined) {
    result.maker = 'Nikon';
    parseNikonMakerNote(bytes, result);
  }

  if (isFuji && bytes && bytes.length >= 16 && result.shutterCount === undefined) {
    result.maker = 'Fujifilm';
    parseFujiMakerNote(bytes, result);
  }

  if (isCanon && bytes && bytes.length >= 14 && result.shutterCount === undefined) {
    result.maker = 'Canon';
    parseCanonMakerNote(bytes, fullFileBytes, result);
  }

  if (isOlympus && bytes && bytes.length >= 16 && result.shutterCount === undefined) {
    result.maker = 'Olympus';
    parseOlympusMakerNote(bytes, fullFileBytes, result);
  }

  if (isPentax && bytes && bytes.length >= 16 && result.shutterCount === undefined) {
    result.maker = 'Pentax';
    parsePentaxMakerNote(bytes, result);
  }

  // 兜底全字段模糊扫描快门相关键
  if (result.shutterCount === undefined && flatData) {
    for (const [k, v] of Object.entries(flatData)) {
      if (typeof v === 'number' && v > 0 && v < 50_000_000) {
        const lk = k.toLowerCase();
        if (
          lk === 'shuttercount' ||
          lk === 'imagecount' ||
          lk === 'totalshutterreleases' ||
          lk === 'mechanicalshuttercount' ||
          lk === 'shutteractuations'
        ) {
          result.shutterCount = v;
          result.tags.push({
            id: k,
            name: 'ShutterCount',
            value: v,
            rawValue: v,
            format: 'number',
            section: 'makerNote',
            description: `快门释放次数 (${k})`,
          });
          result.parsedMap.ShutterCount = v;
          break;
        }
      }
    }
  }

  if (result.shutterCount !== undefined) {
    result.parsedMap.ShutterCount = result.shutterCount;
    const hasShutterTag = result.tags.some((t) => t.name === 'ShutterCount');
    if (!hasShutterTag) {
      result.tags.unshift({
        id: 'ShutterCount',
        name: 'ShutterCount',
        value: result.shutterCount,
        rawValue: result.shutterCount,
        format: 'number',
        section: 'makerNote',
        description: '相机快门释放次数 / Shutter Actuations',
      });
    }
  }

  return result;
}

function startsWithAscii(bytes, str) {
  if (!bytes || bytes.length < str.length) return false;
  for (let i = 0; i < str.length; i++) {
    if (bytes[i] !== str.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * 索尼 MakerNote 与快门释放次数解析
 */
function parseSonyMakerNote(
  bytes,
  fullFileBytes,
  model,
  result
) {
  if (!bytes || bytes.length < 16) {
    // 若独立 MakerNote 丢失，尝试从全量文件中直接检索 Tag 0x9050
    if (fullFileBytes && fullFileBytes.length >= 0x1000) {
      searchSonyTag9050InFullFile(fullFileBytes, model, result);
    }
    return;
  }

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let ifdOffset = 0;
  if (
    startsWithAscii(bytes, 'SONY DSC ') ||
    startsWithAscii(bytes, 'SONY CAM ') ||
    startsWithAscii(bytes, 'SONY MOBILE')
  ) {
    ifdOffset = 12;
  } else if (
    bytes.length > 12 &&
    bytes[0] === 0 &&
    bytes[1] === 0 &&
    startsWithAscii(bytes.subarray(2), 'SONY PIC\0')
  ) {
    ifdOffset = 12;
  }

  if (ifdOffset + 2 > bytes.length) return;

  const tiffHeaderOffset = detectTiffHeaderOffset(fullFileBytes);
  let mnTiffOffset = -1;
  if (fullFileBytes && bytes.length >= 16) {
    const needleLen = Math.min(32, bytes.length);
    const mnFileOffset = findBytes(fullFileBytes, bytes.subarray(0, needleLen), fullFileBytes.length);
    if (mnFileOffset >= 0) {
      mnTiffOffset = mnFileOffset - tiffHeaderOffset;
    }
  }

  let isLittle = true;
  let numEntries = dv.getUint16(ifdOffset, true);
  if (numEntries === 0 || numEntries > 1000) {
    const bigEntries = dv.getUint16(ifdOffset, false);
    if (bigEntries > 0 && bigEntries <= 500) {
      numEntries = bigEntries;
      isLittle = false;
    }
  }

  let tag9050Data = null;

  if (numEntries > 0 && numEntries < 600) {
    for (let i = 0; i < numEntries; i++) {
      const entryPos = ifdOffset + 2 + i * 12;
      if (entryPos + 12 > bytes.length) break;

      const tag = dv.getUint16(entryPos, isLittle);
      const count = dv.getUint32(entryPos + 4, isLittle);
      const valOrOffset = dv.getUint32(entryPos + 8, isLittle);

      // Tag 0x9050: Sony 核心加密块
      if (tag === 0x9050 && count >= 32) {
        tag9050Data = resolveTiffOffset(
          valOrOffset,
          count,
          bytes,
          mnTiffOffset,
          tiffHeaderOffset,
          fullFileBytes
        );
      }

      // Tag 0x0846 (早期机型 A230/330/380/850/900)
      if (tag === 0x0846 && result.shutterCount === undefined) {
        const val = valOrOffset & 0x00ffffff;
        if (val > 0 && val < 50_000_000) result.shutterCount = val;
      }

      // Tag 0x0125 / 0x014a (A450/500/550 等)
      if ((tag === 0x0125 || tag === 0x014a) && result.shutterCount === undefined) {
        const val = valOrOffset & 0x00ffffff;
        if (val > 0 && val < 50_000_000) result.shutterCount = val;
      }
    }
  }

  // 兜底特征码扫描 Tag 0x9050
  if (!tag9050Data && bytes.length >= 100) {
    for (let pos = 0; pos <= bytes.length - 12; pos += 2) {
      if (bytes[pos] === 0x50 && bytes[pos + 1] === 0x90) {
        const type = dv.getUint16(pos + 2, true);
        const count = dv.getUint32(pos + 4, true);
        const offset = dv.getUint32(pos + 8, true);
        if (type === 7 && count >= 32 && count < 65536) {
          const resolved = resolveTiffOffset(
            offset,
            count,
            bytes,
            mnTiffOffset,
            tiffHeaderOffset,
            fullFileBytes
          );
          if (resolved) {
            tag9050Data = resolved;
            break;
          }
        }
      }
    }
  }

  // 全文件搜索兜底
  if (!tag9050Data && fullFileBytes) {
    searchSonyTag9050InFullFile(fullFileBytes, model, result);
    return;
  }

  // 解密并计算快门数
  if (tag9050Data && tag9050Data.length >= 16) {
    const dec = decipherSony(tag9050Data);

    let shutterCount;

    // 机型精准分段判定 (与 ExifTool Image::ExifTool::Sony 映射一致):
    // 1. Gen 4 (Tag9050d):
    //    A7C II (ILCE-7CM2), A7CR, A6700, A1 II, A7 V, FX2, ZV-E1, ZV-E10M2 等
    //    快门数位于 offset 10 (0x000a)，前 6~10 个字节特征为全 0
    const hasGen4NullPrefix =
      dec.length >= 14 &&
      dec[0] === 0 &&
      dec[1] === 0 &&
      dec[2] === 0 &&
      dec[3] === 0 &&
      dec[4] === 0 &&
      dec[5] === 0;

    const isGen4 =
      /ILCE-(1M2|6700|7CM2|7CR|7M5)|ILME-FX2|ZV-(E1\b|E10M2)|A7C\s*II|A7CR|A6700/i.test(model) ||
      hasGen4NullPrefix;

    // 2. Gen 2/3 (Tag9050b / Tag9050c):
    //    A7 III, A7 IV, A7R III, A7R IV, A7R V, A7S III, A1, A9, A9 II, A7C, A6100, A6300, A6400, A6500, A6600, FX3, ZV-E10 等
    //    快门数位于 offset 58 (0x003a)
    const isGen2or3 =
      /ILCE-(1\b|6100|6300|6400|6500|6600|7C\b|7M3|7M4|7RM2|7RM3|7RM4|7RM5|7SM2|7SM3|9\b|9M2)|ILME-FX3|ILCA-99M2|ZV-E10\b/i.test(model);

    // 3. Gen 1 (Tag9050a):
    //    A7, A7R, A7S, A7 II, A6000, A5000, A5100, QX1, 3000, 3500, SLT, NEX 系列
    //    快门数位于 offset 50 (0x0032)
    const isGen1 =
      /ILCE-(7\b|7R\b|7S\b|7M2|[356]000|5100|QX1)|SLT-|NEX-/i.test(model);

    if (isGen4 && dec.length >= 14) {
      shutterCount = readUint32LE(dec, 10) & 0x00ffffff;
    } else if (isGen2or3 && dec.length >= 62) {
      shutterCount = readUint32LE(dec, 58) & 0x00ffffff;
    } else if (isGen1 && dec.length >= 54) {
      shutterCount = readUint32LE(dec, 50) & 0x00ffffff;
    }

    // 兜底自适应扫描：如果不匹配或解析出的快门为 0 / 异常高数值
    if (!shutterCount || shutterCount <= 0 || shutterCount > 5_000_000) {
      if (hasGen4NullPrefix && dec.length >= 14) {
        const val10 = readUint32LE(dec, 10) & 0x00ffffff;
        if (val10 > 0 && val10 < 5_000_000) shutterCount = val10;
      }
      if (!shutterCount || shutterCount <= 0 || shutterCount > 5_000_000) {
        for (const off of [58, 50, 10]) {
          if (dec.length >= off + 4) {
            const val = readUint32LE(dec, off) & 0x00ffffff;
            if (val > 0 && val < 5_000_000) {
              shutterCount = val;
              break;
            }
          }
        }
      }
    }

    if (shutterCount !== undefined && shutterCount > 0 && shutterCount < 50_000_000) {
      result.shutterCount = shutterCount;
      result.tags.push({
        id: 'SonyTag9050_ShutterCount',
        name: 'ShutterCount',
        value: shutterCount,
        rawValue: shutterCount,
        format: 'number',
        section: 'makerNote',
        description: '索尼微单硬件快门释放次数 (Tag9050 解密)',
      });
      result.parsedMap.SonyShutterCount = shutterCount;
    }
  }
}

/**
 * 全量文件中扫描索尼 Tag 0x9050 (用于 exifr 丢失 MakerNote 时的深度恢复)
 */
function searchSonyTag9050InFullFile(fullFileBytes, model, result) {
  const maxScan = Math.min(fullFileBytes.length - 12, 0x100000); // 检索前 1MB
  const dv = new DataView(fullFileBytes.buffer, fullFileBytes.byteOffset, fullFileBytes.byteLength);

  for (let i = 0x100; i < maxScan; i += 2) {
    if (fullFileBytes[i] === 0x50 && fullFileBytes[i + 1] === 0x90) {
      const type = dv.getUint16(i + 2, true);
      const count = dv.getUint32(i + 4, true);
      const offset = dv.getUint32(i + 8, true);

      if (type === 7 && count >= 32 && count < 65536 && offset > 0 && offset + count <= fullFileBytes.length) {
        const raw9050 = fullFileBytes.subarray(offset, offset + count);
        const dec = decipherSony(raw9050);

        let shutter;
        if (/ILCE-(1M2|6700|7CM2|7CR|7M5)|ZV-(E1\b|E10M2)/i.test(model) && dec.length >= 14) {
          shutter = readUint32LE(dec, 10) & 0x00ffffff;
        } else if (dec.length >= 62) {
          shutter = readUint32LE(dec, 58) & 0x00ffffff;
        }

        if (!shutter || shutter <= 0 || shutter > 5_000_000) {
          for (const off of [58, 50, 10]) {
            if (dec.length >= off + 4) {
              const val = readUint32LE(dec, off) & 0x00ffffff;
              if (val > 0 && val < 5_000_000) {
                shutter = val;
                break;
              }
            }
          }
        }

        if (shutter && shutter > 0 && shutter < 50_000_000) {
          result.shutterCount = shutter;
          result.tags.push({
            id: 'SonyTag9050_ShutterCount',
            name: 'ShutterCount',
            value: shutter,
            rawValue: shutter,
            format: 'number',
            section: 'makerNote',
            description: '索尼硬件快门释放次数 (全量特征匹配 Tag9050)',
          });
          result.parsedMap.SonyShutterCount = shutter;
          return;
        }
      }
    }
  }
}

/**
 * 尼康 MakerNote 解析
 */
function parseNikonMakerNote(bytes, result) {
  let tiffBase = 0;
  let ifdOffset = 0;
  let isLittle = true;

  if (startsWithAscii(bytes, 'Nikon\0\x02')) {
    tiffBase = 10;
    if (bytes.length < tiffBase + 8) return;
    isLittle = bytes[tiffBase] === 0x49;
    const dvTiff = new DataView(bytes.buffer, bytes.byteOffset + tiffBase, bytes.byteLength - tiffBase);
    const ifdRelOffset = dvTiff.getUint32(4, isLittle);
    ifdOffset = tiffBase + ifdRelOffset;
  } else if (startsWithAscii(bytes, 'Nikon\0\x01')) {
    ifdOffset = 8;
    isLittle = true;
  } else {
    ifdOffset = 0;
    isLittle = bytes[0] === 0x49;
  }

  if (ifdOffset + 2 > bytes.length) return;

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numEntries = dv.getUint16(ifdOffset, isLittle);
  if (numEntries <= 0 || numEntries > 1000) return;

  for (let i = 0; i < numEntries; i++) {
    const entryPos = ifdOffset + 2 + i * 12;
    if (entryPos + 12 > bytes.length) break;

    const tag = dv.getUint16(entryPos, isLittle);
    const type = dv.getUint16(entryPos + 2, isLittle);
    const valOrOffset = dv.getUint32(entryPos + 8, isLittle);

    // 0x00A7 (167): Nikon ShutterCount
    if (tag === 0x00a7) {
      let countVal;
      if (type === 3) {
        countVal = dv.getUint16(entryPos + 8, isLittle);
      } else {
        countVal = valOrOffset;
      }
      if (countVal > 0 && countVal < 50_000_000) {
        result.shutterCount = countVal;
        result.tags.push({
          id: 'Nikon_0x00a7',
          name: 'ShutterCount',
          value: countVal,
          rawValue: countVal,
          format: 'number',
          section: 'makerNote',
          description: '尼康快门释放总次数 (Nikon ShutterCount)',
        });
        result.parsedMap.NikonShutterCount = countVal;
      }
    }

    // 0x0037: Nikon MechanicalShutterCount
    if (tag === 0x0037) {
      if (valOrOffset > 0 && valOrOffset < 50_000_000) {
        result.mechanicalShutterCount = valOrOffset;
        result.tags.push({
          id: 'Nikon_0x0037',
          name: 'MechanicalShutterCount',
          value: valOrOffset,
          rawValue: valOrOffset,
          format: 'number',
          section: 'makerNote',
          description: '尼康机械快门释放次数',
        });
      }
    }
  }
}

/**
 * 富士胶片 MakerNote 解析
 */
function parseFujiMakerNote(bytes, result) {
  if (!startsWithAscii(bytes, 'FUJIFILM') || bytes.length < 16) return;

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ifdOffset = dv.getUint32(8, true);
  if (ifdOffset + 2 > bytes.length) return;

  const numEntries = dv.getUint16(ifdOffset, true);
  if (numEntries <= 0 || numEntries > 1000) return;

  for (let i = 0; i < numEntries; i++) {
    const entryPos = ifdOffset + 2 + i * 12;
    if (entryPos + 12 > bytes.length) break;

    const tag = dv.getUint16(entryPos, true);
    const valOrOffset = dv.getUint32(entryPos + 8, true);

    if (tag === 0x1438) {
      if (valOrOffset > 0 && valOrOffset < 50_000_000) {
        result.shutterCount = valOrOffset;
        result.tags.push({
          id: 'Fuji_0x1438',
          name: 'ShutterCount',
          value: valOrOffset,
          rawValue: valOrOffset,
          format: 'number',
          section: 'makerNote',
          description: '富士拍摄快门张数 (ImageCount)',
        });
        result.parsedMap.FujiImageCount = valOrOffset;
      }
    }
  }
}

/**
 * 佳能 MakerNote 解析
 */
function parseCanonMakerNote(bytes, _fullFileBytes, result) {
  if (bytes.length < 14) return;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isLittle = bytes[0] !== 0x4d;
  const numEntries = dv.getUint16(0, isLittle);

  if (numEntries <= 0 || numEntries > 1000) return;

  for (let i = 0; i < numEntries; i++) {
    const entryPos = 2 + i * 12;
    if (entryPos + 12 > bytes.length) break;

    const tag = dv.getUint16(entryPos, isLittle);
    const valOrOffset = dv.getUint32(entryPos + 8, isLittle);

    if (
      (tag === 0x0093 || tag === 0x00a0 || tag === 0x0af1 || tag === 0x0d29 || tag === 0x0293 || tag === 0x4015) &&
      valOrOffset > 0 &&
      valOrOffset < 50_000_000
    ) {
      result.shutterCount = valOrOffset;
      result.tags.push({
        id: `Canon_0x${tag.toString(16)}`,
        name: 'ShutterCount',
        value: valOrOffset,
        rawValue: valOrOffset,
        format: 'number',
        section: 'makerNote',
        description: '佳能相机快门释放次数',
      });
      result.parsedMap.CanonShutterCount = valOrOffset;
      break;
    }
  }
}

/**
 * 奥林巴斯 MakerNote 解析
 */
function parseOlympusMakerNote(bytes, _fullFileBytes, result) {
  let ifdOffset = 0;
  if (startsWithAscii(bytes, 'OLYMP\0') || startsWithAscii(bytes, 'OLYMPUS\0')) {
    ifdOffset = startsWithAscii(bytes, 'OLYMP\0') ? 8 : 12;
  }
  if (ifdOffset + 2 > bytes.length) return;

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isLittle = bytes[ifdOffset] !== 0x4d;
  const numEntries = dv.getUint16(ifdOffset, isLittle);
  if (numEntries <= 0 || numEntries > 1000) return;

  for (let i = 0; i < numEntries; i++) {
    const entryPos = ifdOffset + 2 + i * 12;
    if (entryPos + 12 > bytes.length) break;
    const tag = dv.getUint16(entryPos, isLittle);
    const valOrOffset = dv.getUint32(entryPos + 8, isLittle);

    if (tag === 0x0a00 && valOrOffset > 0 && valOrOffset < 50_000_000) {
      result.shutterCount = valOrOffset;
      result.tags.push({
        id: 'Olympus_0x0a00',
        name: 'ShutterCount',
        value: valOrOffset,
        rawValue: valOrOffset,
        format: 'number',
        section: 'makerNote',
        description: '奥林巴斯快门释放次数',
      });
      result.parsedMap.OlympusShutterCount = valOrOffset;
    }
  }
}

/**
 * 宾得 MakerNote 解析
 */
function parsePentaxMakerNote(bytes, result) {
  let ifdOffset = 0;
  if (startsWithAscii(bytes, 'PENTAX \0')) {
    ifdOffset = 8;
  }
  if (ifdOffset + 2 > bytes.length) return;

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isLittle = bytes[ifdOffset] !== 0x4d;
  const numEntries = dv.getUint16(ifdOffset, isLittle);
  if (numEntries <= 0 || numEntries > 1000) return;

  for (let i = 0; i < numEntries; i++) {
    const entryPos = ifdOffset + 2 + i * 12;
    if (entryPos + 12 > bytes.length) break;
    const tag = dv.getUint16(entryPos, isLittle);
    const valOrOffset = dv.getUint32(entryPos + 8, isLittle);

    if (tag === 0x005d && valOrOffset > 0 && valOrOffset < 50_000_000) {
      result.shutterCount = valOrOffset;
      result.tags.push({
        id: 'Pentax_0x005d',
        name: 'ShutterCount',
        value: valOrOffset,
        rawValue: valOrOffset,
        format: 'number',
        section: 'makerNote',
        description: '宾得快门释放次数',
      });
      result.parsedMap.PentaxShutterCount = valOrOffset;
    }
  }
}

