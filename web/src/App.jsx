import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Trash2,
  Eye,
  Archive,
  RefreshCw,
  Plus,
  HelpCircle,
  X,
  Maximize2,
  Sliders,
  ShieldCheck,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import JSZip from 'jszip';
import {
  inspectArw,
  processArw,
  ALL_CREATIVE_LOOKS,
  TARGET_MODELS,
  PROFILE_MODES
} from './core/camoufArw';
import { extractPreviewFromArw, createJpegObjectUrl } from './core/previewExtractor';
import './App.css';

export default function App() {
  const [files, setFiles] = useState([]);
  const [targetModel, setTargetModel] = useState('a7c2');
  const [defaultLook, setDefaultLook] = useState('fl2');
  const [profileMode, setProfileMode] = useState('balanced');
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [inspectTarget, setInspectTarget] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  const fileInputRef = useRef(null);

  // 清理生成的 Object URL 防止内存泄漏
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        if (f.processedBlobUrl) URL.revokeObjectURL(f.processedBlobUrl);
      });
    };
  }, []);

  // 添加文件到队列并异步极速提取预览图与元数据
  const addFilesToQueue = async (newFileList) => {
    const rawFiles = Array.from(newFileList).filter((f) =>
      /\.(arw|srf|sr2)$/i.test(f.name)
    );

    if (rawFiles.length === 0) return;

    const newItems = await Promise.all(
      rawFiles.map(async (file) => {
        const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;

        let info = null;
        let previewUrl = null;

        try {
          // 1. 切片 256KB 极速解析元数据
          const sliceHeader = await file.slice(0, 256 * 1024).arrayBuffer();
          info = inspectArw(sliceHeader, file.name);
        } catch (e) {
          console.warn('元数据解析警告:', e);
        }

        try {
          // 2. 切片读取前 3.5MB，0.5ms 内秒级提取 1616x1080 内嵌 HD JPEG 预览
          const jpegBytes = await extractPreviewFromArw(file);
          if (jpegBytes) {
            previewUrl = createJpegObjectUrl(jpegBytes);
          }
        } catch (e) {
          console.warn('预览图提取警告:', e);
        }

        return {
          id,
          file,
          name: file.name,
          size: file.size,
          status: 'pending',
          error: null,
          info,
          previewUrl,
          processedBlobUrl: null,
          processedBuffer: null,
        };
      })
    );

    setFiles((prev) => [...prev, ...newItems]);
  };

  // 拖拽处理
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

  // 单个文件解锁注入处理
  const processSingleFile = async (item) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === item.id ? { ...f, status: 'processing', error: null } : f
      )
    );

    try {
      const fullBuffer = await item.file.arrayBuffer();
      const outputUint8 = processArw(fullBuffer, {
        targetModel,
        defaultLook,
        profileMode,
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
              }
            : f
        )
      );
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

  // 批量解锁全部文件
  const handleProcessAll = async () => {
    if (files.length === 0 || isProcessingAll) return;

    setIsProcessingAll(true);
    let successCount = 0;

    for (const item of files) {
      if (item.status !== 'done') {
        const ok = await processSingleFile(item);
        if (ok) successCount++;
      }
    }

    setIsProcessingAll(false);

    if (successCount > 0) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#f35e16', '#00d2ff', '#10b981', '#f5a623'],
      });
    }
  };

  // 单独下载某张照片
  const handleDownloadSingle = (item) => {
    if (!item.processedBlobUrl) return;
    const baseName = item.name.replace(/\.[^/.]+$/, '');
    const ext = item.name.substring(item.name.lastIndexOf('.'));
    const a = document.createElement('a');
    a.href = item.processedBlobUrl;
    a.download = `${baseName}_looks${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 打包下载全部已解锁照片为 ZIP
  const handleDownloadAllZip = async () => {
    const doneFiles = files.filter((f) => f.status === 'done' && f.processedBuffer);
    if (doneFiles.length === 0) return;

    const zip = new JSZip();
    for (const item of doneFiles) {
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      const ext = item.name.substring(item.name.lastIndexOf('.'));
      zip.file(`${baseName}_looks${ext}`, item.processedBuffer);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sony_ARW_Unlocked_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 删除某一项
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
  const pendingCount = files.filter((f) => f.status !== 'done').length;

  return (
    <div className="tool-app">
      {/* 隐藏的系统文件选择框 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".arw,.srf,.sr2"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) addFilesToQueue(e.target.files);
          e.target.value = '';
        }}
      />

      {/* 顶部超紧凑导航栏 */}
      <header className="tool-navbar">
        <div className="navbar-left">
          <div className="logo-box">
            <Camera size={20} className="logo-icon" />
          </div>
          <div className="brand-title">
            <span className="brand-name">Sony ARW 解锁</span>
            <span className="brand-badge">FL2 / FL3</span>
          </div>
        </div>

        <div className="navbar-right">
          {files.length > 0 && (
            <>
              <button
                className="nav-btn add-btn"
                onClick={() => fileInputRef.current?.click()}
                title="添加更多 ARW 照片"
              >
                <Plus size={16} />
                <span className="btn-text">添加照片</span>
              </button>
              <button
                className="nav-btn"
                onClick={handleClearAll}
                disabled={isProcessingAll}
                title="清空列表"
              >
                <Trash2 size={16} />
                <span className="btn-text">清空</span>
              </button>
            </>
          )}

          <button
            className="nav-btn help-btn"
            onClick={() => setShowHelp(true)}
            title="关于与使用说明"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </header>

      {/* 核心控制条 (参数配置与主要操作) */}
      <section className="control-strip">
        <div className="config-selectors">
          {/* 激活外观 */}
          <div className="select-pill">
            <label>激活外观</label>
            <select
              value={defaultLook}
              onChange={(e) => setDefaultLook(e.target.value)}
            >
              <option value="fl2">FL2 (复古胶片 2)</option>
              <option value="fl3">FL3 (清透电影 3)</option>
              <option value="keep">保持拍摄设置</option>
              <option value="fl">FL (经典胶片 1)</option>
              <option value="in">IN (即时拍立得)</option>
              <option value="sh">SH (柔和高调)</option>
              <option value="vv2">VV2 (极清生动)</option>
              <option value="st">Standard (标准)</option>
              <option value="pt">Portrait (人像)</option>
            </select>
          </div>

          {/* 调色方案 */}
          <div className="select-pill">
            <label>色彩调校</label>
            <select
              value={profileMode}
              onChange={(e) => setProfileMode(e.target.value)}
            >
              <option value="balanced">✨ 通透平衡版 (推荐)</option>
              <option value="factory">🏛️ 原厂浓郁版</option>
            </select>
          </div>

          {/* 伪装机型 */}
          <div className="select-pill hide-on-tiny">
            <label>机型标定</label>
            <select
              value={targetModel}
              onChange={(e) => setTargetModel(e.target.value)}
            >
              <option value="a7c2">A7C II (推荐)</option>
              <option value="keep">保持原机型</option>
              <option value="a7m4">A7 IV</option>
              <option value="a7rm5">A7R V</option>
              <option value="a1m2">A1 II</option>
              <option value="a9m3">A9 III</option>
            </select>
          </div>
        </div>

        {/* 桌面端操作按钮组 */}
        <div className="control-actions desktop-actions">
          {doneCount > 1 && (
            <button
              className="action-btn download-all-btn"
              onClick={handleDownloadAllZip}
            >
              <Archive size={15} />
              打包 ZIP ({doneCount})
            </button>
          )}

          <button
            className="action-btn unlock-all-btn"
            onClick={handleProcessAll}
            disabled={files.length === 0 || isProcessingAll}
          >
            {isProcessingAll ? (
              <>
                <RefreshCw size={15} className="spin" />
                正在解锁...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                一键解锁全部 {files.length > 0 && `(${files.length})`}
              </>
            )}
          </button>
        </div>
      </section>

      {/* 主工作区 */}
      <main className="tool-main">
        {/* 列表为空时的极简拖拽上传卡片 */}
        {files.length === 0 ? (
          <div
            className={`empty-uploader ${isDragOver ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-circle">
              <Upload size={36} />
            </div>
            <h2 className="upload-title">选择或拖入索尼 ARW 照片</h2>
            <p className="upload-desc">
              无需上传服务器，100% 浏览器本地极速运算，安全保护原创隐私
            </p>
            <div className="upload-tags">
              <span>.ARW</span>
              <span>.SR2</span>
              <span>.SRF</span>
            </div>
            <button className="upload-btn-mobile" type="button">
              点击选择照片
            </button>
          </div>
        ) : (
          /* 已有文件时：展示照片网格与快速添加栏 */
          <div className="gallery-section">
            <div className="gallery-header">
              <span className="gallery-count">
                已导入 {files.length} 张照片 · {doneCount} 张就绪
              </span>
              <span className="gallery-hint">
                💡 点击照片可放大预览 · 解锁后在 Sony Edit 中直接渲染
              </span>
            </div>

            <div className="photo-grid">
              {files.map((item) => (
                <div
                  key={item.id}
                  className={`photo-card ${item.status === 'done' ? 'is-done' : ''}`}
                >
                  {/* 图片预览区 (内嵌高清 JPEG) */}
                  <div
                    className="card-thumb-wrap"
                    onClick={() => {
                      if (item.previewUrl) {
                        setLightboxImg({ url: item.previewUrl, name: item.name });
                      }
                    }}
                  >
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="card-thumb"
                        loading="lazy"
                      />
                    ) : (
                      <div className="card-thumb-placeholder">
                        <Camera size={32} opacity={0.4} />
                        <span>正在提取预览...</span>
                      </div>
                    )}

                    {/* 相机型号与拍摄外观角标 */}
                    {item.info && (
                      <div className="thumb-badges">
                        <span className="badge-model">{item.info.cameraModel}</span>
                        <span className="badge-look">{item.info.activeLook}</span>
                      </div>
                    )}

                    {/* 放大镜微标 */}
                    {item.previewUrl && (
                      <div className="thumb-zoom-icon" title="点击放大预览">
                        <Maximize2 size={14} />
                      </div>
                    )}

                    {/* 状态悬浮浮层 */}
                    {item.status === 'done' && (
                      <div className="thumb-status-done">
                        <Check size={16} />
                        <span>已注入全套外观</span>
                      </div>
                    )}
                  </div>

                  {/* 卡片信息与操作行 */}
                  <div className="card-body">
                    <div className="card-meta">
                      <div className="card-filename" title={item.name}>
                        {item.name}
                      </div>
                      <div className="card-filesize">
                        {(item.size / (1024 * 1024)).toFixed(1)} MB
                      </div>
                    </div>

                    <div className="card-actions">
                      {item.info && (
                        <button
                          className="btn-icon"
                          onClick={() => setInspectTarget(item)}
                          title="查看槽位元数据"
                        >
                          <Eye size={15} />
                        </button>
                      )}

                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleRemoveFile(item.id)}
                        title="移除照片"
                      >
                        <Trash2 size={15} />
                      </button>

                      {item.status === 'done' ? (
                        <button
                          className="btn-card-save"
                          onClick={() => handleDownloadSingle(item)}
                          title="保存解锁后的 ARW"
                        >
                          <Download size={14} />
                          保存
                        </button>
                      ) : (
                        <button
                          className="btn-card-unlock"
                          onClick={() => processSingleFile(item)}
                          disabled={item.status === 'processing' || isProcessingAll}
                        >
                          {item.status === 'processing' ? (
                            <RefreshCw size={14} className="spin" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                          解锁
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 手机端固定底部操作栏 (Sticky Bottom Bar) */}
      {files.length > 0 && (
        <div className="mobile-bottom-bar">
          <div className="mobile-count-info">
            <span>{doneCount} / {files.length} 完成</span>
          </div>

          <div className="mobile-btn-group">
            {doneCount > 1 && (
              <button
                className="mobile-btn mobile-download-btn"
                onClick={handleDownloadAllZip}
              >
                <Archive size={16} />
                下载 ZIP
              </button>
            )}

            <button
              className="mobile-btn mobile-unlock-btn"
              onClick={handleProcessAll}
              disabled={isProcessingAll}
            >
              {isProcessingAll ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  一键解锁全部
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
              >
                <X size={20} />
              </button>
            </div>
            <div className="lightbox-body">
              <img src={lightboxImg.url} alt={lightboxImg.name} />
            </div>
          </div>
        </div>
      )}

      {/* 元数据与槽位结构检测弹窗 */}
      {inspectTarget && inspectTarget.info && (
        <div className="modal-overlay" onClick={() => setInspectTarget(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">
                <Camera size={18} />
                <h3>ARW 创意外观槽位结构</h3>
              </div>
              <button className="btn-close" onClick={() => setInspectTarget(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-info-grid">
              <div className="info-cell">
                <span className="info-k">机型</span>
                <span className="info-v">{inspectTarget.info.cameraModel}</span>
              </div>
              <div className="info-cell">
                <span className="info-k">拍摄外观</span>
                <span className="info-v">{inspectTarget.info.activeLook}</span>
              </div>
              <div className="info-cell">
                <span className="info-k">SR2 偏移</span>
                <span className="info-v font-mono">{inspectTarget.info.sr2Offset}</span>
              </div>
              <div className="info-cell">
                <span className="info-k">状态</span>
                <span className="info-v" style={{ color: '#10b981' }}>
                  {inspectTarget.info.isFullyUnlocked ? '已注入 FL2/FL3' : '原始状态'}
                </span>
              </div>
            </div>

            <div className="table-wrap">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>槽位</th>
                    <th>外观</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectTarget.info.slots.map((s) => (
                    <tr key={s.index}>
                      <td className="font-mono">Slot {s.index}</td>
                      <td>
                        <strong
                          style={{
                            color:
                              s.name === 'FL2'
                                ? 'var(--sony-orange)'
                                : s.name === 'FL3'
                                ? 'var(--film-teal)'
                                : 'inherit',
                          }}
                        >
                          {s.name}
                        </strong>
                      </td>
                      <td>{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 帮助与说明浮层 */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">
                <Sliders size={18} />
                <h3>使用说明与色彩方案</h3>
              </div>
              <button className="btn-close" onClick={() => setShowHelp(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="help-content">
              <div className="help-section">
                <h4>✨ 调色方案选择</h4>
                <p>
                  <strong>通透平衡版 (推荐)</strong>：针对原生 FL2/FL3 移植到其他机型后在室内白色背景发黄发泥的问题，已通过白平衡重归一化色彩矩阵精准平衡，白底通透纯净、肤色自然，完整保留胶片高反差与暗部风格。
                </p>
                <p style={{ marginTop: '8px' }}>
                  <strong>原厂浓郁版</strong>：原厂未经白平衡归一化原始矩阵，压低蓝色呈现浓郁极暖旧胶片感，适合室外阳光大场景。
                </p>
              </div>

              <div className="help-section">
                <h4>🖥️ 渲染步骤</h4>
                <ol style={{ paddingLeft: '18px', lineHeight: '1.8' }}>
                  <li>在此工具一键解锁并下载 ARW 照片。</li>
                  <li>使用官方 <strong>Sony Imaging Edge Desktop (Edit)</strong> 打开。</li>
                  <li>在右侧「创意外观」下拉菜单中自由切换 FL2、FL3 或任意风格。</li>
                </ol>
              </div>

              <div className="help-section">
                <h4>🔒 纯本地安全</h4>
                <p>
                  所有运算完全在您的手机或电脑浏览器本地内存中执行，无文件上传，断网亦可正常工作。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
