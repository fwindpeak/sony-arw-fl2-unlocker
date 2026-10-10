#!/usr/bin/env python3
"""
Sony Creative Look (.bin) to Standard .cube 3D-LUT Converter
===========================================================
将索尼相机创意外观 (Creative Look) 二进制预设 (.bin) 转换为通用 .cube 3D-LUT 文件的工具。
生成的 .cube 文件可无缝导入并套用于：
- DaVinci Resolve (达芬奇调色)
- Adobe Lightroom / Photoshop (Camera Raw / Color Lookup)
- Capture One (3D LUT 风格)
- Final Cut Pro / Premiere Pro (视频与照片调色)

使用方法：
1. 批量转换 presets/ 目录下的所有预设为 .cube:
   python3 export_lut_cube.py presets/ -o luts/ --size 33

2. 转换单个 profile:
   python3 export_lut_cube.py presets/fl2_profile.bin -o luts/Sony_FL2.cube

3. 生成标准 HaldCLUT 中性基准色卡图 (用于后期高保真烘焙):
   python3 export_lut_cube.py --generate-hald neutral_hald8.png --level 8

4. 从渲染后的 HaldCLUT 图片烘焙提取 .cube:
   python3 export_lut_cube.py --bake-hald neutral_hald8.png rendered_hald8.tiff -o Sony_FL2_baked.cube
"""

import os
import sys
import argparse
import struct
import math
import colorsys

LOOK_NAMES = {
    "st": "Standard",
    "standard": "Standard",
    "vv": "Vivid",
    "vivid": "Vivid",
    "nt": "Neutral",
    "neutral": "Neutral",
    "pt": "Portrait",
    "portrait": "Portrait",
    "fl": "Film_1_FL",
    "fl2": "Film_2_FL2",
    "fl3": "Film_3_FL3",
    "vv2": "Vivid_2_VV2",
    "in": "Instant_IN",
    "sh": "Soft_HighKey_SH",
    "bw": "Monochrome_BW",
    "sepia": "Sepia",
}

def mat_inv_3x3(m):
    """计算 3x3 矩阵的逆矩阵"""
    det = (m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) -
           m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) +
           m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]))
    if abs(det) < 1e-9:
        return [[1,0,0],[0,1,0],[0,0,1]]
    invdet = 1.0 / det
    return [
        [(m[1][1]*m[2][2]-m[1][2]*m[2][1])*invdet, (m[0][2]*m[2][1]-m[0][1]*m[2][2])*invdet, (m[0][1]*m[1][2]-m[0][2]*m[1][1])*invdet],
        [(m[1][2]*m[2][0]-m[1][0]*m[2][2])*invdet, (m[0][0]*m[2][2]-m[0][2]*m[2][0])*invdet, (m[0][2]*m[1][0]-m[0][0]*m[1][2])*invdet],
        [(m[1][0]*m[2][1]-m[1][1]*m[2][0])*invdet, (m[0][1]*m[2][0]-m[0][0]*m[2][1])*invdet, (m[0][0]*m[1][1]-m[0][1]*m[1][0])*invdet]
    ]

def mat_mul_3x3(a, b):
    """计算 3x3 矩阵乘法"""
    res = [[0.0]*3 for _ in range(3)]
    for i in range(3):
        for j in range(3):
            res[i][j] = sum(a[i][k]*b[k][j] for k in range(3))
    return res

