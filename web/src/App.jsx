import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Film,
  Sparkles,
  ShieldCheck,
  Sliders,
  Trash2,
  Eye,
  Info,
  Archive,
  RefreshCw,
  Layers,
  ChevronRight,
  SunMedium
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
import './App.css';

export default function App() {
  const [files, setFiles] = useState([]);
  const [targetModel, setTargetModel] = useState('a7c2');
  const [defaultLook, setDefaultLook] = useState('keep');
  const [profileMode, setProfileMode] = useState('balanced');
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [inspectTarget, setInspectTarget] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // 处理文件加入队列
  const addFilesToQueue = async (newFileList) => {
    const rawFiles = Array.from(newFileList).filter((f) =>
      /\.(arw|srf|sr2)$/i.test(f.name)
    );

    if (rawFiles.length === 0) return;

    const items = await Promise.all(
      rawFiles.map(async (file) => {
        const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`;
        try {
          // 预读前 256KB 进行即时元数据检测
          const sliceBuffer = await file.slice(0, 256 * 1024).arrayBuffer();
          const info = inspectArw(sliceBuffer, file.name);

          return {
            id,
            file,
            name: file.name,
            size: file.size,
            status: 'pending',
            progress: 0,
            error: null,
            info,
            processedBlobUrl: null,
            processedBuffer: null,
          };
        } catch (err) {
          return {
            id,
            file,
            name: file.name,
            size: file.size,
            status: 'pending',
            progress: 0,
            error: null,
            info: null,
            processedBlobUrl: null,
            processedBuffer: null,
          };
        }
      })
    );

    setFiles((prev) => [...prev, ...items]);
  };

  // 拖拽处理
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  // 单个文件转换处理
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

      // 验证处理后的成果
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

  // 批量解锁全部照片
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
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f35e16', '#00d2ff', '#ffffff', '#f5a623'],
      });
    }
  };

  // 打包下载全部已解锁照片为 ZIP
  const handleDownloadAllZip = async () => {
    const doneFiles = files.filter((f) => f.status === 'done' && f.processedBuffer);
    if (doneFiles.length === 0) return;

    const zip = new JSZip();
    for (const item of doneFiles) {
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      const ext = item.name.substring(item.name.lastIndexOf('.'));
      zip.file(`${baseName}_all_looks${ext}`, item.processedBuffer);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sony_ARW_Unlocked_Looks_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 单独下载某张照片
  const handleDownloadSingle = (item) => {
    if (!item.processedBlobUrl) return;
    const baseName = item.name.replace(/\.[^/.]+$/, '');
    const ext = item.name.substring(item.name.lastIndexOf('.'));
    const a = document.createElement('a');
    a.href = item.processedBlobUrl;
    a.download = `${baseName}_all_looks${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 移除某项
  const handleRemoveFile = (id) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.processedBlobUrl) {
        URL.revokeObjectURL(target.processedBlobUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  // 清空全部
  const handleClearAll = () => {
    files.forEach((f) => {
      if (f.processedBlobUrl) URL.revokeObjectURL(f.processedBlobUrl);
    });
    setFiles([]);
  };

  const completedCount = files.filter((f) => f.status === 'done').length;

  return (
    <div className="app-container">
      {/* 顶部 Hero 区域 */}
      <header className="app-header">
        <div className="header-badges">
          <span className="badge badge-orange">
            <Camera size={12} /> Sony ARW 5.0 Lossless
          </span>
          <span className="badge badge-teal">
            <ShieldCheck size={12} /> 100% 浏览器本地运算 · 零上传
          </span>
          <span className="badge badge-green">
            <Sparkles size={12} /> 注入 FL2 / FL3 原厂 3D-LUT
          </span>
        </div>
        <h1 className="title-glow">Sony ARW 全套创意外观解锁器</h1>
        <p className="subtitle">
          在浏览器本地直接解密并为索尼 A7C2 / A7M4 / A7R5 / A6700 等相机的 RAW 照片注入官方真实
          FL2（怀旧复古胶片）与 FL3（清透电影胶片）真 3D-LUT 色彩矩阵，无缝在 Sony Imaging Edge Edit 中渲染！
        </p>
      </header>

      {/* 拖拽上传区域 */}
      <div
        className={`dropzone-container ${isDragOver ? 'is-dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
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
        <div className="dropzone-icon-wrapper">
          <Upload size={32} />
        </div>
        <div className="dropzone-title">拖入索尼 ARW 照片，或点击选择文件</div>
        <div className="dropzone-hint">
          支持多选批量添加 · 仅在本地内存运行，处理一张约 20 毫秒，隐私绝对安全
        </div>
        <div className="dropzone-tags">
          <span className="badge badge-gray font-mono">.ARW</span>
          <span className="badge badge-gray font-mono">.SR2</span>
          <span className="badge badge-gray font-mono">.SRF</span>
        </div>
      </div>

      {/* 转换控制配置栏 */}
      <div className="glass-panel config-card">
        <div className="config-group">
          <div className="config-item">
            <label className="config-label">
              <Camera size={14} /> 伪装机型标定
            </label>
            <select
              className="select-custom"
              value={targetModel}
              onChange={(e) => setTargetModel(e.target.value)}
            >
              <option value="a7c2">A7C II (ILCE-7CM2) - 推荐 · 保持原厂传感器标定</option>
              <option value="keep">保持原相机代码 (不修改 Model)</option>
              <option value="a7m4">A7 IV (ILCE-7M4)</option>
              <option value="a7rm5">A7R V (ILCE-7RM5)</option>
              <option value="a1m2">A1 II (ILCE-1M2)</option>
              <option value="a9m3">A9 III (ILCE-9M3)</option>
            </select>
          </div>

          <div className="config-item">
            <label className="config-label">
              <Film size={14} /> 默认载入外观 (Active Look)
            </label>
            <select
              className="select-custom"
              value={defaultLook}
              onChange={(e) => setDefaultLook(e.target.value)}
            >
              <option value="keep">保持原片拍摄设置 (推荐 · FL2/FL3在下拉菜单随时切)</option>
              <option value="fl2">FL2 - 怀旧复古胶片 2 (官方默认激活)</option>
              <option value="fl3">FL3 - 清透电影胶片 3</option>
              <option value="fl">FL - 经典冷暖胶片 1 (Teal & Orange)</option>
              <option value="vv2">VV2 - 极清生动 2</option>
              <option value="in">IN - 拍立得 / 即时</option>
              <option value="sh">SH - 柔和高调</option>
              <option value="st">Standard - 标准真实</option>
              <option value="pt">Portrait - 人像肤色</option>
            </select>
          </div>

          <div className="config-item">
            <label className="config-label">
              <Sparkles size={14} /> 色彩风格调校
            </label>
            <select
              className="select-custom"
              value={profileMode}
              onChange={(e) => setProfileMode(e.target.value)}
            >
              <option value="balanced">✨ 通透平衡版 (推荐 · 修正偏黄白底，人像纯净通透)</option>
              <option value="factory">🏛️ 原厂浓郁极暖版 (原始未校准矩阵 · 室内易偏黄)</option>
            </select>
          </div>
        </div>

        <div className="config-group">
          <button
            className="btn-primary"
            onClick={handleProcessAll}
            disabled={files.length === 0 || isProcessingAll}
          >
            {isProcessingAll ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                正在极速解锁中...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                一键批量解锁全部 ({files.length} 张)
              </>
            )}
          </button>
        </div>
      </div>

      {/* 色彩美学说明提示 */}
      <div className="tip-banner">
        <SunMedium size={20} className="tip-banner-icon" />
        <div>
          {profileMode === 'balanced' ? (
            <>
              <strong>调色说明 · 已启用「通透平衡版 (方案2 · 推荐)」</strong>：针对官方原生 FL2/FL3 矩阵移植至其他相机后容易在<strong>室内人像/白色地垫/白墙发黄发泥</strong>的问题，已通过白平衡重归一化色彩矩阵精准平衡。画面白底清爽干净、人像肤色通透健康，同时 100% 完整保留 FL2 胶片颗粒感调性与 FL3 电影清透曲线与暗部反差！
            </>
          ) : (
            <>
              <strong>调色说明 · 已启用「原厂浓郁极暖版」</strong>：直接注入官方未校准的原始矩阵提取块，大幅压低蓝色通道，呈现极暖浓郁旧胶片质感。适合室外大阳光场景；如果在室内拍摄觉得画面偏黄，建议在 Sony Edit 将<strong>色温微降 300~500K</strong>，<strong>色调微调 +3（洋红）</strong>。
            </>
          )}
        </div>
      </div>

      {/* 待处理/已处理队列管理 */}
      {files.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <div className="actions-bar">
            <div className="actions-left">
              <span className="queue-count">
                照片队列 ({completedCount} / {files.length} 已就绪)
              </span>
            </div>
            <div className="actions-right">
              {completedCount > 1 && (
                <button className="btn-secondary btn-sm" onClick={handleDownloadAllZip}>
                  <Archive size={14} /> 打包下载 ZIP ({completedCount} 张)
                </button>
              )}
              <button
                className="btn-secondary btn-sm"
                onClick={handleClearAll}
                disabled={isProcessingAll}
              >
                <Trash2 size={14} /> 清空列表
              </button>
            </div>
          </div>

          <div className="file-list">
            {files.map((item) => (
              <div key={item.id} className="file-card glass-panel">
                <div className="file-info-main">
                  <div className="file-icon-box">
                    <Film size={22} />
                  </div>
                  <div className="file-texts">
                    <div className="file-name">{item.name}</div>
                    <div className="file-meta-row">
                      <span className="font-mono">{(item.size / (1024 * 1024)).toFixed(1)} MB</span>
                      {item.info && (
                        <>
                          <span className="badge badge-gray font-mono">
                            {item.info.cameraModel}
                          </span>
                          <span className="badge badge-gray">
                            原外观: {item.info.activeLook}
                          </span>
                        </>
                      )}
                      {item.status === 'done' && (
                        <span className="badge badge-green">
                          <CheckCircle2 size={11} /> 全套 10 款外观已注入
                        </span>
                      )}
                      {item.status === 'processing' && (
                        <span className="badge badge-orange animate-spin">
                          <RefreshCw size={11} /> 正在注入...
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="badge badge-orange" style={{ color: '#ef4444' }}>
                          <AlertCircle size={11} /> {item.error}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="file-actions">
                  {item.info && (
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => setInspectTarget(item)}
                      title="查看创意外观槽位结构"
                    >
                      <Eye size={14} /> 槽位检测
                    </button>
                  )}

                  {item.status !== 'done' && (
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => processSingleFile(item)}
                      disabled={item.status === 'processing' || isProcessingAll}
                    >
                      <Sparkles size={14} /> 解锁
                    </button>
                  )}

                  {item.status === 'done' && (
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => handleDownloadSingle(item)}
                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                    >
                      <Download size={14} /> 保存 ARW
                    </button>
                  )}

                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => handleRemoveFile(item.id)}
                    title="移除此文件"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 创意外观色卡参考画廊 */}
      <section className="showcase-section">
        <h2 className="section-title">
          <Layers size={20} style={{ color: 'var(--sony-orange)' }} /> 索尼创意外观 (Creative Look) 全景画廊
        </h2>
        <p className="section-subtitle">
          解锁后，你的照片将在 Sony Imaging Edge Desktop 中获得以下全部 10 款官方色彩管线支持：
        </p>

        <div className="looks-grid">
          <div className="look-card highlight">
            <div className="look-header">
              <span className="look-code" style={{ color: '#f35e16' }}>FL2</span>
              <span className="badge badge-orange">⚡ 真 3D-LUT 已解锁</span>
            </div>
            <div className="look-name">Film 2 (怀旧复古胶片 2)</div>
            <div className="look-desc">
              高反差、浓郁胶片质感、暗部沉稳内敛、暖调怀旧。模拟经典柯达彩色反转片，扫街与复古人像绝配。
            </div>
          </div>

          <div className="look-card highlight">
            <div className="look-header">
              <span className="look-code" style={{ color: '#00d2ff' }}>FL3</span>
              <span className="badge badge-teal">⚡ 真 3D-LUT 已解锁</span>
            </div>
            <div className="look-name">Film 3 (清透电影胶片 3)</div>
            <div className="look-desc">
              柔和低反差、亮部通透清爽、柔美空气感。模拟现代电影感胶片调色，适合日系人像与浪漫风光。
            </div>
          </div>

          <div className="look-card">
            <div className="look-header">
              <span className="look-code">FL</span>
              <span className="badge badge-gray">原厂保留</span>
            </div>
            <div className="look-name">Film 1 (经典冷暖胶片 1)</div>
            <div className="look-desc">
              经典青橙色调（Teal & Orange），蓝绿色调暗部微提，极具情绪氛围感，适合阴天与城市街景。
            </div>
          </div>

          <div className="look-card">
            <div className="look-header">
              <span className="look-code">VV2</span>
              <span className="badge badge-gray">原厂保留</span>
            </div>
            <div className="look-name">Vivid 2 (极清生动 2)</div>
            <div className="look-desc">
              极清透亮，显著增强色彩鲜艳度与微反差清晰度，适合晴朗蓝天、花卉与海边风景。
            </div>
          </div>

          <div className="look-card">
            <div className="look-header">
              <span className="look-code">IN</span>
              <span className="badge badge-gray">原厂保留</span>
            </div>
            <div className="look-name">Instant (即时 / 拍立得)</div>
            <div className="look-desc">
              哑光质感、柔和暗角、低反差文艺感，模拟拍立得相纸的复古日系随拍质感。
            </div>
          </div>

          <div className="look-card">
            <div className="look-header">
              <span className="look-code">SH</span>
              <span className="badge badge-gray">原厂保留</span>
            </div>
            <div className="look-name">Soft Highkey (柔和高调)</div>
            <div className="look-desc">
              明亮柔和、轻盈空气感、高光柔化晕开，非常适合逆光少女写真与萌宠抓拍。
            </div>
          </div>

          <div className="look-card">
            <div className="look-header">
              <span className="look-code">PT</span>
              <span className="badge badge-gray">原厂保留</span>
            </div>
            <div className="look-name">Portrait (人像)</div>
            <div className="look-desc">
              索尼专门为亚洲人肤色定制，呈现柔和粉嫩的自然皮肤过渡。
            </div>
          </div>

          <div className="look-card">
            <div className="look-header">
              <span className="look-code">ST</span>
              <span className="badge badge-gray">原厂保留</span>
            </div>
            <div className="look-name">Standard (标准)</div>
            <div className="look-desc">
              索尼基准色彩，色彩还原准确真实，纪实摄影首选。
            </div>
          </div>
        </div>
      </section>

      {/* 槽位检测弹窗 (Inspect Modal) */}
      {inspectTarget && inspectTarget.info && (
        <div className="modal-overlay" onClick={() => setInspectTarget(null)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} style={{ color: 'var(--sony-orange)' }} />
                <h3 style={{ fontSize: '17px', fontWeight: 700 }}>
                  ARW 元数据与外观槽位结构报告
                </h3>
              </div>
              <button
                className="btn-secondary btn-sm"
                onClick={() => setInspectTarget(null)}
              >
                关闭
              </button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '16px', lineHeight: 1.8, fontSize: '13px' }}>
                <div><strong>文件名称</strong>: {inspectTarget.name}</div>
                <div><strong>相机机型</strong>: {inspectTarget.info.cameraModel}</div>
                <div><strong>当前激活外观</strong>: {inspectTarget.info.activeLook}</div>
                <div><strong>SR2SubIFD 加密块</strong>: 偏移量 {inspectTarget.info.sr2Offset}，长度 {inspectTarget.info.sr2Length} 字节</div>
              </div>

              <h4 style={{ fontSize: '14px', fontWeight: 600, marginTop: '16px' }}>
                创意外观 (Creative Look) 槽位分布状态：
              </h4>

              <table className="slot-table">
                <thead>
                  <tr>
                    <th>槽位序号</th>
                    <th>外观代号</th>
                    <th>SR2 偏移量</th>
                    <th>当前状态</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectTarget.info.slots.map((s) => (
                    <tr key={s.index}>
                      <td className="font-mono">Slot {s.index}</td>
                      <td>
                        <strong style={{ color: s.name === 'FL2' ? '#f35e16' : s.name === 'FL3' ? '#00d2ff' : '#fff' }}>
                          {s.name}
                        </strong>
                      </td>
                      <td className="font-mono">{s.offset}</td>
                      <td>{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {inspectTarget.info.isFullyUnlocked ? (
                  <span style={{ color: '#10b981', fontWeight: 600 }}>
                    ✅ 该文件已成功注入真实 FL2 与 FL3 胶片矩阵，可在 Sony Edit 中直接调用！
                  </span>
                ) : (
                  <span>
                    💡 该文件为原始相机 RAW，点击“解锁”即可将 Slot 9 (BW) 替换为 FL2，Slot 10 (Sepia) 替换为 FL3。
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 页脚 */}
      <footer className="app-footer">
        <p>Sony ARW Creative Look Unlocker · 基于 MIT 许可证开源</p>
        <p style={{ marginTop: '6px', fontSize: '12px' }}>
          纯前端浏览器客户端解密与重构 · 零位移对称 PRNG 算法 · 隐私绝对安全 · 支持 Windows / macOS / Linux
        </p>
      </footer>
    </div>
  );
}
