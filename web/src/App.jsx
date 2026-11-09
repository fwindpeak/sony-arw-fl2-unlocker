import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Download,
  Trash2,
  Archive,
  RefreshCw,
  Plus,
  HelpCircle,
  X,
  Sliders,
  Check,
  Palette,
  Sun,
  Moon,
  RectangleHorizontal,
  RectangleVertical,
  CheckCircle2,
  FileImage,
  Gauge,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import JSZip from 'jszip';
import {
  inspectArw,
  processArw,
} from './core/camoufArw';
import {
  extractPreviewWithInfo,
  extractJpegInfo,
  createOrientedJpegUrl,
  createJpegObjectUrl,
  detectImageOrientation,
  downloadJpegBytes
} from './core/previewExtractor';
import { parsePhotoExif } from './core/exifReader';
import { SonyColorRenderer } from './core/sonyColorEngine';
import LookStudioModal from './components/LookStudioModal';
import ExifBadge from './components/ExifBadge';
import ExifViewerModal from './components/ExifViewerModal';
import './App.css';

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('sony_arw_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [files, setFiles] = useState([]);
  const [targetModel, setTargetModel] = useState('a7c2');
  const [defaultLook, setDefaultLook] = useState('fl2');
  const [profileMode, setProfileMode] = useState('balanced');
  const [wbOffset, setWbOffset] = useState('0');
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [studioTarget, setStudioTarget] = useState(null);
  const [exifTarget, setExifTarget] = useState(null);
  const [isMobileConfigOpen, setIsMobileConfigOpen] = useState(false);

  const fileInputRef = useRef(null);

  // 同步主题至 html 根节点并持久化
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('sony_arw_theme', theme);
    } catch { }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 释放 Object URL 避免内存泄露
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        if (f.processedBlobUrl) URL.revokeObjectURL(f.processedBlobUrl);
      });
    };
  }, []);

  // 添加文件到队列并异步解析预览图、EXIF 方向与元数据 (兼容 ARW 与相机普通 JPG)
  const addFilesToQueue = async (newFileList) => {
    const supportedFiles = Array.from(newFileList).filter((f) =>
      /\.(arw|srf|sr2|jpe?g)$/i.test(f.name)
    );

    if (supportedFiles.length === 0) return;

    const newItems = await Promise.all(
      supportedFiles.map(async (file) => {
        const isJpeg = /\.(jpe?g)$/i.test(file.name);
        const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;

        let info = null;
        let previewUrl = null;
        let previewBytes = null;
        let hdBytes = null;
        let orientationInfo = null;
        let exifResult = null;

        if (isJpeg) {
          // 相机普通 JPG 处理流程
          try {
            // 1. 深度解析 EXIF 元数据与快门计数
            exifResult = await parsePhotoExif(file);
          } catch (e) {
            console.warn('JPG EXIF 解析提示:', e);
          }

          try {
            // 2. 提取 JPG 全字节数据并按 EXIF 拍摄方向旋转物理像素
            const result = await extractJpegInfo(file);
            orientationInfo = result.orientationInfo;
            hdBytes = result.hdBytes;
            previewBytes = result.previewBytes;
            if (previewBytes) {
              previewUrl = await createOrientedJpegUrl(
                previewBytes,
                orientationInfo?.exifOrientation || 1
              );
            }
          } catch (e) {
            console.warn('JPG 图像解析提示:', e);
            previewUrl = URL.createObjectURL(file);
          }

          // 构造机型与直出标签
          const cameraModel = exifResult?.overview?.model || '相机 JPG';
          info = {
            cameraModel,
            activeLook: '原图直出',
            isJpeg: true,
          };
        } else {
          // 索尼 ARW / SRF / SR2 原始文件处理流程
          try {
            // 1. 切片 256KB 极速解析 ARW 结构元数据
            const sliceHeader = await file.slice(0, 256 * 1024).arrayBuffer();
            info = inspectArw(sliceHeader, file.name);
          } catch (e) {
            console.warn('元数据解析提示:', e);
          }

          try {
            // 2. 提取内嵌全像素高清 JPEG (几兆) 与 EXIF 方向信息
            // 同时提取轻量预览用于网页流畅呈现，按 Orientation 纠偏旋转物理像素
            const result = await extractPreviewWithInfo(file);
            orientationInfo = result.orientationInfo;
            hdBytes = result.hdBytes || result.bytes || null;
            previewBytes = hdBytes;
            const displayBytes = result.previewBytes || hdBytes;
            if (displayBytes) {
              previewUrl = await createOrientedJpegUrl(
                displayBytes,
                orientationInfo?.exifOrientation || 1
              );
            }
          } catch (e) {
            console.warn('预览图解析提示:', e);
          }

          try {
            // 3. 参照 LensMark 解析完整 EXIF 元数据并提取硬件快门计数 (Sony Tag 0x9050 等)
            exifResult = await parsePhotoExif(file);
          } catch (e) {
            console.warn('EXIF 与快门数解析提示:', e);
          }
        }

        return {
          id,
          file,
          name: file.name,
          size: file.size,
          isJpeg,
          status: 'pending',
          error: null,
          info,
          previewUrl,
          previewBytes,
          hdBytes,
          orientationInfo,
          exifResult,
          processedBlobUrl: null,
          processedBuffer: null,
        };
      })
    );

    setFiles((prev) => [...prev, ...newItems]);
  };

  // 拖拽事件监听
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  // 单个文件注入 / 调色处理 (支持 ARW 注入与普通相机 JPG 渲染调色)
  const processSingleFile = async (item, lookOverride = null, wbOverride = null) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === item.id ? { ...f, status: 'processing', error: null } : f
      )
    );

    try {
      const effLook = lookOverride || defaultLook;
      const effWb = wbOverride !== null && wbOverride !== undefined ? Number(wbOverride) : Number(wbOffset);

      if (item.isJpeg) {
        // 普通相机 JPG：基于 WebGL 创意外观 3D-LUT 引擎进行全分辨率色彩渲染
        const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
        const orientedUrl = item.previewUrl || (await createOrientedJpegUrl(
          item.previewBytes || new Uint8Array(await item.file.arrayBuffer()),
          item.orientationInfo?.exifOrientation || 1
        ));

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = orientedUrl;
        await img.decode();

        const params = {
          look: effLook === 'keep' ? 'ST' : effLook.toUpperCase(),
          wbOffset: effWb,
          lutIntensity: 1.0,
          exposure: 0.0,
          contrast: 0.0,
          highlights: 0.0,
          shadows: 0.0,
          tint: 0.0,
          saturation: 1.0,
          isRaw: false,
        };

        const resultBlob = await SonyColorRenderer.exportFullResolution({
          fullImg: img,
          params,
          basePath,
          quality: 0.96,
        });

        const blobUrl = URL.createObjectURL(resultBlob);
        const arrayBuffer = await resultBlob.arrayBuffer();
        const outputUint8 = new Uint8Array(arrayBuffer);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                ...f,
                status: 'done',
                processedBlobUrl: blobUrl,
                processedBuffer: outputUint8,
                previewUrl: blobUrl,
                info: {
                  ...f.info,
                  activeLook: effLook.toUpperCase(),
                },
              }
              : f
          )
        );

        if (lookOverride) {
          const baseName = item.name.replace(/\.[^/.]+$/, '');
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `${baseName}_${effLook.toUpperCase()}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        return true;
      }

      const fullBuffer = await item.file.arrayBuffer();

      let newPreviewUrl = null;

      // 仅用于网页端卡片缩略图实时展示所选外观色彩（不修改 ARW 文件内嵌数据）
      if (effLook !== 'keep' && (item.previewBytes || item.previewUrl)) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const srcBytes = item.previewBytes || item.hdBytes;
          let tempUrl = null;
          if (srcBytes) {
            tempUrl = URL.createObjectURL(new Blob([srcBytes], { type: 'image/jpeg' }));
            img.src = tempUrl;
          } else {
            img.src = item.previewUrl;
          }

          await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
          });
          if (tempUrl) URL.revokeObjectURL(tempUrl);

          const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
          const cardPreviewBytes = await SonyColorRenderer.renderPreviewJpeg({
            img,
            params: {
              look: effLook.toUpperCase(),
              wbOffset: effWb,
              profileMode,
              lutIntensity: 1.0,
            },
            basePath,
          });

          if (cardPreviewBytes) {
            newPreviewUrl = createJpegObjectUrl(cardPreviewBytes);
          }
        } catch (renderErr) {
          console.warn('渲染网页卡片外观色彩预览提示:', renderErr);
        }
      }

      // 纯净无损元数据注入（零位移，不改写内嵌 JPEG，确保索尼官方 Imaging Edge Edit 完全正常识别与显影）
      const outputUint8 = processArw(fullBuffer, {
        targetModel,
        defaultLook: effLook,
        profileMode,
        wbOffset: effWb,
      });

      const updatedInfo = inspectArw(outputUint8, item.name);
      const blob = new Blob([outputUint8], { type: 'image/x-sony-arw' });
      const blobUrl = URL.createObjectURL(blob);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
              ...f,
              status: 'done',
              info: updatedInfo,
              processedBlobUrl: blobUrl,
              processedBuffer: outputUint8,
              previewUrl: newPreviewUrl || f.previewUrl,
            }
            : f
        )
      );

      // 若由调色暗房单独触发注入，自动触发保存下载
      if (lookOverride) {
        const baseName = item.name.replace(/\.[^/.]+$/, '');
        const ext = item.name.substring(item.name.lastIndexOf('.'));
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${baseName}_${effLook.toUpperCase()}${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      return true;
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: 'error', error: err.message || '处理失败' }
            : f
        )
      );
      return false;
    }
  };

  // 提取单张照片内嵌全像素高清 JPG 或保存原始 JPG
  const handleExtractSingleJpeg = async (item) => {
    try {
      if (item.isJpeg) {
        const bytes = item.previewBytes || new Uint8Array(await item.file.arrayBuffer());
        downloadJpegBytes(bytes, item.name);
        return;
      }

      let jpegBytes = item.hdBytes || item.previewBytes;
      if (!jpegBytes && item.file) {
        const res = await extractPreviewWithInfo(item.file);
        jpegBytes = res.hdBytes || res.bytes;
      }

      if (!jpegBytes) {
        alert('未在 ARW 文件中找到内嵌全尺寸高清 JPEG');
        return;
      }

      const baseName = item.name.replace(/\.[^/.]+$/, '');
      downloadJpegBytes(jpegBytes, `${baseName}_embedded_hd.jpg`);
    } catch (e) {
      console.warn('提取/保存 JPG 异常:', e);
      alert('保存 JPG 失败: ' + e.message);
    }
  };

  // 批量提取所有照片内嵌的高清 JPG 或原始 JPG 并打包为 ZIP
  const handleExtractAllJpegsZip = async () => {
    if (files.length === 0) return;
    const zip = new JSZip();

    for (const item of files) {
      let jpegBytes = item.hdBytes || item.previewBytes;
      if (!jpegBytes && item.file) {
        if (item.isJpeg) {
          jpegBytes = new Uint8Array(await item.file.arrayBuffer());
        } else {
          const res = await extractPreviewWithInfo(item.file);
          jpegBytes = res.hdBytes || res.bytes;
        }
      }
      if (jpegBytes) {
        const baseName = item.name.replace(/\.[^/.]+$/, '');
        const filename = item.isJpeg ? item.name : `${baseName}_embedded_hd.jpg`;
        zip.file(filename, jpegBytes);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Camera_Photos_JPEGs_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 批量注入 / 调色全部文件
  const handleProcessAll = async () => {
    if (files.length === 0 || isProcessingAll) return;

    setIsProcessingAll(true);
    for (const item of files) {
      if (item.status !== 'done') {
        await processSingleFile(item);
      }
    }
    setIsProcessingAll(false);
  };

  // 单独下载文件 (支持调色后的 JPG 与注入后的 ARW)
  const handleDownloadSingle = (item) => {
    if (!item.processedBlobUrl) return;
    const baseName = item.name.replace(/\.[^/.]+$/, '');
    const ext = item.name.substring(item.name.lastIndexOf('.'));
    const a = document.createElement('a');
    a.href = item.processedBlobUrl;
    a.download = item.isJpeg
      ? `${baseName}_${item.info?.activeLook || 'look'}.jpg`
      : `${baseName}_looks${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 批量下载为 ZIP 压缩包
  const handleDownloadAllZip = async () => {
    const doneFiles = files.filter((f) => f.status === 'done' && f.processedBuffer);
    if (doneFiles.length === 0) return;

    const zip = new JSZip();
    for (const item of doneFiles) {
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      const ext = item.name.substring(item.name.lastIndexOf('.'));
      const filename = item.isJpeg
        ? `${baseName}_${item.info?.activeLook || 'look'}.jpg`
        : `${baseName}_looks${ext}`;
      zip.file(filename, item.processedBuffer);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sony_ARW_Profiles_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 手动切换/旋转画幅方向 (横向 / 纵向切换)
  const handleToggleOrientation = (id) => {
    setFiles((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const currentIsPortrait = item.orientationInfo?.isPortrait ?? false;
        const nextIsPortrait = !currentIsPortrait;
        const ratioTag = nextIsPortrait ? '2:3' : '3:2';
        const label = nextIsPortrait ? '纵向' : '横向';
        return {
          ...item,
          orientationInfo: {
            ...item.orientationInfo,
            isPortrait: nextIsPortrait,
            orientation: nextIsPortrait ? 'portrait' : 'landscape',
            ratioTag,
            label,
          },
        };
      })
    );
  };

  // 移除单项
  const handleRemoveFile = (id) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.processedBlobUrl) URL.revokeObjectURL(target.processedBlobUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  // 清空全部
  const handleClearAll = () => {
    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      if (f.processedBlobUrl) URL.revokeObjectURL(f.processedBlobUrl);
    });
    setFiles([]);
  };

  const doneCount = files.filter((f) => f.status === 'done').length;

  return (
    <div className="tool-app">
      {/* 隐藏的系统文件选择框 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".arw,.srf,.sr2,.jpg,.jpeg,.JPG,.JPEG"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) addFilesToQueue(e.target.files);
          e.target.value = '';
        }}
      />

      {/* 顶部专业工具导航栏 */}
      <header className="tool-navbar">
        <div className="navbar-left">
          <div className="logo-box">
            <Camera size={18} className="logo-icon" />
          </div>
          <div className="brand-title">
            <span className="brand-name">Sony ARW 创意外观工具</span>
          </div>
        </div>

        <div className="navbar-right">
          {files.length > 0 && (
            <>
              <button
                className="nav-btn add-btn"
                onClick={() => fileInputRef.current?.click()}
                title="导入更多 ARW 文件"
              >
                <Plus size={15} />
                <span className="btn-text">导入照片</span>
              </button>
              <button
                className="nav-btn"
                onClick={handleClearAll}
                disabled={isProcessingAll}
                title="清空当前照片列表"
              >
                <Trash2 size={15} />
                <span className="btn-text">清空列表</span>
              </button>
            </>
          )}

          {/* 亮色 / 暗色主题切换按钮 */}
          <button
            className="nav-btn theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? '切换至亮色模式' : '切换至暗色模式'}
            aria-label="切换界面色彩主题"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            className="nav-btn help-btn"
            onClick={() => setShowHelp(true)}
            title="关于与技术说明"
            aria-label="查看技术说明"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </header>

      {/* 核心控制条 (参数配置与主要操作) */}
      <section className="control-strip">
        {/* 移动端专属：极简配置摘要与展开按钮 */}
        <div
          className="mobile-config-summary"
          onClick={() => setIsMobileConfigOpen((prev) => !prev)}
        >
          <div className="mobile-config-chips">
            <span className="m-chip m-chip-look">
              外观: {defaultLook.toUpperCase()}
            </span>
            <span className="m-chip m-chip-model">
              标定: {targetModel === 'keep' ? '保持原机' : targetModel.toUpperCase()}
            </span>
            <span className="m-chip m-chip-wb">
              色温: {wbOffset === '0' ? '0K' : `${wbOffset}K`}
            </span>
          </div>
          <button
            type="button"
            className="btn-mobile-toggle-config"
            aria-label="展开全局配置"
          >
            <SlidersHorizontal size={13} />
            <span>{isMobileConfigOpen ? '收起' : '参数'}</span>
            {isMobileConfigOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        <div className={`config-selectors ${isMobileConfigOpen ? 'mobile-expanded' : ''}`}>
          {/* 预设外观 */}
          <div className="select-pill">
            <label>目标外观</label>
            <select
              value={defaultLook}
              onChange={(e) => setDefaultLook(e.target.value)}
            >
              <option value="fl2">FL2 (复古胶片 2)</option>
              <option value="fl3">FL3 (清透电影 3)</option>
              <option value="keep">保持原拍摄设置</option>
              <option value="fl">FL (经典胶片 1)</option>
              <option value="in">IN (拍立得 / 即时)</option>
              <option value="sh">SH (柔和高调)</option>
              <option value="vv2">VV2 (极清生动 2)</option>
              <option value="st">ST (标准)</option>
              <option value="pt">PT (人像优化)</option>
              <option value="nt">NT (中性)</option>
              <option value="vv">VV (鲜艳)</option>
            </select>
          </div>

          {/* 色彩调校方案 */}
          <div className="select-pill">
            <label>色彩校准</label>
            <select
              value={profileMode}
              onChange={(e) => setProfileMode(e.target.value)}
            >
              <option value="balanced">通透平衡校准 (推荐)</option>
              <option value="factory">原厂高暖色彩</option>
            </select>
          </div>

          {/* 白平衡色温补偿 */}
          <div className="select-pill">
            <label>色温补偿</label>
            <select
              value={wbOffset}
              onChange={(e) => setWbOffset(e.target.value)}
            >
              <option value="0">0K (保持原片色温 / 推荐)</option>
              <option value="-400">-400K (肤色微冷去黄)</option>
              <option value="-200">-200K (自然微冷)</option>
              <option value="-600">-600K (清冷冷调)</option>
              <option value="200">+200K (自然微暖)</option>
              <option value="400">+400K (复古浓暖)</option>
            </select>
          </div>

          {/* 伪装机型标定 */}
          <div className="select-pill hide-on-tiny">
            <label>机型标定</label>
            <select
              value={targetModel}
              onChange={(e) => setTargetModel(e.target.value)}
            >
              <option value="a7c2">A7C II (ILCE-7CM2 / 推荐)</option>
              <option value="keep">保持原机型标定</option>
              <option value="a7m4">A7 IV (ILCE-7M4)</option>
              <option value="a7rm5">A7R V (ILCE-7RM5)</option>
              <option value="a1m2">A1 II (ILCE-1M2)</option>
              <option value="a9m3">A9 III (ILCE-9M3)</option>
            </select>
          </div>
        </div>

        {/* 桌面端操作按钮组 */}
        <div className="control-actions desktop-actions">
          {files.length > 0 && (
            <button
              className="action-btn extract-all-btn"
              onClick={handleExtractAllJpegsZip}
              title="批量导出所有照片内嵌的高清 JPG 为 ZIP 压缩包"
            >
              <FileImage size={14} />
              提取全部 JPG
            </button>
          )}

          {doneCount > 1 && (
            <button
              className="action-btn download-all-btn"
              onClick={handleDownloadAllZip}
            >
              <Archive size={14} />
              导出 ZIP ({doneCount})
            </button>
          )}

          <button
            className="action-btn unlock-all-btn"
            onClick={handleProcessAll}
            disabled={files.length === 0 || isProcessingAll}
          >
            {isProcessingAll ? (
              <>
                <RefreshCw size={14} className="spin" />
                正在处理...
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                {files.every((f) => f.isJpeg)
                  ? '批量调色处理'
                  : files.some((f) => f.isJpeg)
                    ? '批量处理 (注入/调色)'
                    : '批量注入处理'} {files.length > 0 && `(${files.length})`}
              </>
            )}
          </button>
        </div>
      </section>

      {/* 主工作区 */}
      <main className="tool-main">
        {files.length === 0 ? (
          /* 空状态：专业导入卡片 */
          <div
            className={`empty-uploader ${isDragOver ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-circle">
              <Upload size={32} />
            </div>
            <h2 className="upload-title">导入索尼 ARW 原始文件或相机普通 JPG</h2>
            <p className="upload-desc">
              支持点击选择或直接将 ARW 与相机 JPG 拖入此处。在浏览器本地直接极速预览、加载创意外观 3D-LUT 胶片调色、深度解析 EXIF 拍摄参数与硬件快门数。
            </p>
            <div className="upload-tags">
              <span>.ARW</span>
              <span>.JPG / .JPEG</span>
            </div>
            <button className="upload-btn-mobile" type="button">
              选择文件
            </button>
          </div>
        ) : (
          /* 照片网格展示区 */
          <div className="gallery-section">
            <div className="gallery-header">
              <span className="gallery-count">
                已导入 {files.length} 张照片 · {doneCount} 张就绪
              </span>
              <span className="gallery-hint">
                {files.some((f) => f.isJpeg)
                  ? '点击照片可进入调色暗房施加 12 款索尼创意外观 LUT 并导出高清调色照片，亦可查看完整拍摄 EXIF'
                  : '在 Sony Imaging Edge Edit 中打开导出的 ARW 即可在「创意外观」中选用 FL2 / FL3'}
              </span>
            </div>

            <div className="photo-grid">
              {files.map((item) => (
                <div
                  key={item.id}
                  className={`photo-card ${item.status === 'done' ? 'is-done' : ''}`}
                >
                  {/* 缩略图预览区 */}
                  <div
                    className={`card-thumb-wrap ${item.orientationInfo?.isPortrait ? 'is-portrait' : 'is-landscape'}`}
                    onClick={() => {
                      if (item.previewUrl) {
                        setStudioTarget(item);
                      }
                    }}
                    title="点击打开外观调色暗房"
                  >
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="card-thumb"
                        loading="lazy"
                        onLoad={(e) => {
                          if (!item.orientationInfo) {
                            const detected = detectImageOrientation(e.currentTarget);
                            setFiles((prev) =>
                              prev.map((f) =>
                                f.id === item.id ? { ...f, orientationInfo: detected } : f
                              )
                            );
                          }
                        }}
                      />
                    ) : (
                      <div className="card-thumb-placeholder">
                        <Camera size={26} opacity={0.35} />
                        <span>提取内嵌预览...</span>
                      </div>
                    )}

                    {/* 左上角轻量状态标 */}
                    <div className="thumb-top-left-badges">
                      {item.status === 'done' ? (
                        <span className="thumb-pill-done">
                          <Check size={11} />
                          <span>{item.isJpeg ? '已调色' : '已注入'}</span>
                        </span>
                      ) : item.orientationInfo ? (
                        <span className="thumb-pill-neutral">
                          {item.orientationInfo.isPortrait ? (
                            <RectangleVertical size={10} />
                          ) : (
                            <RectangleHorizontal size={10} />
                          )}
                          <span>{item.orientationInfo.ratioTag || item.orientationInfo.label}</span>
                        </span>
                      ) : null}
                    </div>

                    {/* 右上角一体化机型与外观胶囊 */}
                    {item.info && (
                      <div className="thumb-top-right-badges">
                        <span className="thumb-pill-meta">
                          <span className="pill-model-name">{item.info.cameraModel}</span>
                          <span className="pill-look-code">{item.info.activeLook}</span>
                        </span>
                      </div>
                    )}

                    {/* 悬停平滑浮现的调色暗房入口 */}
                    {item.previewUrl && (
                      <div className="thumb-hover-overlay">
                        <span className="thumb-hover-pill">
                          <Palette size={13} />
                          <span>调色暗房</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 卡片主体内容区 */}
                  <div className="card-body">
                    {/* 文件名与大小 / 快门亮点 */}
                    <div className="card-title-row">
                      <div className="card-filename" title={item.name}>
                        {item.name}
                      </div>
                      <div className="card-meta-right">
                        {item.exifResult?.overview?.shutterCount !== undefined && (
                          <span
                            className="card-shutter-pill"
                            title={`Sony 硬件物理快门释放次数: ${item.exifResult.overview.shutterCount.toLocaleString()} 次`}
                          >
                            <Gauge size={10} />
                            <span>快门 {item.exifResult.overview.shutterCount.toLocaleString()}</span>
                          </span>
                        )}
                        <span className="card-filesize">
                          {(item.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                    </div>

                    {/* 拍摄曝光参数行 (精简单行，点击直接打开 EXIF 详情) */}
                    <ExifBadge
                      exifResult={item.exifResult}
                      onOpenExifModal={() => setExifTarget(item)}
                    />

                    {/* 底部精简操作工具栏：仅保留核心主操作、详情调色与删除 */}
                    <div className="card-actions-row">
                      {item.isJpeg ? (
                        item.status === 'done' ? (
                          <button
                            type="button"
                            className="btn-card-primary btn-card-save"
                            onClick={() => handleDownloadSingle(item)}
                            title="导出应用创意外观 LUT 后的 JPG 照片"
                          >
                            <Download size={13} />
                            <span>导出调色 JPG</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-card-primary btn-card-unlock"
                            onClick={() => processSingleFile(item)}
                            disabled={item.status === 'processing' || isProcessingAll}
                            title="使用当前外观预设快速调色"
                          >
                            {item.status === 'processing' ? (
                              <RefreshCw size={13} className="spin" />
                            ) : (
                              <Palette size={13} />
                            )}
                            <span>加外观调色</span>
                          </button>
                        )
                      ) : (
                        item.status === 'done' ? (
                          <button
                            type="button"
                            className="btn-card-primary btn-card-save"
                            onClick={() => handleDownloadSingle(item)}
                            title="导出注入外观后的 ARW 文件"
                          >
                            <Download size={13} />
                            <span>导出 ARW</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-card-primary btn-card-unlock"
                            onClick={() => processSingleFile(item)}
                            disabled={item.status === 'processing' || isProcessingAll}
                          >
                            {item.status === 'processing' ? (
                              <RefreshCw size={13} className="spin" />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                            <span>注入外观</span>
                          </button>
                        )
                      )}

                      {/* 详情与调色暗房入口 */}
                      <button
                        type="button"
                        className="btn-card-secondary"
                        onClick={() => {
                          if (item.previewUrl) setStudioTarget(item);
                        }}
                        title="进入详情页：查看大图、加LUT调色、分屏对比、旋转与母版导出"
                      >
                        <Sliders size={13} />
                        <span>详情调色</span>
                      </button>

                      {/* 移除照片 */}
                      <button
                        type="button"
                        className="btn-tool-icon btn-tool-danger"
                        onClick={() => handleRemoveFile(item.id)}
                        title="从列表中移除此照片"
                        aria-label="移除照片"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 手机端吸底固定操作栏 (Sticky Bottom Bar) */}
      {files.length > 0 && (
        <div className="mobile-bottom-bar">
          <div className="mobile-dock-left">
            <span className="mobile-dock-count">
              {doneCount === files.length && files.length > 0 ? (
                <CheckCircle2 size={13} color="var(--status-success)" />
              ) : (
                <span className="dock-dot" />
              )}
              <span>{doneCount} / {files.length} 就绪</span>
            </span>
          </div>

          <div className="mobile-dock-right">
            <button
              type="button"
              className="mobile-btn-dock-tool"
              onClick={() => fileInputRef.current?.click()}
              title="继续添加 ARW 照片"
            >
              <Plus size={15} />
              <span>添加</span>
            </button>

            {doneCount > 1 ? (
              <button
                type="button"
                className="mobile-btn-dock-tool"
                onClick={handleDownloadAllZip}
                title="导出所有已注入照片的 ZIP 包"
              >
                <Archive size={15} />
                <span>ZIP</span>
              </button>
            ) : (
              <button
                type="button"
                className="mobile-btn-dock-tool"
                onClick={handleExtractAllJpegsZip}
                title="批量提取所有照片的高清 JPG"
              >
                <FileImage size={15} />
                <span>JPG</span>
              </button>
            )}

            <button
              type="button"
              className="mobile-btn-dock-primary"
              onClick={handleProcessAll}
              disabled={isProcessingAll}
            >
              {isProcessingAll ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>处理中</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>一键注入全部</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 灯箱大图预览 Modal */}
      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <span className="lightbox-title">{lightboxImg.name}</span>
              <button
                className="lightbox-close"
                onClick={() => setLightboxImg(null)}
                aria-label="关闭预览"
              >
                <X size={18} />
              </button>
            </div>
            <div className="lightbox-body">
              <img src={lightboxImg.url} alt={lightboxImg.name} />
            </div>
          </div>
        </div>
      )}

      {/* 技术说明与指引弹窗 */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">
                <Sliders size={16} />
                <h3>技术说明与使用指引</h3>
              </div>
              <button className="btn-close" onClick={() => setShowHelp(false)} aria-label="关闭">
                <X size={16} />
              </button>
            </div>

            <div className="help-content">
              <div className="help-section">
                <h4>色彩调校与白平衡校准</h4>
                <p>
                  <strong>-400K 色温补偿 (推荐开启)</strong>：由于索尼原厂 FL2 与 FL3 胶片矩阵整体倾向偏暖，室内及白底环境容易泛黄。工具在 RAW 层面直接对红蓝增益进行补偿，使人像肤色通透自然。
                </p>
                <p style={{ marginTop: '6px' }}>
                  <strong>通透平衡校准 vs 原厂高暖色彩</strong>：通透平衡校准重归一化了白平衡色彩矩阵，兼具胶片反差与健康肤色；原厂版则保持高暖胶片特性。
                </p>
              </div>

              <div className="help-section">
                <h4>后期渲染工作流</h4>
                <ol style={{ paddingLeft: '18px', lineHeight: '1.8' }}>
                  <li>在此工具中注入外观并导出 ARW 文件。</li>
                  <li>使用官方 <strong>Sony Imaging Edge Desktop (Edit)</strong> 打开导出的 ARW。</li>
                  <li>在右侧「创意外观」下拉菜单中自由选用 FL2、FL3 或任意风格。</li>
                </ol>
              </div>

              <div className="help-section">
                <h4>本地内存处理</h4>
                <p>
                  所有运算完全在您的设备浏览器本地内存中执行，无任何文件上传至外部服务器，断网亦可正常使用。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 索尼创意外观调色暗房 / 照片详情工作台 */}
      {studioTarget && (
        <LookStudioModal
          photoItem={studioTarget}
          onClose={() => setStudioTarget(null)}
          onApplyToArw={processSingleFile}
          onOpenExif={(item) => setExifTarget(item || studioTarget)}
          onToggleOrientation={(id) => handleToggleOrientation(id)}
          onExtractOriginal={(item) => handleExtractSingleJpeg(item || studioTarget)}
        />
      )}

      {/* 照片 EXIF 元数据与快门计数查看器 */}
      <ExifViewerModal
        isOpen={Boolean(exifTarget)}
        onClose={() => setExifTarget(null)}
        exifResult={exifTarget?.exifResult}
        slotInfo={exifTarget?.info}
        fileName={exifTarget?.name}
      />
    </div>
  );
}
