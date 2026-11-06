/**
 * Sony ARW 16-Bit Pro TIFF Exporter
 * =================================
 * 基于 FlashRaw (Rust + WASM SIMD128) 与标准 TIFF 6.0 规范的 16 位无损母版导出引擎：
 * 
 * 1. 完整保留 14-bit RAW 传感器的全部动态范围与高光/阴影宽容度 (48-bit RGB，每通道 16 位整数)
 * 2. 嵌入广色域 ICC Profile (默认 Adobe RGB 1998 或 ProPhoto RGB)，杜绝色彩空间裁切
 * 3. 采用零拷贝 (Zero-Copy) 二进制拼接构建 TIFF 文件，极致高效
 * 4. 100% 兼容 Adobe Photoshop, Lightroom, Capture One, Affinity Photo 等专业后期编辑器
 */

import { FlashRaw } from 'flashraw';

/**
 * 构建标准 TIFF 6.0 Little-Endian (Intel) 16-bit RGB 文件 Blob
 * @param {Object} params
 * @param {number} params.width 图像宽度
 * @param {number} params.height 图像高度
 * @param {Uint16Array} params.rgb16Data 16 位 RGB 像素数据 (长度 = width * height * 3)
 * @param {Uint8Array} [params.iccProfile] 嵌入的 ICC 配置文件数据
 * @param {string} [params.make] 相机品牌 (默认 'Sony')
 * @param {string} [params.model] 相机型号 (例如 'ILCE-7C2')
 * @param {string} [params.software] 生成工具名
 * @param {string} [params.description] 图像描述
 * @returns {Blob} 16-bit TIFF 文件的 Blob 对象
 */