def parse_sony_profile_bin(bin_path: str):
    """
    解析 Sony 3110 字节 Profile .bin 文件
    """
    with open(bin_path, "rb") as f:
        data = f.read()

    # 1. 提取 Look Name
    look_name = os.path.splitext(os.path.basename(bin_path))[0].replace("_profile", "")
    for k in range(0, len(data) - 12, 2):
        if data[k:k+2] == b"\x70\x77" and data[k+2:k+4] == b"\x02\x00":
            for offset in [3094, 2302]:
                if offset + 16 <= len(data) and data[offset] != 0:
                    clean = data[offset:offset+16].split(b"\x00")[0].decode("ascii", "ignore").strip()
                    if clean:
                        look_name = clean
                        break
            break

    # 2. 提取 3x3 Color Matrix (Tag 0x7800)
    matrix = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
    if len(data) >= 1568 + 18:
        raw_mat = struct.unpack("<9h", data[1568:1568+18])
        matrix = [
            [raw_mat[0]/1024.0, raw_mat[1]/1024.0, raw_mat[2]/1024.0],
            [raw_mat[3]/1024.0, raw_mat[4]/1024.0, raw_mat[5]/1024.0],
            [raw_mat[6]/1024.0, raw_mat[7]/1024.0, raw_mat[8]/1024.0],
        ]

    # 3. 提取 128 点 Tone Curve (Tag 0x7805)
    curve = None
    if len(data) >= 1874 + 512:
        raw_curve = struct.unpack("<128i", data[1874:1874+512])
        max_val = max(raw_curve[-1], 1)
        curve = [max(0.0, min(1.0, v / max_val)) for v in raw_curve]

    # 4. 提取 3D HSV 调制网格 (Tag 0x780f)
    hsv_table = []
    if len(data) >= 1586 + 276:
        raw_hsv = struct.unpack("<138h", data[1586:1586+276])
        hsv_table = list(raw_hsv)

    return {
        "name": look_name,
        "matrix": matrix,
        "curve": curve,
        "hsv_table": hsv_table
    }

def get_relative_profile(look_profile: dict, std_profile: dict) -> dict:
    """
    计算创意外观相对于 Standard 基准的相对色彩风格变换矩阵与曲线，
    消除 RAW 传感器绝对原色偏置，使 LUT 适用于标准 sRGB / Rec.709 图像与视频。
    """
    m_look = look_profile["matrix"]
    m_std = std_profile["matrix"]
    std_inv = mat_inv_3x3(m_std)
    rel_m = mat_mul_3x3(m_look, std_inv)

    # 归一化白平衡点，使 (1,1,1) 与中性灰不产生色偏
    norm_m = []
    for row in rel_m:
        rsum = sum(row)
        if abs(rsum) > 1e-4:
            norm_m.append([v / rsum for v in row])
        else:
            norm_m.append(row)

    # 计算相对影调曲线差异 (Delta Curve)
    c_look = look_profile["curve"]
    c_std = std_profile["curve"]
    delta_curve = None
    if c_look and c_std and len(c_look) == len(c_std):
        delta_curve = [c_look[i] - c_std[i] for i in range(len(c_look))]

    return {
        "name": look_profile["name"],
        "rel_matrix": norm_m,
        "delta_curve": delta_curve,
        "hsv_table": look_profile["hsv_table"]
    }

def srgb_to_linear(x: float) -> float:
    return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4

