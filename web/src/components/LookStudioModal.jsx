import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  RotateCcw,
  RotateCw,
  Columns,
  Eye,
  Sun,
  Contrast,
  Palette,
  Thermometer,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  Gauge,
  FileStack,
  FileImage,
  Info,
} from 'lucide-react';
import { SONY_CREATIVE_LOOKS, SonyColorRenderer } from '../core/sonyColorEngine';
import {
  extractFullResJpegFromArw,
  createOrientedJpegUrl,
  extractPreviewWithInfo,
  downloadJpegBytes,
} from '../core/previewExtractor';
import { SonyRawDecoder } from '../core/rawDecoder';
import { downloadBlob } from '../core/tiffExporter';
import './LookStudioModal.css';

// 专业微调滑块组件 (支持点击标签复位、数值复位、左右步进微调按钮)
function SliderRow({
  icon: Icon,
  label,
  value,
  displayValue,
  min,
  max,
  step,
  defaultValue = 0,
  onChange,
  onReset
}) {
  const handleDec = (e) => {
    e.stopPropagation();
    const next = Math.max(min, Number((value - step).toFixed(2)));
    onChange(next);
  };
  const handleInc = (e) => {
    e.stopPropagation();
    const next = Math.min(max, Number((value + step).toFixed(2)));
    onChange(next);
  };
  const handleReset = (e) => {
    e.stopPropagation();
    if (onReset) onReset();
    else onChange(defaultValue);
  };

  return (
    <div className="slider-item">
      <div className="slider-label-row">
        <span
          className="flex-row clickable-label"
          onClick={handleReset}
          title="点击重置为默认值"
        >
          {Icon && <Icon size={13} />}
          <span>{label}</span>
        </span>
        <span
          className="slider-val clickable-val"
          onClick={handleReset}
          title="点击重置为默认值"
        >
          {displayValue}
        </span>
      </div>
      <div className="slider-track-wrap">
        <button
          type="button"
          className="btn-stepper btn-dec"
          onClick={handleDec}
          aria-label="减少"
        >
          −
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <button
          type="button"
          className="btn-stepper btn-inc"
          onClick={handleInc}
          aria-label="增加"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function LookStudioModal({
  photoItem,
  onClose,
  onApplyToArw,
  onOpenExif,
  onToggleOrientation,
  onExtractOriginal,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(null);

  // 移动端 Lightroom 模式底部当前激活的一级 Tab ('looks' | 'light' | 'color' | 'export')
  const [mobileTab, setMobileTab] = useState('looks');

  // 提取或保存原始原画底片
  const handleExtractOriginal = async () => {
    if (onExtractOriginal) {
      onExtractOriginal(photoItem);
      return;
    }
    try {
      if (photoItem.isJpeg) {
        const bytes = photoItem.previewBytes || new Uint8Array(await photoItem.file.arrayBuffer());
        downloadJpegBytes(bytes, photoItem.name);
        return;
      }
      let jpegBytes = photoItem.hdBytes || photoItem.previewBytes;
      if (!jpegBytes && photoItem.file) {
        const res = await extractPreviewWithInfo(photoItem.file);
        jpegBytes = res.hdBytes || res.bytes;
      }
      if (jpegBytes) {
        const baseName = photoItem.name.replace(/\.[^/.]+$/, '');
        downloadJpegBytes(jpegBytes, `${baseName}_embedded_hd.jpg`);
      }
    } catch (e) {
      alert('保存原图失败: ' + e.message);
    }
  };

  // 旋转纠偏画面 90°
  const handleRotate = () => {
    if (onToggleOrientation && photoItem?.id) {
      onToggleOrientation(photoItem.id);
    }
  };

  // 调色参数状态
  const [selectedLook, setSelectedLook] = useState('FL2');
  const [lutIntensity, setLutIntensity] = useState(1.0);
  const [exposure, setExposure] = useState(0.0);
  const [contrast, setContrast] = useState(0.0);
  const [highlights, setHighlights] = useState(0.0);
  const [shadows, setShadows] = useState(0.0);
  const [wbOffset, setWbOffset] = useState(0); // 默认 0 (索尼基准)
  const [tint, setTint] = useState(0.0);
  const [saturation, setSaturation] = useState(1.0);

  // 分屏对比模式: 0 = 单图, 1 = 左右分屏, 2 = 按住对比原图
  const [splitMode, setSplitMode] = useState(1);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isLoadingLut, setIsLoadingLut] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [fullResDims, setFullResDims] = useState(null);
  const [isRawMode, setIsRawMode] = useState(false);
  const [isDecodingRaw, setIsDecodingRaw] = useState(false);

  // 探测全画幅原始分辨率
  useEffect(() => {
    let cancelled = false;
    async function checkFullRes() {
      if (photoItem?.file) {
        try {
          const info = await extractFullResJpegFromArw(photoItem.file);
          if (!cancelled && info && info.width && info.height) {
            setFullResDims({ width: info.width, height: info.height });
          }
        } catch {
          // ignore
        }
      }
    }
    checkFullRes();
    return () => {
      cancelled = true;
    };
  }, [photoItem?.file]);

  // 触发着色器渲染
  const triggerRender = useCallback((overrides = {}) => {
    if (!rendererRef.current) return;

    const currentLook = overrides.look || selectedLook;
    rendererRef.current.render({
      look: currentLook,
      lutIntensity: overrides.lutIntensity !== undefined ? overrides.lutIntensity : lutIntensity,
      exposure: overrides.exposure !== undefined ? overrides.exposure : exposure,
      contrast: overrides.contrast !== undefined ? overrides.contrast : contrast,
      highlights: overrides.highlights !== undefined ? overrides.highlights : highlights,
      shadows: overrides.shadows !== undefined ? overrides.shadows : shadows,
      wbOffset: overrides.wbOffset !== undefined ? overrides.wbOffset : wbOffset,
      tint: overrides.tint !== undefined ? overrides.tint : tint,
      saturation: overrides.saturation !== undefined ? overrides.saturation : saturation,
      splitMode: isHoldingOriginal ? 2 : (overrides.splitMode !== undefined ? overrides.splitMode : splitMode),
      splitRatio: overrides.splitRatio !== undefined ? overrides.splitRatio : splitRatio,
      isRaw: overrides.isRaw !== undefined ? overrides.isRaw : isRawMode,
    });
  }, [
    selectedLook,
    lutIntensity,
    exposure,
    contrast,
    highlights,
    shadows,
    wbOffset,
    tint,
    saturation,
    splitMode,
    splitRatio,
    isHoldingOriginal,
    isRawMode,
  ]);

  // 初始化 WebGL 渲染引擎
  useEffect(() => {
    if (!canvasRef.current || !photoItem) return;

    let cancelled = false;
    const renderer = new SonyColorRenderer(canvasRef.current);
    rendererRef.current = renderer;

    const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

    // 1. 如果有缩略图预览，先作为秒开骨架占位，避免白屏等待
    if (photoItem.previewUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = photoItem.previewUrl;
      img.onload = async () => {
        if (cancelled || isRawMode) return;
        renderer.setImage(img);
        setIsLoadingLut(true);
        await renderer.loadLut(selectedLook, basePath);
        if (cancelled || isRawMode) return;
        setIsLoadingLut(false);
        triggerRender();
      };
    }

    // 2. 核心：暗房调色始终基于 14-bit RAW 拜耳真实像素数据
    if (photoItem.file) {
      setIsDecodingRaw(true);
      const decoder = new SonyRawDecoder();
      decoder.decode(photoItem.file, {
        halfSize: true, // 交互预览使用快速半分辨率，100ms 秒开
      }).then(async (decoded) => {
        decoder.dispose();
        if (cancelled) return;

        if (decoded.rgb16Data && renderer.setImage16) {
          renderer.setImage16(decoded.rgb16Data, decoded.width, decoded.height);
        } else {
          const canvas = document.createElement('canvas');
          canvas.width = decoded.width;
          canvas.height = decoded.height;
          const ctx = canvas.getContext('2d');
          ctx.putImageData(decoded.imageData, 0, 0);
          renderer.setImage(canvas);
        }

        setIsRawMode(true);
        setIsDecodingRaw(false);

        setIsLoadingLut(true);
        await renderer.loadLut(selectedLook, basePath);
        if (cancelled) return;
        setIsLoadingLut(false);
        triggerRender();
      }).catch((err) => {
        console.warn('RAW 解码失败，回退到预览图:', err);
        if (!cancelled) {
          setIsDecodingRaw(false);
        }
      });
    }

    return () => {
      cancelled = true;
      if (renderer) {
        if (typeof renderer.destroy === 'function') {
          renderer.destroy();
        }
      }
    };
  }, [photoItem]);

  // 当调色参数改变时更新画面
  useEffect(() => {
    triggerRender();
  }, [
    selectedLook,
    lutIntensity,
    exposure,
    contrast,
    highlights,
    shadows,
    wbOffset,
    tint,
    saturation,
    splitMode,
    splitRatio,
    isHoldingOriginal,
    triggerRender,
  ]);

  // 切换外观预设
  const handleSelectLook = async (lookKey) => {
    setSelectedLook(lookKey);
    if (!rendererRef.current) return;

    const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
    setIsLoadingLut(true);
    try {
      await rendererRef.current.loadLut(lookKey, basePath);
    } finally {
      setIsLoadingLut(false);
      triggerRender({ look: lookKey });
    }
  };

  // 分屏拖拽交互
  const handlePointerDown = (e) => {
    if (splitMode !== 1 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    if (clientX === undefined) return;
    const ratio = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width));

    if (Math.abs(ratio - splitRatio) < 0.12) {
      setIsDraggingSplit(true);
      containerRef.current.setPointerCapture?.(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDraggingSplit || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    if (clientX === undefined) return;
    const ratio = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width));
    setSplitRatio(ratio);
    triggerRender({ splitRatio: ratio });
  };

  const handlePointerUp = (e) => {
    if (isDraggingSplit && containerRef.current) {
      setIsDraggingSplit(false);
      try {
        containerRef.current.releasePointerCapture?.(e.pointerId);
      } catch { }
    }
  };

  // 重置调色参数为默认值
  const handleResetParams = () => {
    setExposure(0.0);
    setContrast(0.0);
    setHighlights(0.0);
    setShadows(0.0);
    setWbOffset(0);
    setTint(0.0);
    setSaturation(1.0);
    setLutIntensity(1.0);
  };

  // 重新执行 RAW 拜耳解码
  const handleReloadRaw = async () => {
    if (isDecodingRaw || !photoItem?.file || !rendererRef.current) return;
    setIsDecodingRaw(true);
    try {
      const decoder = new SonyRawDecoder();
      const decoded = await decoder.decode(photoItem.file, {
        halfSize: true,
      });
      decoder.dispose();

      const canvas = document.createElement('canvas');
      canvas.width = decoded.width;
      canvas.height = decoded.height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(decoded.imageData, 0, 0);

      rendererRef.current.setImage(canvas);
      setIsRawMode(true);
      triggerRender();
    } catch (err) {
      console.warn('RAW 解码失败:', err);
    } finally {
      setIsDecodingRaw(false);
    }
  };

  // 导出高质量 JPEG (100% 基于 14-bit RAW 全像素解码)
  const handleExportJpeg = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
      let sourceImg = null;
      let isRawSource = !photoItem?.isJpeg;

      if (photoItem?.isJpeg && photoItem?.file) {
        setExportProgress('正在读取相机原画 JPG...');
        const orientedUrl = photoItem.previewUrl || (await createOrientedJpegUrl(
          new Uint8Array(await photoItem.file.arrayBuffer()),
          photoItem.orientationInfo?.exifOrientation || 1
        ));
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = orientedUrl;
        await img.decode();
        sourceImg = img;
        isRawSource = false;
      } else if (photoItem?.file) {
        setExportProgress('正在执行 14-bit 原厂拜耳去马赛克全像素解码...');
        try {
          const decoder = new SonyRawDecoder();
          const decoded = await decoder.decode(photoItem.file, {
            halfSize: false, // 全画幅完整解析
          });
          decoder.dispose();

          if (decoded && (decoded.rgb16Data || decoded.imageData)) {
            setExportProgress(`正在渲染 ${decoded.width}×${decoded.height} 原片...`);
            if (decoded.rgb16Data) {
              sourceImg = { rgb16Data: decoded.rgb16Data, width: decoded.width, height: decoded.height };
            } else {
              const canvas = document.createElement('canvas');
              canvas.width = decoded.width;
              canvas.height = decoded.height;
              const ctx = canvas.getContext('2d');
              ctx.putImageData(decoded.imageData, 0, 0);
              sourceImg = canvas;
            }
            isRawSource = true;
          }
        } catch (rawErr) {
          console.warn('全像素 RAW 解码失败，尝试降级提取高清底片:', rawErr);
        }
      }

      if (!sourceImg && photoItem?.file) {
        setExportProgress('正在读取内嵌全画幅高清底片...');
        const fullResInfo = await extractFullResJpegFromArw(photoItem.file);
        if (fullResInfo && fullResInfo.bytes) {
          const orientedUrl = await createOrientedJpegUrl(
            fullResInfo.bytes,
            fullResInfo.orientationInfo?.exifOrientation || 1
          );
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = orientedUrl;
          await img.decode();
          sourceImg = img;
          isRawSource = false;
        }
      }

      if (!sourceImg) {
        throw new Error(photoItem?.isJpeg ? '未能加载可用的 JPG 图像源' : '未能加载可用的 RAW 像素源进行导出');
      }

      const params = {
        look: selectedLook,
        lutIntensity,
        exposure,
        contrast,
        highlights,
        shadows,
        wbOffset,
        tint,
        saturation,
        isRaw: isRawSource,
      };

      const resultBlob = await SonyColorRenderer.exportFullResolution({
        fullImg: sourceImg,
        params,
        basePath,
        quality: 0.96,
      });

      const baseName = photoItem.name.replace(/\.[^/.]+$/, '');
      const downloadUrl = URL.createObjectURL(resultBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${baseName}_${selectedLook}_preview.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setExportProgress('JPEG 照片已成功导出');
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress('');
      }, 1500);
    } catch (err) {
      console.error('全尺寸导出失败:', err);
      alert('导出照片失败: ' + (err.message || '未知错误'));
      setIsExporting(false);
      setExportProgress('');
    }
  };

  // 导出 16-bit 线性无损 TIFF (完整施加创意外观 3D-LUT、色调曲线与调色参数)
  const handleExport16BitTiff = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress('正在执行 14-bit RAW 全像素解码并渲染创意外观...');

    try {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
      let sourceImg = null;
      let isRawSource = !photoItem?.isJpeg;

      if (photoItem?.isJpeg && photoItem?.file) {
        setExportProgress('正在读取相机原画 JPG 并准备 16-bit 渲染...');
        const orientedUrl = photoItem.previewUrl || (await createOrientedJpegUrl(
          new Uint8Array(await photoItem.file.arrayBuffer()),
          photoItem.orientationInfo?.exifOrientation || 1
        ));
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = orientedUrl;
        await img.decode();
        sourceImg = img;
        isRawSource = false;
      } else if (photoItem?.file) {
        try {
          const decoder = new SonyRawDecoder();
          const decoded = await decoder.decode(photoItem.file, {
            halfSize: false,
          });
          decoder.dispose();

          if (decoded && (decoded.rgb16Data || decoded.imageData)) {
            setExportProgress(`正在渲染 ${decoded.width}×${decoded.height} 16-bit ${selectedLook} TIFF...`);
            if (decoded.rgb16Data) {
              sourceImg = { rgb16Data: decoded.rgb16Data, width: decoded.width, height: decoded.height };
            } else {
              const canvas = document.createElement('canvas');
              canvas.width = decoded.width;
              canvas.height = decoded.height;
              const ctx = canvas.getContext('2d');
              ctx.putImageData(decoded.imageData, 0, 0);
              sourceImg = canvas;
            }
            isRawSource = true;
          }
        } catch (rawErr) {
          console.warn('全像素 RAW 解码失败，尝试内嵌高清底片:', rawErr);
        }
      }

      if (!sourceImg && photoItem?.file) {
        const fullResInfo = await extractFullResJpegFromArw(photoItem.file);
        if (fullResInfo && fullResInfo.bytes) {
          const orientedUrl = await createOrientedJpegUrl(
            fullResInfo.bytes,
            fullResInfo.orientationInfo?.exifOrientation || 1
          );
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = orientedUrl;
          await img.decode();
          sourceImg = img;
          isRawSource = false;
        }
      }

      if (!sourceImg) {
        throw new Error(photoItem?.isJpeg ? '未能加载可用的 JPG 图像源' : '未能加载可用的 RAW 像素源进行导出');
      }

      const params = {
        look: selectedLook,
        lutIntensity,
        exposure,
        contrast,
        highlights,
        shadows,
        wbOffset,
        tint,
        saturation,
        isRaw: isRawSource,
      };

      const model = photoItem.info?.cameraModel || photoItem.exifResult?.overview?.model || 'ILCE-7C2';
      const tiffBlob = await SonyColorRenderer.exportFullResolutionTiff16({
        fullImg: sourceImg,
        params,
        basePath,
        model,
      });

      const baseName = photoItem.name.replace(/\.[^/.]+$/, '');
      downloadBlob(tiffBlob, `${baseName}_${selectedLook}_16bit.tiff`);

      setExportProgress('16-bit TIFF 导出完成');
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress('');
      }, 1500);
    } catch (err) {
      console.error('导出 16-bit TIFF 失败:', err);
      alert('导出 16-bit TIFF 失败: ' + (err.message || '未知错误'));
      setIsExporting(false);
      setExportProgress('');
    }
  };

  // 直接将当前外观写入 ARW 并保存
  const handleApplyToArw = () => {
    if (onApplyToArw) {
      onApplyToArw(photoItem, selectedLook.toLowerCase(), wbOffset);
      onClose();
    }
  };

  const currentLookInfo = SONY_CREATIVE_LOOKS[selectedLook] || SONY_CREATIVE_LOOKS.ST;

  // --------------------------------------------------------------------------
  // 子面板内容渲染：创意外观面板 (Looks)
  // --------------------------------------------------------------------------
  const renderLooksPanel = (isMobile = false) => (
    <div className="panel-section looks-panel-section">
      <div className="section-head">
        <div className="section-title">
          <Palette size={15} />
          <span>创意外观 (Creative Look)</span>
        </div>
        {isLoadingLut && <span className="loading-tag">加载 3D-LUT...</span>}
      </div>

      {/* 外观强度滑块 */}
      <SliderRow
        icon={Layers}
        label="外观强度 (Amount)"
        value={lutIntensity}
        displayValue={`${Math.round(lutIntensity * 100)}%`}
        min={0}
        max={1}
        step={0.02}
        defaultValue={1.0}
        onChange={setLutIntensity}
      />

      {/* 创意外观网格 / 横向滚动条 */}
      <div className={isMobile ? "mobile-looks-track" : "looks-grid"}>
        {Object.values(SONY_CREATIVE_LOOKS).map((look) => {
          const isSelected = selectedLook === look.key;
          return (
            <button
              key={look.key}
              className={`look-tile ${isSelected ? 'active' : ''}`}
              onClick={() => handleSelectLook(look.key)}
            >
              <div className="tile-top">
                <span className="tile-key">{look.key}</span>
                <span className="tile-badge">{look.badge.replace(/[⚡✨]/g, '') || look.key}</span>
              </div>
              <div className="tile-name">{look.title}</div>
            </button>
          );
        })}
      </div>

      {/* 当前外观说明卡片 */}
      <div className="look-desc-card">
        <div className="card-desc-title">
          <strong>{currentLookInfo.name}</strong> — {currentLookInfo.title}
        </div>
        <div className="card-desc-text">{currentLookInfo.desc}</div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 子面板内容渲染：光效影调面板 (Light)
  // --------------------------------------------------------------------------
  const renderLightPanel = () => (
    <div className="panel-section light-panel-section">
      <div className="section-head">
        <div className="section-title">
          <Sun size={15} />
          <span>光效影调 (Light & Tone)</span>
        </div>
        <button
          className="btn-reset-mini"
          onClick={() => {
            setExposure(0);
            setContrast(0);
            setHighlights(0);
            setShadows(0);
          }}
          title="重置光效参数"
        >
          <RotateCcw size={11} />
          重置光效
        </button>
      </div>

      <SliderRow
        icon={Sun}
        label="曝光补偿 (Exposure)"
        value={exposure}
        displayValue={exposure > 0 ? `+${exposure.toFixed(2)} EV` : `${exposure.toFixed(2)} EV`}
        min={-2.5}
        max={2.5}
        step={0.05}
        defaultValue={0.0}
        onChange={setExposure}
      />

      <SliderRow
        icon={Contrast}
        label="对比度 (Contrast)"
        value={contrast}
        displayValue={contrast > 0 ? `+${contrast}` : `${contrast}`}
        min={-30}
        max={30}
        step={1}
        defaultValue={0}
        onChange={setContrast}
      />

      <SliderRow
        label="高光压制 / 提亮 (Highlights)"
        value={highlights}
        displayValue={highlights > 0 ? `+${highlights}` : `${highlights}`}
        min={-30}
        max={30}
        step={1}
        defaultValue={0}
        onChange={setHighlights}
      />

      <SliderRow
        label="阴影提升 / 压暗 (Shadows)"
        value={shadows}
        displayValue={shadows > 0 ? `+${shadows}` : `${shadows}`}
        min={-30}
        max={30}
        step={1}
        defaultValue={0}
        onChange={setShadows}
      />
    </div>
  );

  // --------------------------------------------------------------------------
  // 子面板内容渲染：色彩白平衡面板 (Color)
  // --------------------------------------------------------------------------
  const renderColorPanel = () => (
    <div className="panel-section color-panel-section">
      <div className="section-head">
        <div className="section-title">
          <Thermometer size={15} />
          <span>色彩与白平衡 (Color & WB)</span>
        </div>
        <button
          className="btn-reset-mini"
          onClick={() => {
            setWbOffset(0);
            setSaturation(1.0);
          }}
          title="重置色彩参数"
        >
          <RotateCcw size={11} />
          重置色彩
        </button>
      </div>

      {/* 色温微调 */}
      <SliderRow
        icon={Thermometer}
        label="色温偏移 (WB Offset)"
        value={wbOffset}
        displayValue={wbOffset > 0 ? `+${wbOffset}K` : `${wbOffset}K`}
        min={-1500}
        max={1500}
        step={50}
        defaultValue={0}
        onChange={setWbOffset}
      />

      <div className="wb-quick-pills">
        <button
          className={`wb-pill ${wbOffset === 0 ? 'active' : ''}`}
          onClick={() => setWbOffset(0)}
        >
          0K (原片基准)
        </button>
        <button
          className={`wb-pill ${wbOffset === 300 ? 'active' : ''}`}
          onClick={() => setWbOffset(300)}
        >
          +300K (微暖)
        </button>
        <button
          className={`wb-pill ${wbOffset === 600 ? 'active' : ''}`}
          onClick={() => setWbOffset(600)}
        >
          +600K (浓暖)
        </button>
        <button
          className={`wb-pill ${wbOffset === -300 ? 'active' : ''}`}
          onClick={() => setWbOffset(-300)}
        >
          -300K (清冷)
        </button>
      </div>

      {/* 饱和度 */}
      <SliderRow
        label="自然饱和度 (Saturation)"
        value={saturation}
        displayValue={`${Math.round(saturation * 100)}%`}
        min={0.0}
        max={2.0}
        step={0.05}
        defaultValue={1.0}
        onChange={setSaturation}
      />
    </div>
  );

  // --------------------------------------------------------------------------
  // 子面板内容渲染：导出分享面板 (Export)
  // --------------------------------------------------------------------------
  const renderExportPanel = () => (
    <div className="panel-section export-panel-section">
      <div className="section-head">
        <div className="section-title">
          <Download size={15} />
          <span>导出与母版保存</span>
        </div>
      </div>

      <div className="studio-actions-footer">
        {photoItem?.isJpeg ? (
          <>
            {/* 1. 核心：导出高质量渲染 JPEG */}
            <button
              className="studio-btn studio-btn-apply"
              onClick={() => handleExportJpeg()}
              disabled={isExporting}
              title="导出应用当前创意外观 LUT 的高质量调色照片"
            >
              {isExporting ? (
                <>
                  <span className="spinner-mini" />
                  <span>{exportProgress || '正在渲染导出...'}</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <div className="btn-text-col">
                    <span className="btn-main-text">
                      {fullResDims
                        ? `导出高质量调色照片 (${fullResDims.width}×${fullResDims.height})`
                        : '导出高质量调色照片 (JPG)'}
                    </span>
                    <span className="btn-sub-text">
                      原厂 3D-LUT 胶片色彩渲染 · 保持原始高清分辨率
                    </span>
                  </div>
                </>
              )}
            </button>

            {/* 2. 应用调色到列表卡片 */}
            <button
              className="studio-btn studio-btn-export"
              onClick={handleApplyToArw}
              disabled={isExporting}
              title="将当前外观与调色参数应用保存到列表卡片中"
            >
              <CheckCircle2 size={18} />
              <div className="btn-text-col">
                <span className="btn-main-text">应用调色到列表卡片</span>
                <span className="btn-sub-text">更新卡片缩略图与外观设置</span>
              </div>
            </button>

            {/* 3. 导出 16-bit TIFF */}
            <button
              className="studio-btn studio-btn-tiff"
              onClick={handleExport16BitTiff}
              disabled={isExporting}
              title="导出 16-bit 线性无损 TIFF"
            >
              <FileStack size={18} />
              <div className="btn-text-col">
                <span className="btn-main-text">导出 16-bit 无损母版 TIFF</span>
                <span className="btn-sub-text">48-bit RGB · Adobe RGB 宽容度母版，供 PS/LR 精修</span>
              </div>
            </button>

            {/* 4. 保存原始照片 (未调色) */}
            <button
              className="studio-btn studio-btn-raw"
              onClick={handleExtractOriginal}
              disabled={isExporting}
              title="保存未经调色的原始 JPG 照片"
            >
              <FileImage size={18} />
              <div className="btn-text-col">
                <span className="btn-main-text">保存原始 JPG (未调色原图)</span>
                <span className="btn-sub-text">直接下载相机拍摄的原始文件</span>
              </div>
            </button>
          </>
        ) : (
          <>
            {/* 1. 核心：将外观写入 ARW */}
            <button
              className="studio-btn studio-btn-apply"
              onClick={handleApplyToArw}
              disabled={isExporting}
              title="将当前外观预设直接写入 ARW 文件"
            >
              <CheckCircle2 size={18} />
              <div className="btn-text-col">
                <span className="btn-main-text">将此外观写入并导出 ARW</span>
                <span className="btn-sub-text">索尼原厂无损标准 · 支持官方 Imaging Edge 自由调整</span>
              </div>
            </button>

            {/* 2. 导出 16-bit TIFF */}
            <button
              className="studio-btn studio-btn-tiff"
              onClick={handleExport16BitTiff}
              disabled={isExporting}
              title="导出 16-bit 线性无损 TIFF (保留 14-bit RAW 全部动态范围，48位 RGB · Adobe RGB 广色域，供 Photoshop / Lightroom / Capture One 精修)"
            >
              <FileStack size={18} />
              <div className="btn-text-col">
                <span className="btn-main-text">导出 16-bit 无损母版 TIFF</span>
                <span className="btn-sub-text">48-bit RGB · Adobe RGB 宽容度母版，保留 14-bit 满动态</span>
              </div>
            </button>

            {/* 3. 导出高质量渲染 JPEG */}
            <button
              className="studio-btn studio-btn-export"
              onClick={() => handleExportJpeg()}
              disabled={isExporting}
              title="导出高分辨率渲染 JPEG 文件"
            >
              {isExporting ? (
                <>
                  <span className="spinner-mini" />
                  <span>{exportProgress || '正在渲染导出...'}</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <div className="btn-text-col">
                    <span className="btn-main-text">
                      {fullResDims
                        ? `导出全像素照片 (${fullResDims.width}×${fullResDims.height})`
                        : '导出高质量照片 (JPG)'}
                    </span>
                    <span className="btn-sub-text">
                      全画幅 3D-LUT 色彩渲染 · 即刻分享
                    </span>
                  </div>
                </>
              )}
            </button>

            {/* 4. 提取内嵌全尺寸高清 JPG */}
            <button
              className="studio-btn studio-btn-raw"
              onClick={handleExtractOriginal}
              disabled={isExporting}
              title="提取 ARW 内部嵌入的全像素高清 JPG 原底"
            >
              <FileImage size={18} />
              <div className="btn-text-col">
                <span className="btn-main-text">提取内嵌全尺寸高清 JPG 原底</span>
                <span className="btn-sub-text">原厂直出全像素内嵌底片 · 免转 RAW 即刻查看</span>
              </div>
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="studio-overlay" onPointerUp={handlePointerUp}>
      <div className="studio-modal">
        {/* ===================================================================
            顶部工具栏 (Top Bar) - 参照 Lightroom Mobile: 极简沉浸，触控大热区
            =================================================================== */}
        <div className="studio-header">
          {/* 左侧：返回 / 关闭 */}
          <button
            className="studio-btn-close"
            onClick={onClose}
            title="关闭调色暗房"
            aria-label="关闭"
          >
            <X size={20} />
          </button>

          {/* 中间：居中元信息 (文件名 + 拍摄参数 + 快门亮点) */}
          <div className="studio-title-group">
            <span className="studio-filename">{photoItem.name}</span>
            <div
              className="studio-meta-sub"
              onClick={() => onOpenExif?.(photoItem)}
              title="点击查看完整 EXIF 元数据"
              style={{ cursor: 'pointer' }}
            >
              {photoItem?.file && (
                <span className="studio-badge-mini">{photoItem.isJpeg ? 'JPG 照片' : '14-bit RAW'}</span>
              )}
              {photoItem.exifResult?.overview?.shutterCount !== undefined && (
                <span
                  className="studio-shutter-tag"
                  title={`Sony 硬件物理快门释放次数: ${photoItem.exifResult.overview.shutterCount.toLocaleString()} 次`}
                >
                  <Gauge size={10} />
                  <span>快门 {photoItem.exifResult.overview.shutterCount.toLocaleString()}</span>
                </span>
              )}
              {photoItem.exifResult?.overview && (
                <span className="studio-exposure-tag">
                  {[
                    photoItem.exifResult.overview.fNumber ? `f/${photoItem.exifResult.overview.fNumber}` : null,
                    photoItem.exifResult.overview.exposureTimeString,
                    photoItem.exifResult.overview.iso ? `ISO ${photoItem.exifResult.overview.iso}` : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </div>

          {/* 右侧：操作区 (原图对比、分屏切换、旋转、EXIF、复位) */}
          <div className="studio-top-actions">
            {/* 旋转纠偏 90° */}
            <button
              className="view-btn"
              onClick={handleRotate}
              title="旋转纠偏画面 90°"
            >
              <RotateCw size={14} />
              <span className="hide-on-mobile-text">旋转</span>
            </button>

            {/* 查看 EXIF 详情 */}
            <button
              className="view-btn"
              onClick={() => onOpenExif?.(photoItem)}
              title="查看完整 EXIF 元数据"
            >
              <Info size={14} />
              <span className="hide-on-mobile-text">EXIF</span>
            </button>

            {/* Lightroom 经典：按住对比原图 */}
            <button
              className={`view-btn hold-btn ${isHoldingOriginal ? 'holding' : ''}`}
              onMouseDown={() => setIsHoldingOriginal(true)}
              onMouseUp={() => setIsHoldingOriginal(false)}
              onTouchStart={() => setIsHoldingOriginal(true)}
              onTouchEnd={() => setIsHoldingOriginal(false)}
              title="按住查看拍摄原图"
            >
              <Eye size={15} />
              <span className="hide-on-mobile-text">原图对比</span>
            </button>

            {/* 分屏模式切换 (在桌面端及宽屏时展示) */}
            <div className="view-mode-toggle desktop-only-flex">
              <button
                className={`view-btn ${splitMode === 0 ? 'active' : ''}`}
                onClick={() => setSplitMode(0)}
                title="单图视图"
              >
                单图
              </button>
              <button
                className={`view-btn ${splitMode === 1 ? 'active' : ''}`}
                onClick={() => setSplitMode(1)}
                title="左右分屏"
              >
                <Columns size={13} />
                分屏
              </button>
            </div>

            {/* 一键复位所有调色参数 */}
            <button
              className="view-btn btn-reset-top"
              onClick={handleResetParams}
              title="重置所有调色参数"
            >
              <RotateCcw size={15} />
              <span className="hide-on-mobile-text">重置</span>
            </button>
          </div>
        </div>

        {/* ===================================================================
            主体工作区 (Main Darkroom Viewport)
            =================================================================== */}
        <div className="studio-main">
          {/* 左侧/中央画布视口 */}
          <div
            className="studio-viewport"
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            style={{ touchAction: 'none' }}
          >
            <div
              className={`canvas-wrapper ${photoItem.orientationInfo?.isPortrait ? 'wrapper-portrait' : 'wrapper-landscape'}`}
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
              }}
            >
              <canvas ref={canvasRef} className="render-canvas" />

              {/* 分屏拖拽指示中线 */}
              {splitMode === 1 && (
                <div
                  className="split-divider"
                  style={{ left: `${splitRatio * 100}%` }}
                >
                  <div className="divider-handle">
                    <span>‹ ›</span>
                  </div>
                </div>
              )}

              {/* 分屏标签提示 */}
              {splitMode === 1 && (
                <div className="split-labels">
                  <div className="label-box label-left">拍摄原图</div>
                  <div className="label-box label-right">
                    {currentLookInfo.name} · 色彩校准
                  </div>
                </div>
              )}

              {/* 按住对比时的全屏原图浮水提示 */}
              {isHoldingOriginal && (
                <div className="holding-original-badge">
                  <Eye size={14} />
                  <span>拍摄原图 (Before)</span>
                </div>
              )}
            </div>

            {/* 视口浮动控制 (缩放) */}
            <div
              className="viewport-controls"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="vp-btn"
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                title="放大"
                aria-label="放大"
              >
                <ZoomIn size={15} />
              </button>
              <span className="vp-zoom-text">{Math.round(zoomLevel * 100)}%</span>
              <button
                className="vp-btn"
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                title="缩小"
                aria-label="缩小"
              >
                <ZoomOut size={15} />
              </button>
              <button
                className="vp-btn"
                onClick={() => setZoomLevel(1.0)}
                title="适应视口"
                aria-label="适应视口"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* =================================================================
              桌面端侧边栏 (Desktop Sidebar) - 宽屏下展示
              ================================================================= */}
          <div className="studio-sidebar desktop-sidebar">
            {renderLooksPanel(false)}
            {renderLightPanel()}
            {renderColorPanel()}
            {renderExportPanel()}
          </div>
        </div>

        {/* ===================================================================
            移动端专属：Lightroom Mobile 底部抽屉与一级导航系统
            =================================================================== */}
        <div className="mobile-darkroom-footer">
          {/* 上层：当前选中的二级工具抽屉 (Tool Drawer) */}
          <div className="mobile-tool-drawer">
            {mobileTab === 'looks' && renderLooksPanel(true)}
            {mobileTab === 'light' && renderLightPanel()}
            {mobileTab === 'color' && renderColorPanel()}
            {mobileTab === 'export' && renderExportPanel()}
          </div>

          {/* 最底层：Lightroom 标志性一级分类工具栏 (Primary Category Bar) */}
          <nav className="mobile-primary-tabbar">
            <button
              type="button"
              className={`mobile-tab-item ${mobileTab === 'looks' ? 'active' : ''}`}
              onClick={() => setMobileTab('looks')}
            >
              <div className="tab-icon-wrap">
                <Palette size={20} />
              </div>
              <span className="tab-label">创意外观</span>
            </button>

            <button
              type="button"
              className={`mobile-tab-item ${mobileTab === 'light' ? 'active' : ''}`}
              onClick={() => setMobileTab('light')}
            >
              <div className="tab-icon-wrap">
                <Sun size={20} />
              </div>
              <span className="tab-label">光效影调</span>
            </button>

            <button
              type="button"
              className={`mobile-tab-item ${mobileTab === 'color' ? 'active' : ''}`}
              onClick={() => setMobileTab('color')}
            >
              <div className="tab-icon-wrap">
                <Thermometer size={20} />
              </div>
              <span className="tab-label">色彩校准</span>
            </button>

            <button
              type="button"
              className={`mobile-tab-item ${mobileTab === 'export' ? 'active' : ''}`}
              onClick={() => setMobileTab('export')}
            >
              <div className="tab-icon-wrap">
                <Download size={20} />
              </div>
              <span className="tab-label">导出保存</span>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
