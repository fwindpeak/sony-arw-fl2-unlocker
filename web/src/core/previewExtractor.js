/**
 * ARW Embedded JPEG Preview & Metadata Extractor
 * 索尼 ARW 原始文件内嵌高清预览图与 EXIF 方向 / 尺寸极速解析模块
 */

/**
 * 解析 TIFF IFD 链条中所有内嵌 JPEG 的元数据及主方向 (Orientation)
 * @param {Uint8Array} buf ARW 文件头部数据 (推荐 512KB)
 * @returns {{ jpegs: Array<{ width: number, height: number, offset: number, length: number }>, orientation: number }}
 */
export function parseTiffMetadata(buf) {
  if (!buf || buf.length < 16) return { jpegs: [], orientation: 1 };
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
  let mainOrientation = 1;

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
      else if (tag === 0x0112) {
        // Orientation: 1 = 正常, 3 = 180°, 6 = 顺时针90°(竖向), 8 = 逆时针90°(竖向)
        if (val >= 1 && val <= 8) {
          if (val > 1 || mainOrientation === 1) {
            mainOrientation = val;
          }
        }
      }
      else if (tag === 0x0201) jOff = val; // JPEGInterchangeFormat
      else if (tag === 0x0202) jLen = val; // JPEGInterchangeFormatLength
      else if (tag === 0x014a) { // SubIFDs
        if (c === 1) queue.push(val);
        else if (c > 1 && val + c * 4 <= buf.length) {
          for (let k = 0; k < c; k++) queue.push(u32(val + k * 4));
        }
      }
      else if (tag === 0x8769) { // ExifIFDPointer
        if (val > 0 && val < buf.length) {
          queue.push(val);
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

  return { jpegs, orientation: mainOrientation };
}

/**
 * 兼容原有函数：解析 TIFF IFD 链条中所有内嵌 JPEG 的元数据
 */
export function parseTiffJpegs(buf) {
  return parseTiffMetadata(buf).jpegs;
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
 * 从 JPEG 数据头部解析 APP1 EXIF 中的 Orientation (方向)
 * @param {Uint8Array} buf
 * @returns {number} 1~8 (默认 1)
 */
export function getJpegExifOrientation(buf) {
  if (!buf || buf.length < 32) return 1;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
  let offset = 2;
  const len = Math.min(buf.length, 64 * 1024); // 扫描前 64KB APP1
  while (offset < len - 4) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    if (marker === 0xda || marker === 0xd9) break; // SOS 或 EOI 终止
    const segLen = (buf[offset + 2] << 8) | buf[offset + 3];
    if (segLen < 2) break;

    // APP1 Marker (0xFFE1)
    if (marker === 0xe1 && offset + 14 <= len) {
      if (
        buf[offset + 4] === 0x45 && // 'E'
        buf[offset + 5] === 0x78 && // 'x'
        buf[offset + 6] === 0x69 && // 'i'
        buf[offset + 7] === 0x66 && // 'f'
        buf[offset + 8] === 0x00 &&
        buf[offset + 9] === 0x00
      ) {
        const tiffStart = offset + 10;
        if (tiffStart + 8 <= len) {
          const isLe = buf[tiffStart] === 0x49 && buf[tiffStart + 1] === 0x49;
          const u16 = (o) => isLe ? (buf[o] | (buf[o + 1] << 8)) : ((buf[o] << 8) | buf[o + 1]);
          const u32 = (o) => isLe
            ? ((buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)) >>> 0)
            : (((buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]) >>> 0);

          const ifdOffset = u32(tiffStart + 4);
          let curr = tiffStart + ifdOffset;
          if (curr + 2 <= len) {
            const count = u16(curr);
            curr += 2;
            for (let i = 0; i < count; i++) {
              if (curr + 12 > len) break;
              const tag = u16(curr);
              if (tag === 0x0112) {
                const val = u16(curr + 8);
                if (val >= 1 && val <= 8) return val;
              }
              curr += 12;
            }
          }
        }
      }
    }
    offset += 2 + segLen;
  }
  return 1;
}

/**
 * 根据原始物理尺寸与 EXIF Orientation 计算出真实视觉方向与比例信息
 * @param {number} rawWidth
 * @param {number} rawHeight
 * @param {number} exifOrientation
 * @returns {{
 *   rawWidth: number,
 *   rawHeight: number,
 *   visualWidth: number,
 *   visualHeight: number,
 *   isPortrait: boolean,
 *   orientation: 'portrait' | 'landscape' | 'square',
 *   ratioTag: string,
 *   label: string,
 *   rotationDeg: number,
 *   exifOrientation: number
 * }}
 */
export function computeOrientationInfo(rawWidth, rawHeight, exifOrientation = 1) {
  // EXIF 5, 6, 7, 8 表示顺时针/逆时针旋转了 90°，在最终视觉显示中宽高对调
  const isRotated90 = [5, 6, 7, 8].includes(exifOrientation);
  const visualWidth = isRotated90 ? rawHeight : rawWidth;
  const visualHeight = isRotated90 ? rawWidth : rawHeight;

  const isPortrait = visualHeight > visualWidth;
  const isSquare = visualHeight === visualWidth && visualWidth > 0;
  const orientation = isSquare ? 'square' : (isPortrait ? 'portrait' : 'landscape');

  let ratioTag = '';
  if (visualWidth > 0 && visualHeight > 0) {
    const ratio = visualWidth / visualHeight;
    if (Math.abs(ratio - 1.5) < 0.08) ratioTag = '3:2';
    else if (Math.abs(ratio - 0.667) < 0.08) ratioTag = '2:3';
    else if (Math.abs(ratio - 1.333) < 0.08) ratioTag = '4:3';
    else if (Math.abs(ratio - 0.75) < 0.08) ratioTag = '3:4';
    else if (Math.abs(ratio - 1.777) < 0.08) ratioTag = '16:9';
    else if (Math.abs(ratio - 0.562) < 0.08) ratioTag = '9:16';
    else if (Math.abs(ratio - 1.0) < 0.05) ratioTag = '1:1';
    else {
      ratioTag = isPortrait
        ? `${(visualHeight / visualWidth).toFixed(1)}:1`
        : `${(visualWidth / visualHeight).toFixed(1)}:1`;
    }
  }

  let rotationDeg = 0;
  if (exifOrientation === 3) rotationDeg = 180;
  else if (exifOrientation === 6) rotationDeg = 90;
  else if (exifOrientation === 8) rotationDeg = 270;

  return {
    rawWidth,
    rawHeight,
    visualWidth,
    visualHeight,
    isPortrait,
    orientation,
    ratioTag,
    label: isPortrait ? '纵向' : (isSquare ? '正方' : '横向'),
    rotationDeg,
    exifOrientation,
  };
}

/**
 * 当 Image 元素加载完成时，权威识别视觉宽高与方向
 * @param {HTMLImageElement} img
 * @param {number} [fallbackOrientation=1]
 */
export function detectImageOrientation(img, fallbackOrientation = 1) {
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  return computeOrientationInfo(w, h, fallbackOrientation);
}

/**
 * 根据 EXIF Orientation 将未旋转的 JPEG 字节纠正旋转为真正物理朝向正确的图像 Blob URL
 * 确保外层列表卡片在任何浏览器下都能直接呈现端正的直立人像或风景
 * @param {Uint8Array} jpegBytes 原始未旋转 JPEG 字节
 * @param {number} orientation EXIF 方向 (1~8)
 * @returns {Promise<string>}
 */
export async function createOrientedJpegUrl(jpegBytes, orientation = 1) {
  if (!jpegBytes || jpegBytes.length === 0) return null;
  const rawBlob = new Blob([jpegBytes], { type: 'image/jpeg' });

  // 如果方向正常 (<=1)，无需通过 Canvas 重绘，直接创建 URL
  if (!orientation || orientation <= 1) {
    return URL.createObjectURL(rawBlob);
  }

  try {
    const rawUrl = URL.createObjectURL(rawBlob);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = rawUrl;
    });
    URL.revokeObjectURL(rawUrl);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return URL.createObjectURL(rawBlob);

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    // 旋转 90 或 270 度时，画布宽高对调
    if ([5, 6, 7, 8].includes(orientation)) {
      canvas.width = height;
      canvas.height = width;
    } else {
      canvas.width = width;
      canvas.height = height;
    }

    // 依 EXIF 规范施加对应坐标变换
    switch (orientation) {
      case 2: // 水平镜像
        ctx.transform(-1, 0, 0, 1, width, 0);
        break;
      case 3: // 顺时针 180°
        ctx.transform(-1, 0, 0, -1, width, height);
        break;
      case 4: // 垂直翻转
        ctx.transform(1, 0, 0, -1, 0, height);
        break;
      case 5: // 垂直翻转 + 顺时针 90°
        ctx.transform(0, 1, 1, 0, 0, 0);
        break;
      case 6: // 顺时针 90° (索尼机身最常见的竖拍人像方向)
        ctx.transform(0, 1, -1, 0, height, 0);
        break;
      case 7: // 水平翻转 + 顺时针 90°
        ctx.transform(0, -1, -1, 0, height, width);
        break;
      case 8: // 逆时针 90° (顺时针 270°)
        ctx.transform(0, -1, 1, 0, 0, width);
        break;
      default:
        break;
    }

    ctx.drawImage(img, 0, 0);

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          resolve(URL.createObjectURL(rawBlob));
        }
      }, 'image/jpeg', 0.92);
    });
  } catch (err) {
    console.warn('[previewExtractor] 旋转校正异常，退回原图:', err);
    return URL.createObjectURL(rawBlob);
  }
}

