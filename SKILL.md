---
name: sony-arw-fl2-unlocker
version: 1.0.0
description: >-
  索尼 Sony ARW (RAW) 照片全套新创意外观 (FL2/FL3) 解锁与批量处理 Agent Skill。
  使 AI Agent 能够自动识别、解密并批量将 A7C2、A7M4、A7R5 等相机的 ARW 照片注入
  FL2 (怀旧复古胶片)、FL3 (清透电影胶片)、FL、VV2、IN、SH 等全套原厂色彩，并在
  Sony Imaging Edge Edit 中无缝打开与渲染。
author: Sony ARW Creative Look Contributors
tags:
  - photography
  - sony
  - raw-processing
  - arw
  - creative-look
  - film-simulation
  - reverse-engineering
tools:
  - bash
  - python
---

# Sony ARW Creative Look Unlocker (Agent Skill)

When users ask to unlock film looks (FL2, FL3, FL, VV2, IN, SH, etc.) or camouflage camera models for Sony ARW RAW photos, follow this skill guide to inspect, process, and batch-unlock RAW files safely without damaging the sensor calibration or RAW data.

---

## 🎯 When to Activate This Skill

Activate this skill when the user:
- Requests unlocking **FL2 (Film 2)**, **FL3 (Film 3)**, or any other Creative Look for Sony ARW files;
- Wants to camouflage an ARW photo taken with **A7C II (ILCE-7CM2)**, **A7 IV (ILCE-7M4)**, **A7R V (ILCE-7RM5)**, etc., to use new film looks in **Sony Imaging Edge Edit (`Edit.app`)**;
- Asks to batch-process a directory of Sony RAW files to enable all Creative Looks;
- Troubleshoots Sony Edit.app throwing *"The file could not be opened / Corrupted format"* on modified ARW files.

---

## 🧠 Underlying Architecture & Safety Rules

1. **SR2SubIFD Dynamic Look Parsing**:
   Sony Edit.app reads the available Creative Looks from the encrypted `SR2SubIFD` block in ARW MakerNotes (Key: `0x44332211`).
2. **Zero-Shift Byte-Exact Alignment**:
   **NEVER use ExifTool to rewrite the entire ARW**, as ExifTool alters SubIFD offsets and corrupts Sony RAW strip pointers.
   **ALWAYS use the bundled `camouf_arw.py` script**, which uses in-place PRNG keystream decryption, slot substitution, and re-encryption.
3. **Sensor Matrix Calibration**:
   By default, keep target model as `a7c2` so the original Bayer CFA pattern, black levels, and white balance matrix remain 100% factory-accurate.

---

## 🛠️ Step-by-Step Agent Workflow

### Step 1: Locate Target Files or Folders
Check whether the user provided a single file or a directory:
```bash
# Check single file
python3 scripts/camouf_arw.py /path/to/photo.ARW

# Batch process directory
python3 scripts/camouf_arw.py /path/to/raw_folder/ -o /path/to/output_folder/
```

### Step 2: Choose Presets & Look Modes
- **Default (Recommended)**: Unlocks all looks (`FL, FL2, FL3, VV2, IN, SH, ST, PT, NT, VV`) with `FL2` as default active look:
  ```bash
  python3 scripts/camouf_arw.py /path/to/photo.ARW -l fl2
  ```
- **Film 3 Default**:
  ```bash
  python3 scripts/camouf_arw.py /path/to/photo.ARW -l fl3
  ```

### Step 3: Verify Output Files
Verify the processed files without altering them:
```bash
exiftool -G -a -s /path/to/output_photo.ARW | grep -E "ColorMode|Model"
```
Expected output includes:
```text
[MakerNotes]    ColorMode                       : FL2
[MakerNotes]    ColorMode                       : FL3
```

### Step 4: Inform the User & Completion
After processing, report the generated output paths to the user.
- **Do NOT automatically launch or open GUI applications** unless the user explicitly requests to do so.
- Instruct the user that they can now open the generated `*_all_looks.ARW` file in **Sony Imaging Edge Desktop (Edit)**:
  - **macOS**: `/Applications/Imaging Edge/Edit.app`
  - **Windows**: `C:\Program Files\Sony\Imaging Edge Desktop\Edit.exe` (or from the Start Menu)
- In the Edit application, all creative looks (including FL2 and FL3) will be available in the **Creative Look** dropdown menu in the right-hand adjustment panel.

---

## 📋 Full Creative Look Reference Table

| Code | Look Name | Aesthetics & Tonal Characteristics |
| :---: | :--- | :--- |
| **FL2** | **Film 2** | Nostalgic vintage film, high contrast, muted warm tones, deep shadows |
| **FL3** | **Film 3** | Cinematic airy film, soft low contrast, clean clear highlights |
| **FL** | **Film 1** | Classic teal-orange film look, lifted shadows, mood & atmosphere |
| **VV2** | **Vivid 2** | Ultra-clear high saturation, punchy clarity |
| **IN** | **Instant** | Matte finish, reduced contrast, retro instant-film feel |
| **SH** | **Soft Highkey**| Bright, airy, soft highlights, gentle contrast |
| **ST** | **Standard** | Sony true-to-life standard color profile |
| **PT** | **Portrait** | Optimized smooth skin tones with flattering warmth |
| **NT** | **Neutral** | Low saturation and contrast, ideal for high-latitude post-grading |
| **VV** | **Vivid** | Vibrant high-contrast landscape tones |
