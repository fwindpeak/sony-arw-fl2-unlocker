import exifr from 'exifr';
import { parseMakerNoteData } from './makerNoteParser.js';

/**
 * 格式化曝光时间 (如 0.01 -> 1/100s, 2.5 -> 2.5s)
 */
export function formatExposureTime(exposureTime) {
  if (!exposureTime || exposureTime <= 0) return '--';
  if (exposureTime >= 1) {
    return `${Math.round(exposureTime * 10) / 10}s`;
  }
  const denominator = Math.round(1 / exposureTime);
  return `1/${denominator}s`;
}

/**
 * 根据物理焦距与等效焦距估算传感器画幅规格
 */
export function estimateSensorFormat(focalLength, focal35mm, modelName) {
  const model = (modelName || '').toLowerCase();

  // 手机型号特征识别
  if (
    model.includes('iphone') ||
    model.includes('xiaomi') ||
    model.includes('huawei') ||
    model.includes('galaxy') ||
    model.includes('pixel') ||
    model.includes('vivo') ||
    model.includes('oppo') ||
    model.includes('oneplus') ||
    model.includes('honor')
  ) {
    if (focalLength && focalLength < 10) {
      return '智能手机传感器 (约 1/1.3" ~ 1/2.5")';
    }
    return '智能手机计算摄影系统';
  }

  if (focalLength && focal35mm && focalLength > 0) {
    const cropFactor = focal35mm / focalLength;
    if (cropFactor <= 0.88) {
      return '中画幅 Medium Format (44×33mm / 0.79x)';
    } else if (cropFactor >= 0.95 && cropFactor <= 1.08) {
      return '35mm 全画幅 Full Frame (36×24mm / 1.0x)';
    } else if (cropFactor >= 1.4 && cropFactor <= 1.65) {
      return 'APS-C 画幅 (约 23.6×15.6mm / 1.5x~1.6x)';
    } else if (cropFactor >= 1.9 && cropFactor <= 2.2) {
      return 'Micro 4/3 微单画幅 (17.3×13mm / 2.0x)';
    } else if (cropFactor >= 2.6 && cropFactor <= 3.2) {
      return '1 英寸传感器 (13.2×8.8mm / 2.7x)';
    } else if (cropFactor > 3.5) {
      return `小型传感器 (等效裁切系数 ${cropFactor.toFixed(1)}x)`;
    }
  }

  // 知名相机系列兜底
  if (
    model.includes('ilce-7') ||
    model.includes('a7') ||
    model.includes('ilce-1') ||
    model.includes('ilce-9') ||
    model.includes('eos r5') ||
    model.includes('eos r6') ||
    model.includes('nikon z 6') ||
    model.includes('nikon z 7') ||
    model.includes('nikon z 8') ||
    model.includes('nikon z 9')
  ) {
    return '35mm 全画幅 Full Frame (36×24mm / 1.0x)';
  }
  if (model.includes('ilce-6') || model.includes('a6') || model.includes('zv-e10')) {
    return 'APS-C 画幅 (约 23.5×15.6mm / 1.5x)';
  }
  if (model.includes('gfx') || model.includes('x1d') || model.includes('645')) {
    return '中画幅 Medium Format (44×33mm)';
  }

  return '通用相机传感器';
}

/**
 * 安全 JSON 转换器，处理 BigInt / TypedArray / Buffer / Date / NaN
 */