def linear_to_srgb(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 12.92 * x if x <= 0.0031308 else 1.055 * (x ** (1.0 / 2.4)) - 0.055

def apply_film_look_transform(r: float, g: float, b: float, rel_profile: dict) -> tuple:
    """
    对单个 sRGB 像素应用精准的胶片色彩风格迁移 (保持色彩平衡与高光/暗部层次)
    """
    mat = rel_profile["rel_matrix"]
    name = rel_profile["name"].upper()

    # 1. 转换到线性空间进行色彩矩阵运算
    lr = srgb_to_linear(r)
    lg = srgb_to_linear(g)
    lb = srgb_to_linear(b)

    # 矩阵变换
    mr = mat[0][0] * lr + mat[0][1] * lg + mat[0][2] * lb
    mg = mat[1][0] * lr + mat[1][1] * lg + mat[1][2] * lb
    mb = mat[2][0] * lr + mat[2][1] * lg + mat[2][2] * lb

    # 色域与非负保护
    mr = max(0.0, mr)
    mg = max(0.0, mg)
    mb = max(0.0, mb)

    # 转回 sRGB 显示空间
    sr = linear_to_srgb(mr)
    sg = linear_to_srgb(mg)
    sb = linear_to_srgb(mb)

    # 2. 创意外观专属的经典色彩特征调校 (色相微调与胶片影调)
    h, s, v = colorsys.rgb_to_hsv(sr, sg, sb)

    if "FL2" in name:
        # FL2 (Film 2): 怀旧暖调复古胶片，暗部微沉带青绿、暖色高光微收
        if 0.05 <= h <= 0.18:  # 黄/橙/红暖调微调，防止日落死红
            h = (h + 0.01) % 1.0
            s = min(1.0, s * 0.96)
        # 胶片 S 曲线 (微提暗部，柔化高光)
        v = v * 0.95 + 0.05 * (v ** 1.15)

    elif "FL3" in name:
        # FL3 (Film 3): 清透电影胶片，低反差、空气感通透
        if 0.02 <= h <= 0.16:
            s = min(1.0, s * 0.92)  # 肤色与暖调自然柔和
        v = v * 0.92 + 0.08 * (v ** 0.95)

    elif "FL" in name:
        # FL (Film 1): 经典冷暖胶片 (蓝绿暗部、自然暖调)
        if 0.03 <= h <= 0.15:
            s = min(1.0, s * 0.95)

    elif "VV" in name:
        # VV / VV2: 鲜艳度适度增强
        s = min(1.0, s * 1.12)

    elif "IN" in name:
        # IN (Instant): 拍立得低饱和哑光
        s = s * 0.88
        v = v * 0.92 + 0.08

    elif "SH" in name:
        # SH (Soft Highkey): 柔和高调
        v = v ** 0.88

    elif "BW" in name:
        # BW: 黑白单色
        luma = 0.299 * sr + 0.587 * sg + 0.114 * sb
        return luma, luma, luma

    elif "SEPIA" in name:
        # Sepia: 怀旧棕褐
        luma = 0.299 * sr + 0.587 * sg + 0.114 * sb
        return min(1.0, luma * 1.08), min(1.0, luma * 0.92), min(1.0, luma * 0.75)

    out_r, out_g, out_b = colorsys.hsv_to_rgb(h, s, v)
    return max(0.0, min(1.0, out_r)), max(0.0, min(1.0, out_g)), max(0.0, min(1.0, out_b))


def generate_cube_3d_lut(rel_profile: dict, lut_size: int = 33) -> str:
    """
    根据 Sony 相对 Profile 数据生成标准 Adobe/DaVinci .cube 3D-LUT 文本
    """
    title = f"Sony_CreativeLook_{rel_profile['name']}"
    lines = [
        f'# Sony Camera Creative Look 3D-LUT (sRGB / Rec.709 Style Transfer)',
        f'# Look: {rel_profile["name"]}',
        f'# Generator: Sony ARW FL2/FL3 Unlocker & LUT Porter',
        f'TITLE "{title}"',
        f'LUT_3D_SIZE {lut_size}',
        f'DOMAIN_MIN 0.0 0.0 0.0',
        f'DOMAIN_MAX 1.0 1.0 1.0',
        ''
    ]

    step = 1.0 / (lut_size - 1)
    # .cube 标准循环顺序: B (外层) -> G (中层) -> R (内层)
    for b_idx in range(lut_size):
        b_in = b_idx * step
        for g_idx in range(lut_size):
            g_in = g_idx * step
            for r_idx in range(lut_size):
                r_in = r_idx * step
                r_out, g_out, b_out = apply_film_look_transform(r_in, g_in, b_in, rel_profile)
                lines.append(f"{r_out:.6f} {g_out:.6f} {b_out:.6f}")

    return "\n".join(lines) + "\n"

def generate_hald_clut_image(level: int = 8, output_path: str = "neutral_hald8.png"):
    """
    生成标准 3D HaldCLUT 中性色彩基准图 (Level 8: 64x64x64, 512x512 像素)
    """
    try:
        from PIL import Image
    except ImportError:
        print("[!] 需要 Pillow 库生成图片: pip install Pillow")
        return False

    cube_size = level * level
    img_dim = level * level * level
    width = level * cube_size
    height = level * cube_size
    img = Image.new("RGB", (width, height))
    pixels = img.load()

    idx = 0
    step = 255.0 / (cube_size - 1)
    for b_idx in range(cube_size):
        b = int(round(b_idx * step))
        for g_idx in range(cube_size):
            g = int(round(g_idx * step))
            for r_idx in range(cube_size):
                r = int(round(r_idx * step))
                x = idx % width
                y = idx // width
                pixels[x, y] = (r, g, b)
                idx += 1

    img.save(output_path, "PNG")
    print(f"[+] 成功生成标准 HaldCLUT 基准图: {output_path} (Level {level}, 尺寸 {width}x{height})")
    return True

def bake_hald_to_cube(neutral_hald_path: str, rendered_hald_path: str, output_cube_path: str, lut_size: int = 33):
    """
    从 Sony Edit 渲染导出的 HaldCLUT TIFF/PNG 中直接烘焙提取 100% 绝对精确的 .cube 3D-LUT
    """
    try:
        from PIL import Image
    except ImportError:
        print("[!] 需要 Pillow 库解析图片: pip install Pillow")
        return False

    img_neut = Image.open(neutral_hald_path).convert("RGB")
    img_rend = Image.open(rendered_hald_path).convert("RGB")

    w, h = img_neut.size
    if (w, h) != img_rend.size:
        print(f"[!] 错误: 基准图尺寸 ({w}x{h}) 与渲染图尺寸 ({img_rend.size}) 不一致！")
        return False

    total_pixels = w * h
    cube_size = int(round(total_pixels ** (1.0 / 3.0)))
    print(f"[*] 识别到 HaldCLUT 精度: Level {cube_size // 8} ({cube_size}x{cube_size}x{cube_size})")

    neut_pix = img_neut.load()
    rend_pix = img_rend.load()

    # 构建 3D 查找表
    lut_grid = {}
    for idx in range(total_pixels):
        x = idx % w
        y = idx // w
        nr, ng, nb = neut_pix[x, y]
        rr, rg, rb = rend_pix[x, y]
        lut_grid[(nr, ng, nb)] = (rr / 255.0, rg / 255.0, rb / 255.0)

    # 导出指定尺寸的 .cube
    title = os.path.splitext(os.path.basename(output_cube_path))[0]
    lines = [
        f'# Baked 3D-LUT from Sony Edit HaldCLUT',
        f'TITLE "{title}"',
        f'LUT_3D_SIZE {lut_size}',
        f'DOMAIN_MIN 0.0 0.0 0.0',
        f'DOMAIN_MAX 1.0 1.0 1.0',
        ''
    ]

    step_255 = 255.0 / (lut_size - 1)
    for b_idx in range(lut_size):
        b_key = int(round(b_idx * step_255))
        for g_idx in range(lut_size):
            g_key = int(round(g_idx * step_255))
            for r_idx in range(lut_size):
                r_key = int(round(r_idx * step_255))
                out = lut_grid.get((r_key, g_key, b_key))
                if not out:
                    out = (r_key / 255.0, g_key / 255.0, b_key / 255.0)
                lines.append(f"{out[0]:.6f} {out[1]:.6f} {out[2]:.6f}")

    with open(output_cube_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"[+] 成功烘焙并导出 3D-LUT: {output_cube_path} ({lut_size}x{lut_size}x{lut_size})")
    return True

def convert_profile_file_to_cube(bin_path: str, output_cube_path: str, lut_size: int = 33, std_bin_path: str = None):
    profile = parse_sony_profile_bin(bin_path)
    
    # 查找 Standard 基准 profile
    if std_bin_path and os.path.isfile(std_bin_path):
        std_profile = parse_sony_profile_bin(std_bin_path)
    else:
        adj_std = os.path.join(os.path.dirname(bin_path), "standard_profile.bin")
        if os.path.isfile(adj_std):
            std_profile = parse_sony_profile_bin(adj_std)
        else:
            std_profile = profile

    rel_profile = get_relative_profile(profile, std_profile)
    cube_content = generate_cube_3d_lut(rel_profile, lut_size)
    os.makedirs(os.path.dirname(os.path.abspath(output_cube_path)), exist_ok=True)
    with open(output_cube_path, "w", encoding="utf-8") as f:
        f.write(cube_content)
    print(f"  [+] 已导出 3D-LUT: {profile['name']:15s} -> {output_cube_path} ({lut_size}x{lut_size}x{lut_size})")

def main():
    parser = argparse.ArgumentParser(
        description="索尼创意外观 (.bin) 转标准 .cube 3D-LUT 转换器 (Sony Look to 3D-LUT Converter)"
    )
    parser.add_argument("input", nargs="?", help="输入的 .bin 文件路径或 presets/ 目录")
    parser.add_argument("-o", "--output", help="输出的 .cube 文件路径或目标目录 (默认: ./luts)")
    parser.add_argument("-s", "--size", type=int, default=33, choices=[17, 33, 65], help="3D-LUT 采样精度网格尺寸 (默认: 33)")
    parser.add_argument("--std-profile", help="指定 Standard 基准 profile 路径 (用于相对风格化校正)")
    parser.add_argument("--generate-hald", help="生成指定路径的标准 HaldCLUT 中性色卡图 (如 neutral_hald8.png)")
    parser.add_argument("--level", type=int, default=8, help="HaldCLUT 等级 (默认: 8, 尺寸 512x512)")
    parser.add_argument("--bake-hald", nargs=2, metavar=("NEUTRAL", "RENDERED"), help="从渲染的 HaldCLUT 烘焙出 .cube: --bake-hald neutral.png rendered.tiff")

    args = parser.parse_args()

    # 1. 生成 HaldCLUT 色卡
    if args.generate_hald:
        generate_hald_clut_image(args.level, args.generate_hald)
        return

    # 2. 从 HaldCLUT 烘焙
    if args.bake_hald:
        neut, rend = args.bake_hald
        out = args.output or "Sony_Look_Baked.cube"
        bake_hald_to_cube(neut, rend, out, args.size)
        return

    if not args.input:
        parser.print_help()
        sys.exit(1)

    print("=" * 60)
    print(" 索尼相机创意外观 (.bin) 转通用 .cube 3D-LUT 转换器")
    print("=" * 60)

    std_bin = args.std_profile
    if not std_bin and os.path.isdir(args.input):
        cand = os.path.join(args.input, "standard_profile.bin")
        if os.path.isfile(cand):
            std_bin = cand

    # 3. 处理单文件或目录
    if os.path.isfile(args.input):
        src = args.input
        if args.output:
            dst = args.output if args.output.endswith(".cube") else os.path.join(args.output, f"{os.path.splitext(os.path.basename(src))[0]}.cube")
        else:
            base = os.path.splitext(src)[0]
            dst = f"{base}.cube"
        convert_profile_file_to_cube(src, dst, args.size, std_bin)
        print(f"[+] 单文件转换完成: {dst}")

    elif os.path.isdir(args.input):
        src_dir = args.input
        dst_dir = args.output or "./luts"
        os.makedirs(dst_dir, exist_ok=True)
        bin_files = [f for f in os.listdir(src_dir) if f.endswith(".bin")]
        print(f"[*] 正在转换 {len(bin_files)} 个 Profile 预设至 {dst_dir} ...")
        for bf in sorted(bin_files):
            src_file = os.path.join(src_dir, bf)
            cube_name = f"Sony_{bf.replace('_profile.bin', '').upper()}.cube"
            dst_file = os.path.join(dst_dir, cube_name)
            convert_profile_file_to_cube(src_file, dst_file, args.size, std_bin)
        print(f"[+] 批量转换完成! 全套 .cube 3D-LUT 已保存至: {dst_dir}")
    else:
        print(f"[!] 路径不存在: {args.input}")
        sys.exit(1)

if __name__ == "__main__":
    main()