export function buildTiff16Blob({
  width,
  height,
  rgb16Data,
  iccProfile = null,
  make = 'Sony',
  model = 'ILCE-7C2',
  software = 'Sony ARW Pro Studio',
  description = 'Sony ARW 16-bit Master TIFF',
}) {
  // 辅助函数：将数据打包为 2 字节对齐的 Uint8Array
  function alignBytes(data) {
    let u8;
    if (data instanceof Uint8Array) {
      u8 = data;
    } else if (data instanceof Uint16Array || data instanceof Uint32Array) {
      u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (typeof data === 'string') {
      u8 = new TextEncoder().encode(data + '\0');
    } else {
      u8 = new Uint8Array(data);
    }

    if (u8.byteLength % 2 !== 0) {
      const padded = new Uint8Array(u8.byteLength + 1);
      padded.set(u8);
      u8 = padded;
    }
    return u8;
  }

  // 常量与结构化缓冲区
  const bitsPerSampleBuf = new Uint16Array([16, 16, 16]); // 16 位/通道
  const sampleFormatBuf = new Uint16Array([1, 1, 1]);    // 1 = Unsigned Integer
  const resRationalBuf = new Uint32Array([300, 1]);       // 300 DPI 分辨率

  // 生成当前时间格式字符串 "YYYY:MM:DD HH:MM:SS\0"
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateTimeStr = `${now.getFullYear()}:${pad(now.getMonth() + 1)}:${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  // 定义所有 IFD0 Tags
  // 按照 TIFF 6.0 严格规范，Tags 必须升序排列
  const tags = [
    { tag: 0x0100, type: 4, count: 1, val: width },                                   // ImageWidth (LONG)
    { tag: 0x0101, type: 4, count: 1, val: height },                                  // ImageLength (LONG)
    { tag: 0x0102, type: 3, count: 3, data: bitsPerSampleBuf },                       // BitsPerSample (SHORT[3])
    { tag: 0x0103, type: 3, count: 1, val: 1 },                                       // Compression: 1 (None)
    { tag: 0x0106, type: 3, count: 1, val: 2 },                                       // PhotometricInterpretation: 2 (RGB)
    { tag: 0x010e, type: 2, count: null, str: description },                          // ImageDescription (ASCII)
    { tag: 0x010f, type: 2, count: null, str: make },                                 // Make (ASCII)
    { tag: 0x0110, type: 2, count: null, str: model },                                // Model (ASCII)
    { tag: 0x0111, type: 4, count: 1, isStripOffset: true },                          // StripOffsets (LONG)
    { tag: 0x0112, type: 3, count: 1, val: 1 },                                       // Orientation: 1 (Top-Left)
    { tag: 0x0115, type: 3, count: 1, val: 3 },                                       // SamplesPerPixel: 3 (R, G, B)
    { tag: 0x0116, type: 4, count: 1, val: height },                                  // RowsPerStrip: height (单 Strip)
    { tag: 0x0117, type: 4, count: 1, val: width * height * 3 * 2 },                 // StripByteCounts (LONG)
    { tag: 0x011a, type: 5, count: 1, data: resRationalBuf },                         // XResolution (RATIONAL)
    { tag: 0x011b, type: 5, count: 1, data: resRationalBuf },                         // YResolution (RATIONAL)
    { tag: 0x011c, type: 3, count: 1, val: 1 },                                       // PlanarConfiguration: 1 (Chunky RGBRGB...)
    { tag: 0x0128, type: 3, count: 1, val: 2 },                                       // ResolutionUnit: 2 (Inch)
    { tag: 0x0131, type: 2, count: null, str: software },                             // Software (ASCII)
    { tag: 0x0132, type: 2, count: null, str: dateTimeStr },                          // DateTime (ASCII)
    { tag: 0x0153, type: 3, count: 3, data: sampleFormatBuf },                        // SampleFormat: 1 (Unsigned Int)
  ];

  // 如果包含 ICC Profile，加入 InterColorProfile Tag
  if (iccProfile && iccProfile.length > 0) {
    tags.push({
      tag: 0x8773,
      type: 7, // 7 = UNDEFINED (raw bytes)
      count: iccProfile.length,
      data: iccProfile,
    });
  }

  // 严格保证 Tag 按照数值升序排序
  tags.sort((a, b) => a.tag - b.tag);

  // 预转换所有 ASCII 字符串为带结束符的字节并记录字节数
  tags.forEach((t) => {
    if (t.str) {
      const u8 = new TextEncoder().encode(t.str + '\0');
      t.data = u8;
      t.count = u8.length;
    }
  });

  // 计算 IFD 目录表大小
  // 头部: 8 字节
  // IFD0 计数项: 2 字节
  // IFD0 字段项: tags.length * 12 字节
  // 下一个 IFD 偏移: 4 字节 (0)
  const ifdHeaderLen = 8 + 2 + tags.length * 12 + 4;

  let extraOffset = ifdHeaderLen;
  const extraDataList = [];
  tags.forEach((t) => {
    if (t.data) {
      const u8 = alignBytes(t.data);
      t.offset = extraOffset;
      extraOffset += u8.byteLength;
      extraDataList.push(u8);
    }
  });

  // 此时 extraOffset 即为像素数据 (Strip Data) 的绝对起始字节偏移
  const stripOffset = extraOffset;

  // 创建 Header + IFD + 元数据缓冲区
  const metaBuf = new ArrayBuffer(extraOffset);
  const view = new DataView(metaBuf);
  const u8View = new Uint8Array(metaBuf);

  // 1. TIFF 文件头: 'II' (Little-Endian), 42, IFD0 偏移 = 8
  view.setUint16(0, 0x4949, false); // 'II'
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);

  // 2. IFD0 目录项列表
  view.setUint16(8, tags.length, true);
  let entryPos = 10;
  tags.forEach((t) => {
    view.setUint16(entryPos, t.tag, true);
    view.setUint16(entryPos + 2, t.type, true);
    view.setUint32(entryPos + 4, t.count, true);

    if (t.isStripOffset) {
      view.setUint32(entryPos + 8, stripOffset, true);
    } else if (t.data) {
      view.setUint32(entryPos + 8, t.offset, true);
    } else {
      if (t.type === 3) {
        // SHORT (2 字节)，存储在高两字节清零的低位
        view.setUint16(entryPos + 8, t.val, true);
        view.setUint16(entryPos + 10, 0, true);
      } else {
        // LONG (4 字节)
        view.setUint32(entryPos + 8, t.val, true);
      }
    }
    entryPos += 12;
  });

  // 3. 下一个 IFD 偏移 (0 = 无其他 IFD)
  view.setUint32(entryPos, 0, true);

  // 4. 将附加数据 (字符串、数组、ICC Profile 等) 填入对应 offset
  tags.forEach((t) => {
    if (t.data) {
      const match = extraDataList.shift();
      u8View.set(match, t.offset);
    }
  });

  // 5. 零拷贝封装：创建可以直接被浏览器下载或预览的 TIFF Blob
  const pixelBytes = new Uint8Array(
    rgb16Data.buffer,
    rgb16Data.byteOffset,
    rgb16Data.byteLength
  );

  return new Blob([metaBuf, pixelBytes], { type: 'image/tiff' });
}

/**
 * 完整流程：从 Sony ARW 文件直接解码并导出 16-bit TIFF
 * @param {File | Blob | ArrayBuffer} fileOrBuffer ARW 文件对象或字节
 * @param {Object} [options]
 * @param {'adobe-rgb' | 'prophoto' | 'srgb'} [options.colorSpace='adobe-rgb'] 广色域选项
 * @param {number} [options.exposureBoost=0.0] 曝光微调
 * @param {string} [options.make='Sony']
 * @param {string} [options.model]
 * @returns {Promise<{ blob: Blob, width: number, height: number, colorSpace: string, byteSize: number }>}
 */
export async function exportArwTo16BitTiff(fileOrBuffer, options = {}) {
  const {
    colorSpace = 'adobe-rgb',
    exposureBoost = 0.0,
    make = 'Sony',
    model = 'ILCE-7C2',
  } = options;

  const raw = await FlashRaw.open(fileOrBuffer, {
    limits: { maxSamples: 500000000, maxDimension: 65535 },
  });

  try {
    const frame = await raw.decode({
      output: 'rgb16',
      demosaic: 'bilinear',
      crop: true,
      colorSpace,
      exposure: exposureBoost,
    });

    const blob = buildTiff16Blob({
      width: frame.width,
      height: frame.height,
      rgb16Data: frame.data,
      iccProfile: frame.iccProfile,
      make,
      model,
      software: 'Sony ARW Pro Studio',
      description: `Sony 16-bit Master TIFF (${colorSpace.toUpperCase()})`,
    });

    return {
      blob,
      width: frame.width,
      height: frame.height,
      colorSpace: frame.colorSpace || colorSpace,
      byteSize: blob.size,
    };
  } finally {
    try {
      raw.close();
    } catch {
      // ignore
    }
  }
}

/**
 * 触发浏览器原生文件下载
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