export function safeJsonStringify(obj, indent = 2) {
  const seen = new WeakSet();

  return JSON.stringify(
    obj,
    (_key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (typeof value === 'number') {
        if (Number.isNaN(value)) return 'NaN';
        if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (value instanceof Uint8Array || value instanceof Uint16Array || value instanceof Uint32Array) {
        if (value.length <= 16) {
          return Array.from(value);
        }
        return `[TypedArray (${value.constructor.name}) length=${value.length}]`;
      }
      if (value instanceof ArrayBuffer) {
        return `[ArrayBuffer byteLength=${value.byteLength}]`;
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    },
    indent
  );
}

/**
 * 递归扁平化提取所有 Tag 对象为列表
 */
function extractRawTagList(data, sectionPrefix = '') {
  const tags = [];
  if (!data || typeof data !== 'object') return tags;

  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith('_')) continue;

    if (
      val !== null &&
      typeof val === 'object' &&
      !(val instanceof Uint8Array) &&
      !(val instanceof ArrayBuffer) &&
      !(val instanceof Date) &&
      !Array.isArray(val)
    ) {
      const nestedTags = extractRawTagList(val, sectionPrefix ? `${sectionPrefix}.${key}` : key);
      tags.push(...nestedTags);
    } else {
      let format = typeof val;
      let displayValue = val;

      if (val instanceof Date) {
        format = 'Date';
        displayValue = val.toLocaleString();
      } else if (val instanceof Uint8Array || val instanceof ArrayBuffer) {
        format = 'Binary';
        displayValue = val instanceof Uint8Array ? `[Binary ${val.length} bytes]` : `[ArrayBuffer]`;
      } else if (Array.isArray(val)) {
        format = 'Array';
      }

      tags.push({
        id: key,
        name: key,
        value: displayValue,
        rawValue: val,
        format,
        section: sectionPrefix || 'EXIF',
      });
    }
  }

  return tags;
}

/**
 * 解析完整照片 EXIF 元数据并深度提取快门计数
 */
