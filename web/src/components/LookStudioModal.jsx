import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  RotateCcw,
  Sliders,
  Columns,
  Eye,
  Sparkles,
  Sun,
  Contrast,
  Palette,
  Thermometer,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { SONY_CREATIVE_LOOKS, SonyColorRenderer } from '../core/sonyColorEngine';
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
  const [wbOffset, setWbOffset] = useState(0); // 默认 0 (纯净索尼原厂基准)
  const [tint, setTint] = useState(0.0);
  const [saturation, setSaturation] = useState(1.0);

  // 分屏对比模式: 0 = 单图, 1 = 左右分屏, 2 = 按住对比原图
  const [splitMode, setSplitMode] = useState(1);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isLoadingLut, setIsLoadingLut] = useState(false);

  // 触发着色器渲染
  const triggerRender = useCallback(() => {
    if (!rendererRef.current) return;

    rendererRef.current.render({
      look: selectedLook,
      lutIntensity,
      exposure,
      contrast,
      highlights,
      shadows,
      wbOffset,
      tint,
      saturation,
      splitMode: isHoldingOriginal ? 2 : splitMode,
      splitRatio,
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
  ]);

  // 初始化 WebGL 渲染引擎
  useEffect(() => {
    if (!canvasRef.current || !photoItem?.previewUrl) return;

    const renderer = new SonyColorRenderer(canvasRef.current);
    rendererRef.current = renderer;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = photoItem.previewUrl;
    img.onload = async () => {
      renderer.setImage(img);
      // 预加载默认 LUT
      setIsLoadingLut(true);
      await renderer.loadLut(selectedLook, import.meta.env.BASE_URL.replace(/\/$/, ''));
      setIsLoadingLut(false);
      triggerRender();
    };

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [photoItem?.previewUrl, selectedLook, triggerRender]);

  // 参数改变时重绘
  useEffect(() => {
    triggerRender();
  }, [triggerRender]);

  // 切换创意外观
  const handleSelectLook = async (lookKey) => {
    setSelectedLook(lookKey);
    if (rendererRef.current) {
      setIsLoadingLut(true);
      await rendererRef.current.loadLut(lookKey, import.meta.env.BASE_URL.replace(/\/$/, ''));
      setIsLoadingLut(false);
      triggerRender();
    }
  };

  // 分屏滑块拖拽逻辑
  const handlePointerDown = (e) => {
    if (splitMode !== 1) return;
    setIsDraggingSplit(true);
    updateSplitRatio(e);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingSplit || splitMode !== 1) return;
    updateSplitRatio(e);
  };

  const handlePointerUp = () => {
    setIsDraggingSplit(false);
  };

  const updateSplitRatio = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0.01, Math.min(0.99, x / rect.width));
    setSplitRatio(ratio);
  };

  // 重置所有调色参数
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

  // 导出高保真调色结果为 JPEG
  const handleExportJpeg = () => {
    if (!canvasRef.current) return;

    // 临时渲染全图 (不带分屏线)
    if (rendererRef.current) {
      rendererRef.current.render({
        look: selectedLook,
        lutIntensity,
        exposure,
        contrast,
        highlights,
        shadows,
        wbOffset,
        tint,
        saturation,
        splitMode: 0,
        splitRatio: 1.0,
      });
    }

    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.96);
    const baseName = photoItem.name.replace(/\.[^/.]+$/, '');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${baseName}_${selectedLook}_Look.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 恢复原来的分屏状态
    triggerRender();
  };

  // 直接将当前外观注入 ARW 并保存
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
            <span className="studio-badge">Sony Creative Look Studio</span>
            <span className="studio-filename">{photoItem.name}</span>
          </div>

          <div className="studio-top-actions">
            {/* 分屏模式按钮 */}
            <div className="view-mode-toggle">
              <button
                className={`view-btn ${splitMode === 0 ? 'active' : ''}`}
                onClick={() => setSplitMode(0)}
                title="单图预览"
              >
                单图
              </button>
              <button
                className={`view-btn ${splitMode === 1 ? 'active' : ''}`}
                onClick={() => setSplitMode(1)}
                title="左右分屏实时对比 (可拖拽中线)"
              >
                <Columns size={14} />
                左右分屏
              </button>
              <button
                className="view-btn hold-btn"
                onMouseDown={() => setIsHoldingOriginal(true)}
                onMouseUp={() => setIsHoldingOriginal(false)}
                onTouchStart={() => setIsHoldingOriginal(true)}
                onTouchEnd={() => setIsHoldingOriginal(false)}
                title="按住临时查看拍摄原图"
              >
                <Eye size={14} />
                按住看原图
              </button>
            </div>

            <button className="studio-btn-close" onClick={onClose} title="关闭工作室">
              <X size={20} />
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
          >
            <div
              className="canvas-wrapper"
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
                    {currentLookInfo.name} · 原厂色彩
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
              >
                <ZoomIn size={16} />
              </button>
              <span className="vp-zoom-text">{Math.round(zoomLevel * 100)}%</span>
              <button
                className="vp-btn"
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                title="缩小"
              >
                <ZoomOut size={16} />
              </button>
              <button
                className="vp-btn"
                onClick={() => setZoomLevel(1.0)}
                title="适应画布"
              >
                <Maximize2 size={15} />
              </button>
            </div>
          </div>

          {/* 右侧索尼调色控制面板 (Edit.app 布局) */}
          <div className="studio-sidebar">
            {/* 创意外观选择网格 */}
            <div className="panel-section">
              <div className="section-head">
                <div className="section-title">
                  <Palette size={16} />
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
                        {look.badge.includes('⚡') ? (
                          <span className="tile-badge badge-glow">FL2/3</span>
                        ) : (
                          <span className="tile-badge">{look.badge}</span>
                        )}
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

            {/* 胶片浓度与色彩优化 */}
            <div className="panel-section">
              <div className="section-head">
                <div className="section-title">
                  <Layers size={16} />
                  <span>3D-LUT 胶片强度与色温微调</span>
                </div>
                <button
                  className="btn-reset-mini"
                  onClick={handleResetParams}
                  title="重置所有参数"
                >
                  <RotateCcw size={12} />
                  重置
                </button>
              </div>

              {/* 3D-LUT 浓度 */}
              <div className="slider-item">
                <div className="slider-label-row">
                  <span>胶片 3D-LUT 强度</span>
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

              {/* 色温微调 (带 -400K 一键去黄通透预设) */}
              <div className="slider-item">
                <div className="slider-label-row">
                  <span className="flex-row">
                    <Thermometer size={14} />
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
                    className={`wb-pill ${wbOffset === -400 ? 'active' : ''}`}
                    onClick={() => setWbOffset(-400)}
                    title="索尼官方 FL2/FL3 最佳伴侣：修正室内偏黄白底"
                  >
                    ✨ -400K 去黄通透 (推荐)
                  </button>
                  <button
                    className={`wb-pill ${wbOffset === -200 ? 'active' : ''}`}
                    onClick={() => setWbOffset(-200)}
                  >
                    -200K 微冷
                  </button>
                  <button
                    className={`wb-pill ${wbOffset === 0 ? 'active' : ''}`}
                    onClick={() => setWbOffset(0)}
                  >
                    0K 拍摄原片
                  </button>
                </div>
              </div>
            </div>

            {/* 基础影调调节 (曝光/对比/高光/阴影) */}
            <div className="panel-section">
              <div className="section-head">
                <div className="section-title">
                  <Sliders size={16} />
                  <span>影调与色彩微调 (Tone & Color)</span>
                </div>
              </div>

              {/* 曝光 */}
              <div className="slider-item">
                <div className="slider-label-row">
                  <span className="flex-row">
                    <Sun size={14} />
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
                    <Contrast size={14} />
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
                  <span>高光抑制 / 提亮</span>
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
                onClick={handleExportJpeg}
                title="导出当前创意外观渲染图 (高质量 JPEG)"
              >
                <Download size={16} />
                导出高清照片 (JPG)
              </button>

              <button
                className="studio-btn studio-btn-apply"
                onClick={handleApplyToArw}
                title="以此创意外观作为默认外观，直接注入并解锁 ARW 文件"
              >
                <Sparkles size={16} />
                以此外观注入并保存 RAW
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
