import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  RotateCcw,
  Sliders,
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
  Layers2
} from 'lucide-react';
import { SONY_CREATIVE_LOOKS, SonyColorRenderer } from '../core/sonyColorEngine';
import { extractFullResJpegFromArw, createOrientedJpegUrl } from '../core/previewExtractor';
import { SonyRawDecoder } from '../core/rawDecoder';
import './LookStudioModal.css';

export default function LookStudioModal({ photoItem, onClose, onApplyToArw }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(null);

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

        const canvas = document.createElement('canvas');
        canvas.width = decoded.width;
        canvas.height = decoded.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(decoded.imageData, 0, 0);

        renderer.setImage(canvas);
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
        } else if (typeof renderer.dispose === 'function') {
          renderer.dispose();
        }
      }
      rendererRef.current = null;
    };
  }, [photoItem]);

  // 当调色参数变化时触发重绘
  useEffect(() => {
    triggerRender();
  }, [
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

  // 切换创意外观
  const handleSelectLook = async (lookKey) => {
    if (selectedLook === lookKey || !rendererRef.current) return;
    setSelectedLook(lookKey);
    setIsLoadingLut(true);

    try {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
      await rendererRef.current.loadLut(lookKey, basePath);
    } catch (e) {
      console.warn('LUT 加载提示:', e);
    } finally {
      setIsLoadingLut(false);
      triggerRender({ look: lookKey });
    }
  };

  // 分屏滑块拖拽逻辑 (支持触控和鼠标)
  const updateSplitRatioFromClientX = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0.01, Math.min(0.99, x / rect.width));
    setSplitRatio(ratio);
  };

  const handlePointerDown = (e) => {
    if (splitMode !== 1) return;
    setIsDraggingSplit(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateSplitRatioFromClientX(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingSplit || splitMode !== 1) return;
    updateSplitRatioFromClientX(e.clientX);
  };

  const handlePointerUp = (e) => {
    setIsDraggingSplit(false);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  // 重置调色参数
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

      let isRawSource = true;

      if (photoItem?.file) {
        setExportProgress('正在执行 14-bit 原厂拜耳去马赛克全像素解码...');
        try {
          const decoder = new SonyRawDecoder();
          const decoded = await decoder.decode(photoItem.file, {
            halfSize: false, // 全画幅完整解析
          });
          decoder.dispose();

          if (decoded && decoded.imageData) {
            setExportProgress(`正在渲染 ${decoded.width}×${decoded.height} 原片...`);
            const canvas = document.createElement('canvas');
            canvas.width = decoded.width;
            canvas.height = decoded.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(decoded.imageData, 0, 0);
            sourceImg = canvas;
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
        throw new Error('未能加载可用的 RAW 像素源进行导出');
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
      const w = sourceImg.naturalWidth || sourceImg.width;
      const h = sourceImg.naturalHeight || sourceImg.height;
      const resSuffix = w ? `${w}x${h}` : 'FullRes';
      a.download = `${baseName}_${selectedLook}_${resSuffix}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setExportProgress('导出完成');
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress('');
      }, 1500);
    } catch (err) {
      console.error('导出失败:', err);
      alert('导出照片失败: ' + err.message);
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

  return (
    <div className="studio-overlay" onPointerUp={handlePointerUp}>
      <div className="studio-modal">
        {/* 顶部工具栏 */}
        <div className="studio-header">
          <div className="studio-title-group">
            <span className="studio-badge">RAW 外观调色暗房</span>
            <span className="studio-filename">{photoItem.name}</span>
            {photoItem.orientationInfo && (
              <span className="studio-orient-tag">
                {photoItem.orientationInfo.label} {photoItem.orientationInfo.ratioTag}
              </span>
            )}
          </div>

          <div className="studio-top-actions">
            {/* 分屏模式按钮 */}
            <div className="view-mode-toggle">
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
                title="分屏对比 (拖拽中线)"
              >
                <Columns size={13} />
                分屏
              </button>
              <button
                className="view-btn hold-btn"
                onMouseDown={() => setIsHoldingOriginal(true)}
                onMouseUp={() => setIsHoldingOriginal(false)}
                onTouchStart={() => setIsHoldingOriginal(true)}
                onTouchEnd={() => setIsHoldingOriginal(false)}
                title="按住查看拍摄原图"
              >
                <Eye size={13} />
                原图
              </button>
            </div>

            {/* 14-bit RAW 状态指示 */}
            {photoItem?.file && (
              <button
                className={`view-btn raw-mode-btn ${isRawMode ? 'active-raw' : ''}`}
                onClick={handleReloadRaw}
                disabled={isDecodingRaw}
                title={isRawMode ? "14-bit 真实拜耳 RAW 像素渲染管线 (点击可重载)" : "正在解码 RAW 拜耳数据"}
              >
                {isDecodingRaw ? (
                  <>
                    <span className="spinner-mini" />
                    <span>RAW 解码中...</span>
                  </>
                ) : (
                  <>
                    <Layers2 size={13} />
                    <span>{isRawMode ? '14-bit RAW 已就绪' : 'RAW 拜耳解码'}</span>
                  </>
                )}
              </button>
            )}

            <button className="studio-btn-close" onClick={onClose} title="关闭暗房" aria-label="关闭">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 主体视窗区域 */}
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
            </div>

            {/* 视口浮动控制 (缩放) */}
            <div className="viewport-controls">
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

          {/* 右侧参数控制面板 */}
          <div className="studio-sidebar">
            {/* 创意外观网格 */}
            <div className="panel-section">
              <div className="section-head">
                <div className="section-title">
                  <Palette size={15} />
                  <span>创意外观 (Creative Look)</span>
                </div>
                {isLoadingLut && <span className="loading-tag">加载 3D-LUT...</span>}
              </div>

              <div className="looks-grid">
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

            {/* 胶片浓度与色温校正 */}
            <div className="panel-section">
              <div className="section-head">
                <div className="section-title">
                  <Layers size={15} />
                  <span>3D-LUT 强度与色温微调</span>
                </div>
                <button
                  className="btn-reset-mini"
                  onClick={handleResetParams}
                  title="重置所有参数"
                >
                  <RotateCcw size={11} />
                  重置
                </button>
              </div>

              {/* 3D-LUT 浓度 */}
              <div className="slider-item">
                <div className="slider-label-row">
                  <span>3D-LUT 强度</span>
                  <span className="slider-val">{Math.round(lutIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={lutIntensity}
                  onChange={(e) => setLutIntensity(parseFloat(e.target.value))}
                />
              </div>

              {/* 色温微调 */}
              <div className="slider-item">
                <div className="slider-label-row">
                  <span className="flex-row">
                    <Thermometer size={13} />
                    色温偏移 (WB Offset)
                  </span>
                  <span className="slider-val">
                    {wbOffset > 0 ? `+${wbOffset}K` : `${wbOffset}K`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-1500"
                  max="1500"
                  step="50"
                  value={wbOffset}
                  onChange={(e) => setWbOffset(parseFloat(e.target.value))}
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
                    +300K (自然微暖)
                  </button>
                  <button
                    className={`wb-pill ${wbOffset === 600 ? 'active' : ''}`}
                    onClick={() => setWbOffset(600)}
                  >
                    +600K (浓郁暖调)
                  </button>
                  <button
                    className={`wb-pill ${wbOffset === -300 ? 'active' : ''}`}
                    onClick={() => setWbOffset(-300)}
                  >
                    -300K (清冷微冷)
                  </button>
                </div>
              </div>
            </div>

            {/* 基础影调调节 */}
            <div className="panel-section">
              <div className="section-head">
                <div className="section-title">
                  <Sliders size={15} />
                  <span>影调与色彩微调 (Tone & Color)</span>
                </div>
              </div>

              {/* 曝光 */}
              <div className="slider-item">
                <div className="slider-label-row">
                  <span className="flex-row">
                    <Sun size={13} />
                    曝光补偿 (Exposure)
                  </span>
                  <span className="slider-val">
                    {exposure > 0 ? `+${exposure.toFixed(2)}` : exposure.toFixed(2)} EV
                  </span>
                </div>
                <input
                  type="range"
                  min="-2.5"
                  max="2.5"
                  step="0.05"
                  value={exposure}
                  onChange={(e) => setExposure(parseFloat(e.target.value))}
                />
              </div>

              {/* 对比度 */}
              <div className="slider-item">
                <div className="slider-label-row">
                  <span className="flex-row">
                    <Contrast size={13} />
                    对比度 (Contrast)
                  </span>
                  <span className="slider-val">{contrast > 0 ? `+${contrast}` : contrast}</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={contrast}
                  onChange={(e) => setContrast(parseFloat(e.target.value))}
                />
              </div>

              {/* 高光 */}
              <div className="slider-item">
                <div className="slider-label-row">
                  <span>高光压制 / 提亮</span>
                  <span className="slider-val">{highlights > 0 ? `+${highlights}` : highlights}</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={highlights}
                  onChange={(e) => setHighlights(parseFloat(e.target.value))}
                />
              </div>

              {/* 阴影 */}
              <div className="slider-item">
                <div className="slider-label-row">
                  <span>阴影提升 / 压暗</span>
                  <span className="slider-val">{shadows > 0 ? `+${shadows}` : shadows}</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={shadows}
                  onChange={(e) => setShadows(parseFloat(e.target.value))}
                />
              </div>

              {/* 饱和度 */}
              <div className="slider-item">
                <div className="slider-label-row">
                  <span>饱和度 (Saturation)</span>
                  <span className="slider-val">{Math.round(saturation * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={saturation}
                  onChange={(e) => setSaturation(parseFloat(e.target.value))}
                />
              </div>
            </div>

            {/* 底部导出与注入操作 */}
            <div className="studio-actions-footer">
              <button
                className="studio-btn studio-btn-export"
                onClick={() => handleExportJpeg('full')}
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
                    <Download size={16} />
                    <div className="btn-text-col">
                      <span className="btn-main-text">
                        {fullResDims
                          ? `导出高分辨率照片 (${fullResDims.width}×${fullResDims.height})`
                          : '导出高分辨率渲染图 (JPG)'}
                      </span>
                      <span className="btn-sub-text">
                        全画幅色彩渲染 · 3D-LUT 矩阵
                      </span>
                    </div>
                  </>
                )}
              </button>

              <button
                className="studio-btn studio-btn-apply"
                onClick={handleApplyToArw}
                disabled={isExporting}
                title="将当前外观预设直接写入 ARW 文件"
              >
                <CheckCircle2 size={16} />
                <span>将此外观写入并导出 ARW</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
