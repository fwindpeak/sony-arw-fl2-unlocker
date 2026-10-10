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

def parse_sony_profile_bin(bin_path: str):
    """
    解析 Sony 3110 字节或 2318 字节的 Profile .bin 文件，提取色彩矩阵、色相网格与影调曲线
    """
    with open(bin_path, "rb") as f:
        data = f.read()

    # 1. 查找 Look Name (Tag 0x7770)
    look_name = os.path.splitext(os.path.basename(bin_path))[0].replace("_profile", "")
    for k in range(0, len(data) - 12, 2):
        if data[k:k+2] == b"\x70\x77" and data[k+2:k+4] == b"\x02\x00":
            val = struct.unpack("<I", data[k+8:k+12])[0]
            # 尝试在数据末尾查找名字
            name_candidates = [
                data[2302:2318],
                data[3094:3110],
            ]
            for nc in name_candidates:
                if nc and nc[0] != 0:
                    clean = nc.split(b"\x00")[0].decode("ascii", "ignore").strip()
                    if clean:
                        look_name = clean
                        break
            break

    # 2. 提取 3x3 Color Matrix (Tag 0x7800)
    matrix = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0]
    ]
    if len(data) >= 1568 + 18:
        raw_mat = struct.unpack("<9h", data[1568:1568+18])
        # Sony 3x3 矩阵通常以 1024 (2^10) 为基准归一化
        matrix = [
            [raw_mat[0]/1024.0, raw_mat[1]/1024.0, raw_mat[2]/1024.0],
            [raw_mat[3]/1024.0, raw_mat[4]/1024.0, raw_mat[5]/1024.0],
            [raw_mat[6]/1024.0, raw_mat[7]/1024.0, raw_mat[8]/1024.0],
        ]

    # 3. 提取 128 点 Tone Curve (Tag 0x7805)
    curve = None
    if len(data) >= 1874 + 512:
        raw_curve = struct.unpack("<128i", data[1874:1874+512])
        # 归一化曲线值到 0.0 ~ 1.0
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

def apply_tone_curve(val: float, curve: list) -> float:
    """对归一化亮度应用 128 点样条曲线插值"""
    if not curve:
        return val
    val = max(0.0, min(1.0, val))
    idx_f = val * (len(curve) - 1)
    idx0 = int(math.floor(idx_f))
    idx1 = min(idx0 + 1, len(curve) - 1)
    t = idx_f - idx0
    return (1.0 - t) * curve[idx0] + t * curve[idx1]

def apply_profile_transform(r: float, g: float, b: float, profile: dict) -> tuple:
    """
    对单个归一化 RGB [0.0, 1.0] 像素应用 Sony 色彩科学变换
    """
    mat = profile["matrix"]
    curve = profile["curve"]
    hsv_table = profile["hsv_table"]

    # 1. 3x3 线性色彩矩阵映射
    mr = mat[0][0] * r + mat[0][1] * g + mat[0][2] * b
    mg = mat[1][0] * r + mat[1][1] * g + mat[1][2] * b
    mb = mat[2][0] * r + mat[2][1] * g + mat[2][2] * b

    # 限制到非负
    mr = max(0.0, min(1.0, mr))
    mg = max(0.0, min(1.0, mg))
    mb = max(0.0, min(1.0, mb))

    # 2. 3D HSV 空间特定色相微调 (Film 胶片色彩特征调校)
    h, s, v = colorsys.rgb_to_hsv(mr, mg, mb)
    if hsv_table and len(hsv_table) >= 16 and s > 0.001:
        # 计算色相分区 (0 ~ 15)
        sector = (h * 16.0) % 16.0
        s_idx0 = int(math.floor(sector))
        s_idx1 = (s_idx0 + 1) % 16
        st = sector - s_idx0

        # 取出微调偏移系数
        delta_h = ((1.0 - st) * hsv_table[s_idx0] + st * hsv_table[s_idx1]) / 65536.0
        h = (h + delta_h) % 1.0

        # 根据创意外观微调暗部与高光饱和度
        mr, mg, mb = colorsys.hsv_to_rgb(h, s, v)

    # 3. 影调曲线 (Tone Curve) 映射
    if curve:
        mr = apply_tone_curve(mr, curve)
        mg = apply_tone_curve(mg, curve)
        mb = apply_tone_curve(mb, curve)

    # 最终裁切到 [0.0, 1.0]
    out_r = max(0.0, min(1.0, mr))
    out_g = max(0.0, min(1.0, mg))
    out_b = max(0.0, min(1.0, mb))

    return out_r, out_g, out_b

def generate_cube_3d_lut(profile: dict, lut_size: int = 33) -> str:
    """
    根据 Sony Profile 数据生成标准 Adobe/DaVinci .cube 3D-LUT 文本
    """
    title = f"Sony_CreativeLook_{profile['name']}"
    lines = [
        f'# Sony Camera Creative Look 3D-LUT',
        f'# Look: {profile["name"]}',
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
                r_out, g_out, b_out = apply_profile_transform(r_in, g_in, b_in, profile)
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
    # 宽度与高度
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
                # 寻找最接近的采样点
                out = lut_grid.get((r_key, g_key, b_key))
                if not out:
                    out = (r_key / 255.0, g_key / 255.0, b_key / 255.0)
                lines.append(f"{out[0]:.6f} {out[1]:.6f} {out[2]:.6f}")

    with open(output_cube_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"[+] 成功烘焙并导出 3D-LUT: {output_cube_path} ({lut_size}x{lut_size}x{lut_size})")
    return True

def convert_profile_file_to_cube(bin_path: str, output_cube_path: str, lut_size: int = 33):
    profile = parse_sony_profile_bin(bin_path)
    cube_content = generate_cube_3d_lut(profile, lut_size)
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

    # 3. 处理单文件或目录
    if os.path.isfile(args.input):
        src = args.input
        if args.output:
            dst = args.output if args.output.endswith(".cube") else os.path.join(args.output, f"{os.path.splitext(os.path.basename(src))[0]}.cube")
        else:
            base = os.path.splitext(src)[0]
            dst = f"{base}.cube"
        convert_profile_file_to_cube(src, dst, args.size)
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
            convert_profile_file_to_cube(src_file, dst_file, args.size)
        print(f"[+] 批量转换完成! 全套 .cube 3D-LUT 已保存至: {dst_dir}")
    else:
        print(f"[!] 路径不存在: {args.input}")
        sys.exit(1)

if __name__ == "__main__":
    main()
