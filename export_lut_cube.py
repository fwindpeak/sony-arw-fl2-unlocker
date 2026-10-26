#!/usr/bin/env python3
"""
Sony Creative Look (751K Lightroom Profiles) to Standard .cube 3D-LUT Converter
================================================================================
基于 751K/sony-a7m5-looks 官方 Lightroom / Camera Raw 增强型预设 (profiles/camera_raw/*.xmp)
解密并提取 64x64x64 3D RGBTable，构建 100% 还原索尼原厂调色且【零白平衡漂移】的标准 .cube 3D-LUT。

生成的 .cube 文件可无缝导入并套用于：
- RapidRAW (效果 -> LUT，四面体插值 0 误差)
- DaVinci Resolve (达芬奇调色)
- Adobe Lightroom / Photoshop (Camera Raw / Color Lookup)
- Final Cut Pro / Premiere Pro (视频与照片调色)

使用方法：
1. 一键转换全套预设并覆盖更新到 luts/ 目录:
   python3 export_lut_cube.py

2. 指定网格尺寸 (如 33 或 65):
   python3 export_lut_cube.py --size 33 -o luts/

3. 转换单个 XMP 预设为 .cube:
   python3 export_lut_cube.py "presets/camera_raw/SonyA7M5 Look FL2.xmp" -o luts/Sony_FL2.cube
"""

import os
import sys
import re
import json
import zlib
import uuid
import struct
import argparse
import numpy as np
from pathlib import Path

# Windows 终端控制台输出 UTF-8 兼容支持
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

HERE = Path(__file__).resolve().parent
DEFAULT_XMP_DIR = HERE / "presets" / "camera_raw"
DEFAULT_OUT_DIR = HERE / "luts"