export async function parsePhotoExif(fileOrBuffer) {
  try {
    const options = {
      tiff: true,
      xmp: true,
      icc: true,
      jfif: true,
      iptc: true,
      exif: true,
      gps: true,
      interop: true,
      makerNote: true,
      mergeOutput: false,
      sanitize: false,
      reviveValues: true,
      translateKeys: true,
      translateValues: true,
    };

    // 1. 获取分段数据
    const segmentedData = (await exifr.parse(fileOrBuffer, options)) || {};

    // 2. 获取合并扁平数据用于全量检索
    const flatData =
      (await exifr.parse(fileOrBuffer, {
        ...options,
        mergeOutput: true,
      })) || {};

    // 获取底层全量字节以支持深度 MakerNote 解析
    let fullFileBytes;
    try {
      if (fileOrBuffer instanceof Uint8Array) {
        fullFileBytes = fileOrBuffer;
      } else if (fileOrBuffer instanceof ArrayBuffer) {
        fullFileBytes = new Uint8Array(fileOrBuffer);
      } else if (typeof Blob !== 'undefined' && fileOrBuffer instanceof Blob) {
        const ab = await fileOrBuffer.arrayBuffer();
        fullFileBytes = new Uint8Array(ab);
      }
    } catch {
      // 容错处理
    }

    const hasAnyTags = Object.keys(flatData).length > 0 || Object.keys(segmentedData).length > 0;

    if (!hasAnyTags) {
      return {
        hasExif: false,
        overview: {},
        rawTags: [],
        sections: [],
        rawJsonString: '{}',
        fullDataMap: {},
      };
    }

    // 3. 构建 ExifOverview
    const make = flatData.Make || segmentedData.ifd0?.Make || segmentedData.image?.Make;
    const model = flatData.Model || segmentedData.ifd0?.Model || segmentedData.image?.Model;

    // 解析 MakerNote 厂商专有数据与快门次数
    const rawMakerNote =
      segmentedData.makerNote ||
      segmentedData.exif?.MakerNote ||
      flatData.MakerNote ||
      flatData.makerNote;

    const makerNoteResult = parseMakerNoteData(
      rawMakerNote,
      fullFileBytes,
      typeof model === 'string' ? model : undefined,
      typeof make === 'string' ? make : undefined,
      flatData
    );

    const lensModel =
      flatData.LensModel ||
      flatData.Lens ||
      flatData.LensInfo ||
      segmentedData.exif?.LensModel;
    const focalLength = flatData.FocalLength || segmentedData.exif?.FocalLength;
    const focalLengthIn35mm =
      flatData.FocalLengthIn35mmFormat ||
      flatData.FocalLengthIn35mmFilm ||
      segmentedData.exif?.FocalLengthIn35mmFormat;
    const fNumber = flatData.FNumber || flatData.ApertureValue || segmentedData.exif?.FNumber;
    const exposureTime = flatData.ExposureTime || segmentedData.exif?.ExposureTime;
    const iso =
      flatData.ISO ||
      flatData.ISOSpeedRatings ||
      flatData.PhotographicSensitivity ||
      segmentedData.exif?.ISO;
    const exposureCompensation =
      flatData.ExposureCompensation ||
      flatData.ExposureBiasValue ||
      segmentedData.exif?.ExposureBiasValue;
    const exposureProgram = flatData.ExposureProgram || segmentedData.exif?.ExposureProgram;
    const meteringMode = flatData.MeteringMode || segmentedData.exif?.MeteringMode;
    const whiteBalance = flatData.WhiteBalance || segmentedData.exif?.WhiteBalance;
    const flash = flatData.Flash || segmentedData.exif?.Flash;
    const dateTimeOriginal =
      flatData.DateTimeOriginal ||
      flatData.CreateDate ||
      flatData.ModifyDate ||
      segmentedData.exif?.DateTimeOriginal;
    const imageWidth =
      flatData.ImageWidth ||
      flatData.ExifImageWidth ||
      segmentedData.image?.ImageWidth ||
      segmentedData.exif?.ExifImageWidth;
    const imageHeight =
      flatData.ImageHeight ||
      flatData.ExifImageHeight ||
      segmentedData.image?.ImageHeight ||
      segmentedData.exif?.ExifImageHeight;
    const colorSpace = flatData.ColorSpace || segmentedData.exif?.ColorSpace;
    const software = flatData.Software || segmentedData.ifd0?.Software;
    const artist = flatData.Artist || segmentedData.ifd0?.Artist;
    const copyright = flatData.Copyright || segmentedData.ifd0?.Copyright;

    // GPS
    const gpsLatitude = flatData.latitude || flatData.GPSLatitude;
    const gpsLongitude = flatData.longitude || flatData.GPSLongitude;
    const gpsAltitude = flatData.altitude || flatData.GPSAltitude;

    const sensorFormatEstimate = estimateSensorFormat(focalLength, focalLengthIn35mm, model);

    let megapixels;
    if (imageWidth && imageHeight) {
      megapixels = Math.round(((imageWidth * imageHeight) / 1_000_000) * 10) / 10;
    }

    const overview = {
      make: typeof make === 'string' ? make.trim() : undefined,
      model: typeof model === 'string' ? model.trim() : undefined,
      lensModel: typeof lensModel === 'string' ? lensModel.trim() : undefined,
      focalLength: typeof focalLength === 'number' ? focalLength : undefined,
      focalLengthIn35mm: typeof focalLengthIn35mm === 'number' ? focalLengthIn35mm : undefined,
      fNumber: typeof fNumber === 'number' ? fNumber : undefined,
      exposureTime: typeof exposureTime === 'number' ? exposureTime : undefined,
      exposureTimeString: formatExposureTime(exposureTime),
      iso: typeof iso === 'number' ? iso : undefined,
      exposureCompensation:
        typeof exposureCompensation === 'number' ? exposureCompensation : undefined,
      exposureProgram: exposureProgram?.toString(),
      meteringMode: meteringMode?.toString(),
      whiteBalance: whiteBalance?.toString(),
      flash: flash?.toString(),
      dateTimeOriginal: dateTimeOriginal ? new Date(dateTimeOriginal).toLocaleString() : undefined,
      imageWidth: typeof imageWidth === 'number' ? imageWidth : undefined,
      imageHeight: typeof imageHeight === 'number' ? imageHeight : undefined,
      colorSpace: colorSpace?.toString(),
      software: typeof software === 'string' ? software.trim() : undefined,
      artist: typeof artist === 'string' ? artist.trim() : undefined,
      copyright: typeof copyright === 'string' ? copyright.trim() : undefined,
      gpsLatitude: typeof gpsLatitude === 'number' ? gpsLatitude : undefined,
      gpsLongitude: typeof gpsLongitude === 'number' ? gpsLongitude : undefined,
      gpsAltitude: typeof gpsAltitude === 'number' ? gpsAltitude : undefined,
      sensorFormatEstimate,
      megapixels,
      shutterCount: makerNoteResult.shutterCount,
      mechanicalShutterCount: makerNoteResult.mechanicalShutterCount,
    };

    // 4. 构建分段标签集
    const sectionConfigs = [
      { key: 'ifd0', label: '📷 IFD0 / 主图像 (Image)' },
      { key: 'exif', label: '⚙️ Exif 拍摄参数与镜头 (ExifIFD)' },
      { key: 'gps', label: '📍 GPS 地理定位 (GPSInfo)' },
      { key: 'makerNote', label: '🏭 厂商专有私有数据 (MakerNote)' },
      { key: 'interop', label: '🔄 互操作信息 (Interop)' },
      { key: 'xmp', label: '📑 XMP 扩展元数据 (XMP)' },
      { key: 'iptc', label: '📰 IPTC 版权新闻 (IPTC)' },
      { key: 'icc', label: '🎨 ICC 色彩空间配置文件 (ICC)' },
      { key: 'jfif', label: '🖼️ JFIF / 缩略图信息' },
    ];

    const sections = [];
    const allRawTags = [];

    // 若有深度解析的 MakerNote 标签，先加入到 allRawTags
    if (makerNoteResult.tags.length > 0) {
      allRawTags.push(...makerNoteResult.tags);
    }

    let makerNoteSectionAdded = false;

    for (const sec of sectionConfigs) {
      if (sec.key === 'makerNote') {
        const rawSecTags = segmentedData[sec.key]
          ? extractRawTagList(segmentedData[sec.key], sec.key)
          : [];
        const existingNames = new Set(makerNoteResult.tags.map((t) => t.name.toLowerCase()));
        const uniqueRawTags = rawSecTags.filter((t) => !existingNames.has(t.name.toLowerCase()));
        const combinedMakerNoteTags = [...makerNoteResult.tags, ...uniqueRawTags];

        if (combinedMakerNoteTags.length > 0) {
          sections.push({
            name: sec.key,
            label: sec.label,
            tags: combinedMakerNoteTags,
          });
          makerNoteSectionAdded = true;
        }
      } else if (segmentedData[sec.key] && Object.keys(segmentedData[sec.key]).length > 0) {
        const secTags = extractRawTagList(segmentedData[sec.key], sec.key);
        sections.push({
          name: sec.key,
          label: sec.label,
          tags: secTags,
        });
      }
    }

    if (!makerNoteSectionAdded && makerNoteResult.tags.length > 0) {
      sections.push({
        name: 'makerNote',
        label: '🏭 厂商专有私有数据 (MakerNote)',
        tags: makerNoteResult.tags,
      });
    }

    // 扁平标签汇总
    const flatTagList = extractRawTagList(flatData, 'All');
    for (const tag of flatTagList) {
      if (!allRawTags.some((t) => t.name.toLowerCase() === tag.name.toLowerCase())) {
        allRawTags.push(tag);
      }
    }

    // 5. 生成格式化 JSON 字符串
    const combinedFullMap = {
      _overview: overview,
      _makerNoteParsed: makerNoteResult.parsedMap,
      ...segmentedData,
      _all_flattened_tags: flatData,
    };
    const rawJsonString = safeJsonStringify(combinedFullMap, 2);

    return {
      hasExif: true,
      overview,
      rawTags: allRawTags,
      sections,
      rawJsonString,
      fullDataMap: combinedFullMap,
    };
  } catch (err) {
    console.warn('Exif parsing failed or incomplete:', err);
    return {
      hasExif: false,
      overview: {},
      rawTags: [],
      sections: [],
      rawJsonString: '{}',
      fullDataMap: {},
    };
  }
}

/**
 * 导出 EXIF 数据为 .json 文件并触发浏览器下载
 */
export function exportExifAsJson(result, filename = 'photo_metadata.json') {
  try {
    const jsonStr = result.rawJsonString || safeJsonStringify(result.fullDataMap, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export EXIF JSON:', err);
  }
}

/**
 * 复制 EXIF JSON 到剪贴板
 */
export async function copyExifAsJson(result) {
  try {
    const jsonStr = result.rawJsonString || safeJsonStringify(result.fullDataMap, 2);
    await navigator.clipboard.writeText(jsonStr);
    return true;
  } catch (err) {
    console.error('Failed to copy EXIF JSON:', err);
    return false;
  }
}

