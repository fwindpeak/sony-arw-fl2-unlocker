---
name: sony-arw-fl2-unlocker
description: >-
  索尼 Sony ARW (RAW) 照片全套创意外观解锁与机型伪装工具技能。用于将 A7C2 (ILCE-7CM2) 等索尼相机拍摄的
  ARW 照片一次性解锁全部新一代创意外观（包括 FL2 怀旧胶片、FL3 清透电影胶片、FL、VV2、IN、SH、ST、PT、NT、VV 等），
  以便在 Sony Imaging Edge Edit (Edit.app) 中直接选用原厂全部胶片色彩并批量导出。
---

# Sony ARW 全套创意外观解锁技能 (Sony ARW Creative Look Full Suite Unlocker)

本技能提供了针对索尼相机 RAW (ARW) 照片的 **FL2 (Film 2 / 怀旧复古胶片)** 与 **FL3 (Film 3 / 清透电影胶片)** 等全套创意外观（Creative Look）的一次性全量解锁与批量注入流程。

---

## 🎨 解锁的全部索尼创意外观清单

- **FL2 (Film 2)**: 怀旧复古胶片 2（高对比度、沉稳复古色调）⚡ **新相机特有**
- **FL3 (Film 3)**: 清透电影胶片 3（柔和低反差、通透亮部）⚡ **新相机特有**
- **FL (Film 1)**: 经典胶片 1（蓝绿色调、暗部微提）
- **VV2 (Vivid 2)**: 极清生动 2（通透鲜艳）
- **IN (Instant)**: 即时拍立得（日系哑光质感）
- **SH (Soft Highkey)**: 柔和高调（明亮空气感）
- **ST / PT / NT / VV**: 标准 / 人像 / 中性 / 生动

---

## 快速使用

### 1. 单张 ARW 照片一次性解锁全套外观
```bash
python3 .agents/skills/sony-arw-fl2-unlocker/scripts/camouf_arw.py /path/to/DSC00001.ARW
# 输出：DSC00001_all_looks.ARW
```

### 2. 批量处理整个相册目录
```bash
python3 .agents/skills/sony-arw-fl2-unlocker/scripts/camouf_arw.py /path/to/raw_folder/ -o /path/to/output_folder/
```

### 3. 可选参数
- `-l, --look {fl2, fl3, fl, vv2, in, sh}`: 指定默认载入外观（默认: `fl2`）
- `-t, --target {a7c2, a7m5, a1m2}`: 机型伪装（默认: `a7c2`）