/**
 * 在二进制 Buffer 中扫描定位内嵌 JPEG (后备扫描方案)
 * @param {Uint8Array} buf 
 * @returns {Uint8Array | null}
 */
export function extractEmbeddedJpeg(buf) {
  if (!buf || buf.length < 100) return null;

  const len = buf.length;
  let pos = 0;
  let bestJpeg = null;
  let bestLen = 0;

  while (pos < len - 3) {
    if (buf[pos] === 0xff && buf[pos + 1] === 0xd8 && buf[pos + 2] === 0xff) {
      let end = -1;
      for (let j = pos + 2; j < len - 1; j++) {
        if (buf[j] === 0xff && buf[j + 1] === 0xd9) {
          end = j;
          break;
        }
      }

      if (end > pos) {
        const jpegLen = end + 2 - pos;
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
 * 完整提取预览图与方向元数据
 * 优先提取 ARW 内部全尺寸高清/全像素内嵌 JPEG (如 7008x4672，几兆大小)
 * 同时提供轻量预览 bytes 供网页极速流畅渲染
 * @param {File | Blob | ArrayBuffer | Uint8Array} fileOrBuffer
 * @returns {Promise<{ bytes: Uint8Array | null, hdBytes: Uint8Array | null, previewBytes: Uint8Array | null, orientationInfo: ReturnType<typeof computeOrientationInfo> }>}
 */
export async function extractPreviewWithInfo(fileOrBuffer) {
  try {
    let headerBuf;
    // 扩展前置元数据扫描范围至 1.5MB，确保完整覆盖 IFD0、IFD1 与 IFD2 (全像素大图通常在 IFD2)
    const scanSize = 1536 * 1024;
    if (fileOrBuffer instanceof Blob || (typeof File !== 'undefined' && fileOrBuffer instanceof File)) {
      const slice = fileOrBuffer.slice(0, Math.min(fileOrBuffer.size || scanSize, scanSize));
      headerBuf = new Uint8Array(await slice.arrayBuffer());
    } else if (fileOrBuffer instanceof ArrayBuffer) {
      headerBuf = new Uint8Array(fileOrBuffer.slice(0, Math.min(fileOrBuffer.byteLength, scanSize)));
    } else if (fileOrBuffer instanceof Uint8Array) {
      headerBuf = fileOrBuffer.subarray(0, Math.min(fileOrBuffer.length, scanSize));
    } else {
      return { bytes: null, hdBytes: null, previewBytes: null, orientationInfo: computeOrientationInfo(0, 0, 1) };
    }

    const { jpegs, orientation: tiffOrientation } = parseTiffMetadata(headerBuf);
    let hdBytes = null;
    let mediumBytes = null;
    let width = 0;
    let height = 0;

    if (jpegs.length > 0) {
      // 1. 选取全像素高清 JPEG 槽位 (按 byte length 降序排序，取最大的一张，通常为 1.5MB~5MB)
      const sortedJpegs = [...jpegs].sort((a, b) => b.length - a.length);
      const hdTarget = sortedJpegs[0];

      // 2. 选取中等尺寸轻量预览槽位 (100KB~1.5MB)，用于快速列表渲染防卡顿
      const mediumTarget = jpegs.find((j) => j.length >= 50 * 1024 && j.length < 1.5 * 1024 * 1024) || hdTarget;

      const extractBytesFromTarget = async (tgt) => {
        if (!tgt) return null;
        if (fileOrBuffer instanceof Blob || (typeof File !== 'undefined' && fileOrBuffer instanceof File)) {
          const slice = fileOrBuffer.slice(tgt.offset, tgt.offset + tgt.length);
          return new Uint8Array(await slice.arrayBuffer());
        } else if (fileOrBuffer instanceof ArrayBuffer) {
          return new Uint8Array(fileOrBuffer, tgt.offset, tgt.length);
        } else if (fileOrBuffer instanceof Uint8Array) {
          return fileOrBuffer.subarray(tgt.offset, tgt.offset + tgt.length);
        }
        return null;
      };

      const [extractedHd, extractedMed] = await Promise.all([
        extractBytesFromTarget(hdTarget),
        hdTarget === mediumTarget ? null : extractBytesFromTarget(mediumTarget),
      ]);

      hdBytes = extractedHd;
      mediumBytes = extractedMed || extractedHd;
      width = hdTarget.width;
      height = hdTarget.height;
    }

    if (!hdBytes) {
      let sliceBuf;
      if (fileOrBuffer instanceof Blob || (typeof File !== 'undefined' && fileOrBuffer instanceof File)) {
        const slice = fileOrBuffer.slice(0, Math.min(fileOrBuffer.size || 8 * 1024 * 1024, 8 * 1024 * 1024));
        sliceBuf = new Uint8Array(await slice.arrayBuffer());
      } else {
        sliceBuf = headerBuf;
      }
      hdBytes = extractEmbeddedJpeg(sliceBuf);
      mediumBytes = hdBytes;
    }

    const previewForOrient = mediumBytes || hdBytes;
    let finalOrientation = tiffOrientation || 1;
    if (previewForOrient) {
      const jpegOrientation = getJpegExifOrientation(previewForOrient);
      if (jpegOrientation > 1) finalOrientation = jpegOrientation;
      if (!width || !height) {
        const dims = getJpegDimensions(previewForOrient);
        width = dims.width;
        height = dims.height;
      }
    }

    const orientationInfo = computeOrientationInfo(width, height, finalOrientation);
    return {
      bytes: hdBytes, // 最优先：全像素高清内嵌 JPEG (几兆大小)
      hdBytes,
      previewBytes: mediumBytes || hdBytes,
      orientationInfo,
    };
  } catch (err) {
    console.warn('[previewExtractor] 提取预览与方向异常:', err);
    return { bytes: null, hdBytes: null, previewBytes: null, orientationInfo: computeOrientationInfo(0, 0, 1) };
  }
}

/**
 * 兼容原有函数：提取 JPEG 预览图 Uint8Array
 */
export async function extractPreviewFromArw(fileOrBuffer) {
  const result = await extractPreviewWithInfo(fileOrBuffer);
  return result.bytes;
}

/**
 * 从 File / Blob 或 ArrayBuffer 中切片提取机身全画幅超高清原底 JPEG (如 7008x4672)
 * @param {File | Blob | ArrayBuffer | Uint8Array} fileOrBuffer
 * @returns {Promise<{ bytes: Uint8Array, width: number, height: number, orientationInfo: ReturnType<typeof computeOrientationInfo> } | null>}
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

    const { jpegs, orientation: tiffOrientation } = parseTiffMetadata(headerBuf);

    if (jpegs.length > 0) {
      jpegs.sort((a, b) => {
        const areaA = a.width * a.height;
        const areaB = b.width * b.height;
        if (areaB !== areaA) return areaB - areaA;
        return b.length - a.length;
      });

      const best = jpegs[0];
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
          const jpegOrientation = getJpegExifOrientation(fullBytes);
          const finalOrientation = jpegOrientation > 1 ? jpegOrientation : tiffOrientation;
          const orientationInfo = computeOrientationInfo(width, height, finalOrientation);

          return { bytes: fullBytes, width, height, orientationInfo };
        }
      }
    }

    const preview = await extractPreviewWithInfo(fileOrBuffer);
    if (preview.bytes) {
      const dims = getJpegDimensions(preview.bytes);
      return {
        bytes: preview.bytes,
        width: dims.width,
        height: dims.height,
        orientationInfo: preview.orientationInfo,
      };
    }

    return null;
  } catch (err) {
    console.warn('[previewExtractor] 提取超高清底片失败:', err);
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

/**
 * 触发下载 JPEG 字节数组为本地文件
 * @param {Uint8Array} bytes
 * @param {string} fileName
 */
export function downloadJpegBytes(bytes, fileName = 'preview.jpg') {
  if (!bytes || bytes.length === 0) return;
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 专门解析普通 JPEG 文件（非 ARW 内嵌）的字节数据、真实尺寸与 EXIF 方向
 * @param {File | Blob | ArrayBuffer | Uint8Array} fileOrBuffer
 * @returns {Promise<{ bytes: Uint8Array, hdBytes: Uint8Array, previewBytes: Uint8Array, orientationInfo: ReturnType<typeof computeOrientationInfo> }>}
 */
export async function extractJpegInfo(fileOrBuffer) {
  let fullBytes;
  if (fileOrBuffer instanceof Blob || (typeof File !== 'undefined' && fileOrBuffer instanceof File)) {
    fullBytes = new Uint8Array(await fileOrBuffer.arrayBuffer());
  } else if (fileOrBuffer instanceof ArrayBuffer) {
    fullBytes = new Uint8Array(fileOrBuffer);
  } else if (fileOrBuffer instanceof Uint8Array) {
    fullBytes = fileOrBuffer;
  } else {
    throw new Error('不支持的文件对象类型');
  }

  const dims = getJpegDimensions(fullBytes);
  const jpegOrientation = getJpegExifOrientation(fullBytes);
  const orientationInfo = computeOrientationInfo(dims.width, dims.height, jpegOrientation);

  return {
    bytes: fullBytes,
    hdBytes: fullBytes,
    previewBytes: fullBytes,
    orientationInfo,
  };
}
