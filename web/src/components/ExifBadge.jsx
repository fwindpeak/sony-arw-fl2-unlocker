import React from 'react';
import { Info } from 'lucide-react';

export const ExifBadge = ({ exifResult, onOpenExifModal }) => {
  const overview = exifResult?.overview;
  if (!overview) return null;

  const fText = overview.fNumber ? `f/${overview.fNumber}` : null;
  const shutterText = overview.exposureTimeString || null;
  const isoText = overview.iso ? `ISO ${overview.iso}` : null;
  const focalText = overview.focalLength ? `${Math.round(overview.focalLength)}mm` : null;
  const lensText = overview.lensModel || null;

  const specs = [fText, shutterText, isoText, focalText].filter(Boolean);
  if (specs.length === 0 && !lensText) return null;

  return (
    <div
      className="card-exposure-strip"
      onClick={onOpenExifModal}
      title="点击查看完整 EXIF 拍摄参数与机身信息"
    >
      <div className="exposure-strip-left">
        {specs.length > 0 ? (
          <div className="exposure-specs">
            {specs.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="spec-dot">·</span>}
                <span className="spec-val">{item}</span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <span className="exposure-fallback">读取曝光参数中...</span>
        )}

        {lensText && (
          <div className="exposure-lens-text" title={lensText}>
            {lensText}
          </div>
        )}
      </div>

      <div className="exposure-strip-arrow" title="查看完整 EXIF">
        <Info size={12} />
      </div>
    </div>
  );
};

export default ExifBadge;
