/**
 * ARW Embedded JPEG Preview & Full-Resolution Master Extractor
 * 索尼 ARW 原始文件内嵌高清预览图与超清全画幅底片极速提取模块
 * 
 * 索尼相机 (A7C2, A7M4, A7R5, A7S3, A6700, ZV-E1 等) 在 ARW 头部内嵌：
 * 1. IFD1: 160x120 EXIF 极小缩略图 (~6KB)
 * 2. IFD0: 1616x1080 HD 高清交互预览图 (~100KB - 800KB) -> 用于 60FPS 实时丝滑交互
 * 3. IFD2: 7008x4672 (或机身原生 3300万/6100万像素) 全画幅超高清原底 (~1.5MB - 12MB) -> 用于最终超高清直出
 */

/**
 * 解析 TIFF IFD 链条中所有内嵌 JPEG 的元数据
 * @param {Uint8Array} buf ARW 文件头部数据 (推荐 512KB)
 * @returns {Array<{ width: number, height: number, offset: number, length: number }>}
 */
export function parseTiffJpegs(buf) {
  if (!buf || buf.length < 16) return [];
  const isLe = (buf[0] === 0x49 && buf[1] === 0x49); // 'II' = Little Endian
  
  const u16 = (off) => {
    if (off + 2 > buf.length) return 0;
    return isLe ? (buf[off] | (buf[off + 1] << 8)) : ((buf[off] << 8) | buf[off + 1]);
  };
  
  const u32 = (off) => {
    if (off + 4 > buf.length) return 0;
    return isLe
      ? ((buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0)
      : (((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0);
  };

  const firstIfd = u32(4);
  const visited = new Set();
  const queue = [firstIfd];
  const jpegs = [];

  while (queue.length > 0) {
    const off = queue.shift();
    if (visited.has(off) || off + 2 > buf.length) continue;
    visited.add(off);

    const cnt = u16(off);
    let curr = off + 2;
    let w = 0, h = 0, jOff = 0, jLen = 0;

    for (let i = 0; i < cnt; i++) {
      if (curr + 12 > buf.length) break;
      const tag = u16(curr);
      const typ = u16(curr + 2);
      const c = u32(curr + 4);
      const val = typ === 4 ? u32(curr + 8) : (typ === 3 ? u16(curr + 8) : 0);
      curr += 12;

      if (tag === 0x0100) w = val; // ImageWidth
      else if (tag === 0x0101) h = val; // ImageHeight
      else if (tag === 0x0201) jOff = val; // JPEGInterchangeFormat
      else if (tag === 0x0202) jLen = val; // JPEGInterchangeFormatLength
      else if (tag === 0x014a) { // SubIFDs
        if (c === 1) queue.push(val);
        else if (c > 1 && val + c * 4 <= buf.length) {
          for (let k = 0; k < c; k++) queue.push(u32(val + k * 4));
        }
      }
    }

    if (jOff > 0 && jLen > 0) {
      jpegs.push({ width: w, height: h, offset: jOff, length: jLen });
    }

    if (curr + 4 <= buf.length) {
      const nextIfd = u32(curr);
      if (nextIfd > 0) queue.push(nextIfd);
    }
  }

  return jpegs;
}

/**
 * 从 JPEG 数据头部读取 SOF 尺寸 (宽高)
 * @param {Uint8Array} buf
 * @returns {{ width: number, height: number }}
 */
export function getJpegDimensions(buf) {
  if (!buf || buf.length < 9) return { width: 0, height: 0 };
  const maxScan = Math.min(buf.length - 8, 4096);
  for (let i = 0; i < maxScan; i++) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc1 || buf[i + 1] === 0xc2)) {
      const height = (buf[i + 5] << 8) | buf[i + 6];
      const width = (buf[i + 7] << 8) | buf[i + 8];
      return { width, height };
    }
  }
  return { width: 0, height: 0 };
}

/**
 * 在二进制 Buffer / Uint8Array 中扫描定位内嵌 JPEG (后备扫描方案)
 * @param {Uint8Array} buf 
 * @returns {Uint8Array | null}
 */
export function extractEmbeddedJpeg(buf) {
  if (!buf || buf.length < 100) return null;

  const len = buf.length;
  let pos = 0;
  let bestJpeg = null;
  let bestLen = 0;

  // 扫描 JPEG 起始标记 0xFF 0xD8 0xFF
  while (pos < len - 3) {
    if (buf[pos] === 0xff && buf[pos + 1] === 0xd8 && buf[pos + 2] === 0xff) {
      // 寻找对应的结束标记 0xFF 0xD9
      let end = -1;
      for (let j = pos + 2; j < len - 1; j++) {
        if (buf[j] === 0xff && buf[j + 1] === 0xd9) {
          end = j;
          break;
        }
      }

      if (end > pos) {
        const jpegLen = end + 2 - pos;
        if (jpegLen >= 50 * 1024 && jpegLen <= 2.5 * 1024 * 1024) {
          return buf.subarray(pos, end + 2);
        }
        if (jpegLen > bestLen) {
          bestLen = jpegLen;
          bestJpeg = buf.subarray(pos, end + 2);
        }
        pos = end + 2;
        continue;
      }
    }
    pos++;
  }

  return bestJpeg;
}

/**
 * 从 File / Blob 或 ArrayBuffer 中切片提取高清预览图 (~1616x1080)
 * 用于照片卡片缩略图与调色室 60FPS 实时丝滑交互
 * @param {File | Blob | ArrayBuffer | Uint8Array} fileOrBuffer
 * @returns {Promise<Uint8Array | null>}
 */