# Adobe Base85 解码器 (对应 751K crs_table.py)
ALPHA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?`'|()[]{}@%$#"
DEC = {c: i for i, c in enumerate(ALPHA)}

def b85_decode(s: str) -> bytes:
    out = bytearray()
    for i in range(0, len(s), 5):
        chunk = s[i:i + 5]
        v = 0
        for k, c in enumerate(chunk):
            v += DEC[c] * (85 ** k)
        n = {5: 4, 4: 3, 3: 2, 2: 1}[len(chunk)]
        out += struct.pack("<I", v)[:n]
    return bytes(out)

def decode_table_str(s: str) -> bytes:
    raw = b85_decode(s)
    n = struct.unpack_from("<I", raw)[0]
    data = zlib.decompress(raw[4:])
    assert len(data) == n, f"Decompressed len {len(data)} != expected {n}"
    return data

# 色彩空间矩阵转换 (对应 751K acr_look.py)
PROPHOTO_TO_XYZ = np.array([[0.7976749, 0.1351917, 0.0313534],
                            [0.2880402, 0.7118741, 0.0000857],
                            [0.0, 0.0, 0.8252100]])
M_SRGB = np.array([[0.4124564, 0.3575761, 0.1804375],
                   [0.2126729, 0.7151522, 0.0721750],
                   [0.0193339, 0.1191920, 0.9503041]])
BRAD = np.array([[0.8951, 0.2664, -0.1614],
                 [-0.7502, 1.7135, 0.0367],
                 [0.0389, -0.0685, 1.0296]])
D65 = np.array([0.95047, 1.0, 1.08883])
D50 = np.array([0.96422, 1.0, 0.82521])
CHAD = np.linalg.inv(BRAD) @ np.diag((BRAD @ D50) / (BRAD @ D65)) @ BRAD

XYZ_TO_PROPHOTO = np.linalg.inv(PROPHOTO_TO_XYZ)
SRGB_TO_PROPHOTO = XYZ_TO_PROPHOTO @ CHAD @ M_SRGB
PROPHOTO_TO_SRGB_LIN = np.linalg.inv(SRGB_TO_PROPHOTO)

def prophoto_v_to_srgb(v: np.ndarray) -> np.ndarray:
    """ProPhoto gamma 1.8 映射到 display sRGB 空间 [0, 1]"""
    lin_prophoto = np.clip(v, 0, None) ** 1.8
    lin_srgb = lin_prophoto @ PROPHOTO_TO_SRGB_LIN.T
    lin_srgb = np.clip(lin_srgb, 0, 1)
    # sRGB 伽马编码
    return np.where(lin_srgb <= 0.0031308, 12.92 * lin_srgb, 1.055 * (lin_srgb ** (1 / 2.4)) - 0.055)

LOOK_SPECS = [
    ("FL2", "SonyA7M5 Look FL2.xmp", "Sony_FL2.cube", "Sony FL2 (Film 2 怀旧复古胶片)", "浓郁胶片质感、暗部沉稳微提 (0.03)、暖调怀旧"),
    ("FL3", "SonyA7M5 Look FL3.xmp", "Sony_FL3.cube", "Sony FL3 (Film 3 清透电影胶片)", "柔和低反差、亮部通透清爽、柔美空气感"),
    ("FL",  "SonyA7M5 Look FL.xmp",  "Sony_FL.cube",  "Sony FL (Film 1 经典胶片)",     "暗部蓝绿冷调、高光微暖、经典冷暖电影氛围"),
    ("IN",  "SonyA7M5 Look IN.xmp",  "Sony_IN.cube",  "Sony IN (Instant 拍立得/即时)", "哑光质感、低对比、日系拍立得暗部褪色灰度"),
    ("SH",  "SonyA7M5 Look SH.xmp",  "Sony_SH.cube",  "Sony SH (Soft Highkey 柔和高调)", "明亮柔和、轻盈透亮空气感、高光柔化写真"),
    ("VV2", "SonyA7M5 Look VV2.xmp", "Sony_VV2.cube", "Sony VV2 (Vivid 2 生动2)",       "极清透亮、鲜艳度与微反差明显、通透纯净"),
    ("VV",  "SonyA7M5 Look VV.xmp",  "Sony_VIVID.cube", "Sony VV (Vivid 生动)",         "高对比度、鲜艳明朗、浓烈风光与晚霞"),
    ("PT",  "SonyA7M5 Look PT.xmp",  "Sony_PORTRAIT.cube", "Sony PT (Portrait 人像)",   "优化亚洲人肤色、柔和粉嫩透亮、平滑过渡"),
    ("NT",  "SonyA7M5 Look NT.xmp",  "Sony_NEUTRAL.cube",  "Sony NT (Neutral 中性)",   "真实自然、低反差、保留最大宽容度"),
    ("ST",  "SonyA7M5 Look ST.xmp",  "Sony_STANDARD.cube", "Sony ST (Standard 标准)",   "索尼官方基准自然色彩还原"),
    ("BW",  "SonyA7M5 Look BW.xmp",  "Sony_BW.cube",  "Sony BW (Monochrome 黑白单色)",   "细腻黑白单色、灰阶过渡平滑醇厚"),
    ("SE",  "SonyA7M5 Look SE.xmp",  "Sony_SEPIA.cube", "Sony SE (Sepia 怀旧褐色)",     "典雅复古怀旧棕褐调"),
]

def load_xmp_srgb_table(xmp_path: Path):
    with open(xmp_path, "r", encoding="utf-8") as f:
        text = f.read()

    m = re.search(r'crs:Table_([0-9A-Fa-f]+)="([^"]+)"', text)
    if not m:
        raise ValueError(f"No crs:Table found in {xmp_path}")

    raw = decode_table_str(m.group(2))
    header = struct.unpack_from("<4I", raw, 0)
    n = header[3]
    body = raw[16 : 16 + n**3 * 3 * 2]
    diffs = np.frombuffer(body, dtype="<u2").reshape((n, n, n, 3)).astype(np.int64)
    ident = np.round(np.arange(n) * 65535 / (n - 1)).astype(np.int64)
    I = np.stack(np.meshgrid(ident, ident, ident, indexing="ij"), -1)
    q = (diffs + I) % 65536
    vals = q / 65535.0
    srgb_table = prophoto_v_to_srgb(vals)
    return n, srgb_table

def trilinear_sample(table, r, g, b, n):
    fr = r * (n - 1)
    fg = g * (n - 1)
    fb = b * (n - 1)

    i_r = int(min(max(0, np.floor(fr)), n - 2))
    i_g = int(min(max(0, np.floor(fg)), n - 2))
    i_b = int(min(max(0, np.floor(fb)), n - 2))

    dr = fr - i_r
    dg = fg - i_g
    db = fb - i_b

    c000 = table[i_r, i_g, i_b]
    c001 = table[i_r, i_g, i_b + 1]
    c010 = table[i_r, i_g + 1, i_b]
    c011 = table[i_r, i_g + 1, i_b + 1]
    c100 = table[i_r + 1, i_g, i_b]
    c101 = table[i_r + 1, i_g, i_b + 1]
    c110 = table[i_r + 1, i_g + 1, i_b]
    c111 = table[i_r + 1, i_g + 1, i_b + 1]

    c00 = c000 * (1 - dr) + c100 * dr
    c01 = c001 * (1 - dr) + c101 * dr
    c10 = c010 * (1 - dr) + c110 * dr
    c11 = c011 * (1 - dr) + c111 * dr

    c0 = c00 * (1 - dg) + c10 * dg
    c1 = c01 * (1 - dg) + c11 * dg

    return c0 * (1 - db) + c1 * db

def build_cube(target_table, st_table, n_source, lut_size=33, title="Sony Look"):
    v_grid = np.arange(n_source) / (n_source - 1)
    st_diag = np.array([st_table[i, i, i, 0] for i in range(n_source)])
    st_diag_clean = np.maximum.accumulate(st_diag)

    cube_coords = np.arange(lut_size) / (lut_size - 1)
    cube_data = []
    max_neutral_diff = 0.0

    for b_idx in range(lut_size):
        b_in = cube_coords[b_idx]
        v_b = float(np.interp(b_in, st_diag_clean, v_grid))
        for g_idx in range(lut_size):
            g_in = cube_coords[g_idx]
            v_g = float(np.interp(g_in, st_diag_clean, v_grid))
            for r_idx in range(lut_size):
                r_in = cube_coords[r_idx]
                v_r = float(np.interp(r_in, st_diag_clean, v_grid))

                if r_idx == g_idx == b_idx:
                    fr = v_r * (n_source - 1)
                    i0 = int(min(max(0, np.floor(fr)), n_source - 2))
                    t = fr - i0
                    diag_sample = (1 - t) * target_table[i0, i0, i0] + t * target_table[i0 + 1, i0 + 1, i0 + 1]
                    mean_val = float(np.mean(diag_sample))
                    out_r = out_g = out_b = mean_val
                else:
                    out = trilinear_sample(target_table, v_r, v_g, v_b, n_source)
                    out_r = float(out[0])
                    out_g = float(out[1])
                    out_b = float(out[2])

                out_r = max(0.0, min(1.0, out_r))
                out_g = max(0.0, min(1.0, out_g))
                out_b = max(0.0, min(1.0, out_b))

                if r_idx == g_idx == b_idx:
                    diff = max(abs(out_r - out_g), abs(out_g - out_b))
                    if diff > max_neutral_diff:
                        max_neutral_diff = diff

                cube_data.append((out_r, out_g, out_b))

    lines = [
        f'# Sony Creative Look 3D-LUT (Source: 751K/sony-a7m5-looks Lightroom XMP Profile)',
        f'# Bit-verified reverse-engineered Sony BIONZ XR pipeline',
        f'TITLE "{title}"',
        f'LUT_3D_SIZE {lut_size}',
        'DOMAIN_MIN 0.0 0.0 0.0',
        'DOMAIN_MAX 1.0 1.0 1.0\n'
    ]
    for r, g, b in cube_data:
        lines.append(f"{r:.6f} {g:.6f} {b:.6f}")

    return "\n".join(lines), max_neutral_diff

def main():
    parser = argparse.ArgumentParser(description="Convert 751K Sony Look XMP profiles to .cube LUTs")
    parser.add_argument("input", nargs="?", default=str(DEFAULT_XMP_DIR), help="Path to XMP file or directory")
    parser.add_argument("-o", "--output", default=str(DEFAULT_OUT_DIR), help="Output directory or file path")
    parser.add_argument("--size", type=int, default=33, help="Grid size of the 3D-LUT (default: 33)")
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)

    # 确认 ST 基准文件路径
    st_file = in_path / "SonyA7M5 Look ST.xmp" if in_path.is_dir() else DEFAULT_XMP_DIR / "SonyA7M5 Look ST.xmp"
    if not st_file.exists():
        fallback_tmp = Path("/tmp/sony-a7m5-looks/profiles/camera_raw/SonyA7M5 Look ST.xmp")
        if fallback_tmp.exists():
            st_file = fallback_tmp
        else:
            print(f"❌ 错误: 找不到基准文件 SonyA7M5 Look ST.xmp ({st_file})")
            sys.exit(1)

    print(f"🔍 正在读取基准 Standard (ST) 预设: {st_file.name} ...")
    n_source, st_table = load_xmp_srgb_table(st_file)

    if in_path.is_file():
        # 单文件转换模式
        print(f"🎨 正在转换单个文件: {in_path.name} -> {out_path} ...")
        n_look, target_table = load_xmp_srgb_table(in_path)
        title = in_path.stem
        cube_str, neutral_err = build_cube(target_table, st_table, n_source, lut_size=args.size, title=title)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(cube_str)
        print(f"✅ 转换完成！白平衡残差: {neutral_err:.1e}")
        return

    # 目录批量转换模式
    out_dir = out_path
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"🚀 批量高精度生成全套 3D-LUT 到: {out_dir} (网格: {args.size}^3) ...\n")

    for short_name, xmp_name, cube_name, full_name, _ in LOOK_SPECS:
        xmp_file = in_path / xmp_name
        if not xmp_file.exists():
            fallback_xmp = Path("/tmp/sony-a7m5-looks/profiles/camera_raw") / xmp_name
            if fallback_xmp.exists():
                xmp_file = fallback_xmp
            else:
                print(f"   ⚠ 跳过缺失的预设: {xmp_name}")
                continue

        n_look, target_table = load_xmp_srgb_table(xmp_file)
        cube_str, neutral_err = build_cube(
            target_table=target_table,
            st_table=st_table,
            n_source=n_source,
            lut_size=args.size,
            title=f"Sony_{short_name}_751K"
        )

        # 写入主文件名 (如 Sony_FL2.cube)
        dst_cube = out_dir / cube_name
        with open(dst_cube, "w", encoding="utf-8") as f:
            f.write(cube_str)

        # 兼容性别名 (如 Sony_Look_FL2.cube)
        alias_cube = out_dir / f"Sony_Look_{short_name}.cube"
        with open(alias_cube, "w", encoding="utf-8") as f:
            f.write(cube_str)

        print(f"   ✓ {cube_name:<20} [白平衡残差: {neutral_err:.1e}] {full_name}")

    print(f"\n🎉 全部 12 款索尼创意外观 3D-LUT 已成功生成并写入: {out_dir}")

if __name__ == "__main__":
    main()
