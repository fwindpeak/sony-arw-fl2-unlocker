import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Search,
  Camera,
  Aperture,
  MapPin,
  Info,
  Calendar,
  Compass,
  Gauge,
} from 'lucide-react';
import { exportExifAsJson, copyExifAsJson } from '../core/exifReader.js';
import './ExifViewerModal.css';

export const ExifViewerModal = ({
  isOpen,
  onClose,
  exifResult,
  slotInfo = null,
  fileName = 'photo.arw',
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedSection, setSelectedSection] = useState('all');

  // 搜索过滤原始标签
  const filteredTags = useMemo(() => {
    if (!exifResult?.rawTags) return [];
    let list = exifResult.rawTags;

    if (selectedSection !== 'all') {
      list = list.filter(
        (t) => t.section?.toLowerCase() === selectedSection.toLowerCase()
      );
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((t) => {
      const nameMatch = t.name.toLowerCase().includes(q);
      const valMatch = String(t.value).toLowerCase().includes(q);
      const secMatch = t.section?.toLowerCase().includes(q);
      const rawMatch = String(t.rawValue).toLowerCase().includes(q);
      const descMatch = t.description?.toLowerCase().includes(q);
      return nameMatch || valMatch || secMatch || rawMatch || descMatch;
    });
  }, [exifResult, searchQuery, selectedSection]);

  if (!isOpen) return null;

  const handleCopyJson = async () => {
    if (!exifResult) return;
    const ok = await copyExifAsJson(exifResult);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportJson = () => {
    if (!exifResult) return;
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    exportExifAsJson(exifResult, `${baseName}_exif.json`);
  };

  const overview = exifResult?.overview || {};

  return (
    <div className="exif-modal-overlay" onClick={onClose}>
      <div className="exif-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal 顶部 Header */}
        <div className="exif-modal-header">
          <div className="exif-header-title-group">
            <div className="exif-header-icon">
              <Camera size={18} />
            </div>
            <div>
              <div className="exif-header-title-row">
                <h2>照片 EXIF 元数据</h2>
                {exifResult?.hasExif ? (
                  <span className="exif-pill-success">
                    已解析 {exifResult.rawTags.length} 个字段
                  </span>
                ) : (
                  <span className="exif-pill-danger">
                    未检测到 EXIF 标签
                  </span>
                )}
              </div>
              <span className="exif-header-filename">{fileName}</span>
            </div>
          </div>

          <div className="exif-header-actions">
            {exifResult?.hasExif && (
              <>
                <button
                  type="button"
                  className="btn-toolbar"
                  onClick={handleCopyJson}
                  title="复制完整 JSON 到剪贴板"
                >
                  {copied ? <Check size={13} color="var(--status-success)" /> : <Copy size={13} />}
                  <span>{copied ? '已复制' : '复制 JSON'}</span>
                </button>
                <button
                  type="button"
                  className="btn-toolbar"
                  onClick={handleExportJson}
                  title="导出为 .json 文件"
                >
                  <Download size={13} />
                  <span>导出 JSON</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-close-modal"
              title="关闭"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab 导航与搜索框 */}
        <div className="exif-modal-toolbar">
          <div className="exif-tabs-group">
            <button
              type="button"
              className={`exif-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📋 参数概览
            </button>
            {slotInfo?.slots && slotInfo.slots.length > 0 && (
              <button
                type="button"
                className={`exif-tab-btn ${activeTab === 'slots' ? 'active' : ''}`}
                onClick={() => setActiveTab('slots')}
              >
                ⚡ 外观槽位 ({slotInfo.slots.length})
              </button>
            )}
            <button
              type="button"
              className={`exif-tab-btn ${activeTab === 'sections' ? 'active' : ''}`}
              onClick={() => setActiveTab('sections')}
            >
              📑 分类标签 ({exifResult?.sections.length || 0})
            </button>
            <button
              type="button"
              className={`exif-tab-btn ${activeTab === 'rawTable' ? 'active' : ''}`}
              onClick={() => setActiveTab('rawTable')}
            >
              🔬 全部原始标签 ({exifResult?.rawTags.length || 0})
            </button>
            <button
              type="button"
              className={`exif-tab-btn ${activeTab === 'json' ? 'active' : ''}`}
              onClick={() => setActiveTab('json')}
            >
              💻 JSON 源码
            </button>
          </div>

          <div className="exif-search-box">
            <Search size={14} opacity={0.6} />
            <input
              type="text"
              placeholder="搜索 Tag 名称、字段、快门数或数值..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="exif-search-clear"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Modal 内容区 */}
        <div className="exif-modal-body">
          {!exifResult?.hasExif ? (
            <div className="exif-empty-state">
              <Info size={40} opacity={0.5} />
              <div className="empty-title">未从该照片中读取到有效 EXIF 元数据</div>
              <p className="empty-desc">
                这通常是因为图片在上传前被压缩抹除了元数据，或文件不含标准 TIFF/Exif 结构。
              </p>
            </div>
          ) : activeTab === 'overview' ? (
            /* ================= 1. 结构化概览 ================= */
            <div className="exif-overview-stack">
              {/* 四格卡片 */}
              <div className="exif-overview-grid">
                {/* 1. 机身与镜头 */}
                <div className="exif-overview-card">
                  <div className="exif-overview-card-title title-camera">
                    <Camera size={15} />
                    <span>拍摄设备</span>
                  </div>
                  <div>
                    <div className="overview-primary-text">
                      {overview.model || overview.make || '未知型号'}
                    </div>
                    <div className="overview-sub-text">
                      {overview.lensModel || '未知镜头 / 原厂一体镜头'}
                    </div>
                    <div className="overview-badges-row">
                      {overview.sensorFormatEstimate && (
                        <div className="badge-sensor">
                          {overview.sensorFormatEstimate}
                        </div>
                      )}
                      {overview.shutterCount !== undefined && (
                        <div className="badge-shutter">
                          <Gauge size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                          快门: {overview.shutterCount.toLocaleString()} 次
                        </div>
                      )}
                      {slotInfo && (
                        <div
                          className="badge-sensor"
                          style={{
                            color: slotInfo.isFullyUnlocked ? 'var(--status-success)' : 'var(--text-secondary)',
                            backgroundColor: slotInfo.isFullyUnlocked ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-elevated)',
                            borderColor: slotInfo.isFullyUnlocked ? 'rgba(5, 150, 105, 0.3)' : 'var(--border-default)',
                            cursor: 'pointer',
                          }}
                          onClick={() => setActiveTab('slots')}
                          title="点击查看 10 个创意外观槽位"
                        >
                          {slotInfo.isFullyUnlocked ? '⚡ 已注入 FL2/FL3' : `外观: ${slotInfo.activeLook || '原厂'}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. 曝光四要素 */}
                <div className="exif-overview-card">
                  <div className="exif-overview-card-title title-exposure">
                    <Aperture size={15} />
                    <span>核心曝光三要素</span>
                  </div>
                  <div className="overview-keyvals-grid">
                    <div>
                      <span className="kv-k">光圈: </span>
                      <span className="kv-v">{overview.fNumber ? `f/${overview.fNumber}` : '--'}</span>
                    </div>
                    <div>
                      <span className="kv-k">快门: </span>
                      <span className="kv-v">{overview.exposureTimeString || '--'}</span>
                    </div>
                    <div>
                      <span className="kv-k">ISO: </span>
                      <span className="kv-v">{overview.iso || '--'}</span>
                    </div>
                    <div>
                      <span className="kv-k">曝光补偿: </span>
                      <span className="kv-v">
                        {overview.exposureCompensation !== undefined
                          ? `${overview.exposureCompensation > 0 ? '+' : ''}${overview.exposureCompensation} EV`
                          : '0 EV'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. 焦距与光学 */}
                <div className="exif-overview-card">
                  <div className="exif-overview-card-title title-optics">
                    <Compass size={15} />
                    <span>光学与分辨率</span>
                  </div>
                  <div className="overview-keyvals-grid">
                    <div>
                      <span className="kv-k">物理焦距: </span>
                      <span className="kv-v">{overview.focalLength ? `${overview.focalLength}mm` : '--'}</span>
                    </div>
                    <div>
                      <span className="kv-k">等效焦距: </span>
                      <span className="kv-v">{overview.focalLengthIn35mm ? `${overview.focalLengthIn35mm}mm` : '--'}</span>
                    </div>
                    <div>
                      <span className="kv-k">总像素: </span>
                      <span className="kv-v">{overview.megapixels ? `${overview.megapixels} MP` : '--'}</span>
                    </div>
                    <div>
                      <span className="kv-k">色彩空间: </span>
                      <span className="kv-v">{overview.colorSpace || 'sRGB'}</span>
                    </div>
                  </div>
                </div>

                {/* 4. 时间与机身软件 */}
                <div className="exif-overview-card">
                  <div className="exif-overview-card-title title-time">
                    <Calendar size={15} />
                    <span>拍摄时间与软件</span>
                  </div>
                  <div>
                    <div className="overview-primary-text" style={{ fontSize: '13px' }}>
                      {overview.dateTimeOriginal || '未知拍摄时间'}
                    </div>
                    <div className="overview-sub-text" style={{ marginTop: '4px' }}>
                      处理软件: {overview.software || '机身原生直出'}
                    </div>
                    {overview.gpsLatitude !== undefined && overview.gpsLongitude !== undefined && (
                      <div className="overview-gps-row">
                        <MapPin size={12} />
                        <span>
                          {overview.gpsLatitude.toFixed(4)}°, {overview.gpsLongitude.toFixed(4)}°
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 主要拍摄元数据明细 */}
              <div className="exif-details-card">
                <div className="exif-details-card-title">
                  主要拍摄元数据明细
                </div>
                <div className="exif-details-grid">
                  {[
                    { label: '相机制造商 (Make)', val: overview.make },
                    { label: '相机型号 (Model)', val: overview.model },
                    { label: '镜头型号 (LensModel)', val: overview.lensModel },
                    {
                      label: '⚡ 硬件快门释放次数 (Shutter Count)',
                      val: overview.shutterCount !== undefined ? `${overview.shutterCount.toLocaleString()} 次` : null,
                    },
                    {
                      label: '机械快门次数 (Mechanical Shutter)',
                      val: overview.mechanicalShutterCount !== undefined ? `${overview.mechanicalShutterCount.toLocaleString()} 次` : null,
                    },
                    { label: '光圈值 (F-Number)', val: overview.fNumber ? `f/${overview.fNumber}` : null },
                    { label: '快门速度 (Exposure Time)', val: overview.exposureTimeString },
                    { label: '感光度 (ISO Speed)', val: overview.iso },
                    { label: '物理焦距 (Focal Length)', val: overview.focalLength ? `${overview.focalLength} mm` : null },
                    { label: '35mm 等效焦距', val: overview.focalLengthIn35mm ? `${overview.focalLengthIn35mm} mm` : null },
                    { label: '曝光程序 (Exposure Program)', val: overview.exposureProgram },
                    { label: '测光模式 (Metering Mode)', val: overview.meteringMode },
                    { label: '白平衡 (White Balance)', val: overview.whiteBalance },
                    { label: '闪光灯 (Flash)', val: overview.flash },
                    {
                      label: '原始图像尺寸',
                      val:
                        overview.imageWidth && overview.imageHeight
                          ? `${overview.imageWidth} × ${overview.imageHeight}`
                          : null,
                    },
                    { label: '传感器画幅估算', val: overview.sensorFormatEstimate },
                    { label: '拍摄时间 (Original Date)', val: overview.dateTimeOriginal },
                    { label: '固件/机身软件', val: overview.software },
                    { label: '摄影师 / 作者', val: overview.artist },
                    { label: '版权信息 (Copyright)', val: overview.copyright },
                  ]
                    .filter((item) => item.val !== undefined && item.val !== null && item.val !== '')
                    .map((item, idx) => (
                      <div key={idx} className="exif-details-item">
                        <span className="detail-k">{item.label}</span>
                        <span className="detail-v">{String(item.val)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'slots' && slotInfo?.slots ? (
            /* ================= 2. 创意外观槽位 ================= */
            <div className="exif-sections-stack">
              <div className="exif-section-card">
                <div className="exif-section-header">
                  <span className="sec-label">
                    索尼微单创意外观槽位 (SR2 Block 0x7770 标定结构)
                  </span>
                  <span className="sec-count">
                    {slotInfo.isFullyUnlocked ? '⚡ 已注入 FL2 / FL3' : '原厂预置'}
                  </span>
                </div>
                <div className="exif-table-wrapper">
                  <table className="exif-table">
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>槽位编号</th>
                        <th style={{ width: '28%' }}>外观代码</th>
                        <th style={{ width: '50%' }}>当前状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slotInfo.slots.map((s) => (
                        <tr key={s.index}>
                          <td className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                            Slot {s.index}
                          </td>
                          <td>
                            <strong
                              style={{
                                color:
                                  s.name === 'FL2'
                                    ? 'var(--sony-orange)'
                                    : s.name === 'FL3'
                                    ? 'var(--accent-teal)'
                                    : 'var(--text-primary)',
                              }}
                            >
                              {s.name}
                            </strong>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {s.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'sections' ? (
            /* ================= 2. 分类标签页 ================= */
            <div className="exif-sections-stack">
              {exifResult.sections.map((sec) => (
                <div key={sec.name} className="exif-section-card">
                  <div className="exif-section-header">
                    <span className="sec-label">{sec.label}</span>
                    <span className="sec-count">{sec.tags.length} 个字段</span>
                  </div>

                  <div className="exif-table-wrapper">
                    <table className="exif-table">
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>Tag 名称</th>
                          <th style={{ width: '50%' }}>解析值 / 描述</th>
                          <th style={{ width: '20%' }}>原始值 (Raw)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sec.tags.map((tag, tIdx) => (
                          <tr key={tIdx}>
                            <td className="exif-tag-name font-mono">{tag.name}</td>
                            <td>
                              <div className="exif-tag-val">{String(tag.value)}</div>
                              {tag.description && (
                                <div className="exif-tag-desc">{tag.description}</div>
                              )}
                            </td>
                            <td className="exif-tag-raw font-mono">
                              {tag.rawValue !== undefined ? String(tag.rawValue) : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'rawTable' ? (
            /* ================= 3. 全部原始标签表 ================= */
            <div className="exif-raw-table-stack">
              <div className="raw-filter-bar">
                <span className="raw-count-hint">
                  共检索到 {filteredTags.length} 个标签项
                </span>
                <div className="raw-section-pills">
                  {['all', 'ifd0', 'exif', 'makerNote', 'gps', 'xmp', 'icc'].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSelectedSection(sec)}
                      className={`pill-btn ${selectedSection === sec ? 'active' : ''}`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>

              <div className="exif-section-card">
                <div className="exif-table-scroll-container">
                  <table className="exif-table">
                    <thead>
                      <tr>
                        <th style={{ width: '24%' }}>标签键名 (Key)</th>
                        <th style={{ width: '14%' }}>所属分段</th>
                        <th style={{ width: '38%' }}>解析值 (Value)</th>
                        <th style={{ width: '24%' }}>原始值 (Raw Value)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTags.map((tag, idx) => (
                        <tr key={idx}>
                          <td className="exif-tag-name font-mono">{tag.name}</td>
                          <td>
                            <span className="exif-sec-badge">
                              {tag.section || 'EXIF'}
                            </span>
                          </td>
                          <td>
                            <div className="exif-tag-val">{String(tag.value)}</div>
                            {tag.description && (
                              <div className="exif-tag-desc">{tag.description}</div>
                            )}
                          </td>
                          <td className="exif-tag-raw font-mono">
                            {tag.rawValue !== undefined ? String(tag.rawValue) : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* ================= 4. JSON 视图 ================= */
            <div className="exif-json-stack">
              <div className="exif-json-top-bar">
                <span className="json-hint">
                  完整 EXIF 树形结构 JSON (包含厂商专有私有 Tag 与解密结果)
                </span>
                <button
                  type="button"
                  className="btn-toolbar"
                  onClick={handleCopyJson}
                >
                  {copied ? <Check size={12} color="var(--status-success)" /> : <Copy size={12} />}
                  <span>{copied ? '已复制' : '复制 JSON'}</span>
                </button>
              </div>

              <div className="exif-json-box">
                <pre>{exifResult.rawJsonString}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExifViewerModal;