export async function extractPreviewFromArw(fileOrBuffer) {
  try {
    let headerBuf;
    if (fileOrBuffer instanceof Blob || (typeof File !== 'undefined' && fileOrBuffer instanceof File)) {
      const slice = fileOrBuffer.slice(0, 512 * 1024);
      headerBuf = new Uint8Array(await slice.arrayBuffer());
    } else if (fileOrBuffer instanceof ArrayBuffer) {
      headerBuf = new Uint8Array(fileOrBuffer.slice(0, Math.min(fileOrBuffer.byteLength, 512 * 1024)));
    } else if (fileOrBuffer instanceof Uint8Array) {
      headerBuf = fileOrBuffer.subarray(0, Math.min(fileOrBuffer.length, 512 * 1024));
    } else {
      return null;
    }

    const jpegs = parseTiffJpegs(headerBuf);
    if (jpegs.length > 0) {
      // 筛选出适合作为快速预览的中等尺寸 JPEG (50KB ~ 1.5MB)
      const previewJpegs = jpegs.filter(
        (j) => j.length >= 50 * 1024 && (j.width < 2500 || j.length < 1.5 * 1024 * 1024)
      );
      if (previewJpegs.length > 0) {
        previewJpegs.sort((a, b) => b.length - a.length);
        const target = previewJpegs[0];
        if (fileOrBuffer instanceof Blob || (typeof File !== 'undefined' && fileOrBuffer instanceof File)) {
          const slice = fileOrBuffer.slice(target.offset, target.offset + target.length);
          return new Uint8Array(await slice.arrayBuffer());
        } else if (fileOrBuffer instanceof ArrayBuffer) {
          return new Uint8Array(fileOrBuffer, target.offset, target.length);
        } else if (fileOrBuffer instanceof Uint8Array) {
          return fileOrBuffer.subarray(target.offset, target.offset + target.length);
        }
      }
    }

    // 后备：通过原始标记搜索前 4MB
    let sliceBuf;
    if (fileOrBuffer instanceof Blob || (typeof File !== 'undefined' && fileOrBuffer instanceof File)) {
      const slice = fileOrBuffer.slice(0, 4 * 1024 * 1024);
      sliceBuf = new Uint8Array(await slice.arrayBuffer());
    } else {
      sliceBuf = headerBuf;
    }
    return extractEmbeddedJpeg(sliceBuf);
  } catch (err) {
    console.warn('[previewExtractor] 提取预览图失败:', err);
    return null;
  }
}

/**
 * 从 File / Blob 或 ArrayBuffer 中切片提取机身全画幅超高清原底 JPEG (如 7008x4672, ~3300万像素)
 * 用于最终超高清出片，画质 100% 媲美相机机身直出或 Imaging Edge Edit
 * @param {File | Blob | ArrayBuffer | Uint8Array} fileOrBuffer
 * @returns {Promise<{ bytes: Uint8Array, width: number, height: number } | null>}
 */
export async function extractFullResJpegFromArw(fileOrBuffer) {
  try {
    let headerBuf;
    if (fileOrBuffer instanceof Blob || (typeof File !== 'undefined' && fileOrBuffer instanceof File)) {
      const slice = fileOrBuffer.slice(0, 512 * 1024);
      headerBuf = new Uint8Array(await slice.arrayBuffer());
    } else if (fileOrBuffer instanceof ArrayBuffer) {
      headerBuf = new Uint8Array(fileOrBuffer.slice(0, Math.min(fileOrBuffer.byteLength, 512 * 1024)));
    } else if (fileOrBuffer instanceof Uint8Array) {
      headerBuf = fileOrBuffer.subarray(0, Math.min(fileOrBuffer.length, 512 * 1024));
    } else {
      return null;
    }

    const jpegs = parseTiffJpegs(headerBuf);

    if (jpegs.length > 0) {
      // 优先按面积 (width * height) 排序，面积相同按 length 排序
      jpegs.sort((a, b) => {
        const areaA = a.width * a.height;
        const areaB = b.width * b.height;
        if (areaB !== areaA) return areaB - areaA;
        return b.length - a.length;
      });

      const best = jpegs[0];
      // 如果找到了大于 2000px 或大于 1MB 的超高清原底
      if (best.width > 2000 || best.length > 1024 * 1024) {
        let fullBytes;
        if (fileOrBuffer instanceof Blob || (typeof File !== 'undefined' && fileOrBuffer instanceof File)) {
          const slice = fileOrBuffer.slice(best.offset, best.offset + best.length);
          fullBytes = new Uint8Array(await slice.arrayBuffer());
        } else if (fileOrBuffer instanceof ArrayBuffer) {
          fullBytes = new Uint8Array(fileOrBuffer, best.offset, best.length);
        } else if (fileOrBuffer instanceof Uint8Array) {
          fullBytes = fileOrBuffer.subarray(best.offset, best.offset + best.length);
        }

        if (fullBytes && fullBytes.length > 0) {
          let { width, height } = best;
          if (!width || !height) {
            const dims = getJpegDimensions(fullBytes);
            width = dims.width;
            height = dims.height;
          }
          return { bytes: fullBytes, width, height };
        }
      }
    }

    // 后备方案：退化为提取可用预览图
    const preview = await extractPreviewFromArw(fileOrBuffer);
    if (preview) {
      const dims = getJpegDimensions(preview);
      return { bytes: preview, width: dims.width, height: dims.height };
    }

    return null;
  } catch (err) {
    console.warn('[previewExtractor] 提取超高清原底失败:', err);
    return null;
  }
}

/**
 * 将提取到的 JPEG Uint8Array 封装为浏览器可显示的 Blob URL
 * @param {Uint8Array} jpegBytes 
 * @returns {string | null}
 */
export function createJpegObjectUrl(jpegBytes) {
  if (!jpegBytes || jpegBytes.length === 0) return null;
  const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}
