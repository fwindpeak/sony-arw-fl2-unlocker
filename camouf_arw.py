#!/usr/bin/env python3
"""
Sony ARW Camera Model Camouflage Tool
用于将索尼 A7C2 (ILCE-7CM2) 等机型的 ARW 照片伪装为 A7M5 / A1M2 等机型，
以便在 Sony Imaging Edge Edit 中解锁 FL2 (Film 2) / FL3 滤镜与色彩外观。
"""

import sys
import os
import argparse
import subprocess
import shutil

SUPPORTED_TARGETS = {
    "a7m5": {
        "model": "ILCE-7M5",
        "description": "Sony Alpha 7 V (支持 FL2/FL3 滤镜)",
    },
    "a1m2": {
        "model": "ILCE-1M2",
        "description": "Sony Alpha 1 II (支持 FL2/FL3 滤镜)",
    },
    "a9m3": {
        "model": "ILCE-9M3",
        "description": "Sony Alpha 9 III",
    },
    "a7rm5": {
        "model": "ILCE-7RM5",
        "description": "Sony Alpha 7R V",
    },
    "a7c2": {
        "model": "ILCE-7CM2",
        "description": "Sony Alpha 7C II (原始机型)",
    }
}

def check_exiftool():
    """检查系统是否安装 exiftool"""
    try:
        subprocess.run(["exiftool", "-ver"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        return False

def disguise_arw_exiftool(src_path: str, dst_path: str, target_model: str) -> bool:
    """使用 ExifTool 修改 ARW 文件的相机型号与标签"""
    shutil.copy2(src_path, dst_path)
    cmd = [
        "exiftool",
        "-overwrite_original",
        f"-Model={target_model}",
        f"-SonyModelID={target_model}",
        dst_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(f"[!] ExifTool 警告: {result.stderr.strip()}", file=sys.stderr)
        return False
    return True

def inspect_arw(file_path: str):
    """查看 ARW 文件当前的相机型号和创意外观标签"""
    if not check_exiftool():
        print("[!] 错误: 未检测到 exiftool，请使用 brew install exiftool 安装。")
        return
    cmd = [
        "exiftool",
        "-Model",
        "-SonyModelID",
        "-CreativeStyle",
        "-ColorMode",
        "-Software",
        file_path
    ]
    subprocess.run(cmd)

def main():
    parser = argparse.ArgumentParser(
        description="索尼 ARW 照片机型伪装工具 (Sony ARW Camouflage for Imaging Edge Edit)"
    )
    parser.add_argument("input", help="输入的 ARW 文件或包含 ARW 文件的目录")
    parser.add_argument("-o", "--output", help="输出文件或输出目录 (默认在原文件名后加 _spoofed.ARW)")
    parser.add_argument(
        "-t", "--target",
        default="a7m5",
        choices=list(SUPPORTED_TARGETS.keys()),
        help="目标伪装机型 (默认: a7m5)"
    )
    parser.add_argument("-i", "--inspect", action="store_true", help="仅查看文件元数据信息")

    args = parser.parse_args()

    if args.inspect:
        if os.path.isfile(args.input):
            inspect_arw(args.input)
        else:
            print(f"[!] 路径不是有效文件: {args.input}")
        return

    if not check_exiftool():
        print("[!] 错误: 未找到 exiftool。请先运行 `brew install exiftool`。")
        sys.exit(1)

    target_info = SUPPORTED_TARGETS[args.target]
    target_model = target_info["model"]
    print(f"[*] 伪装目标: {target_model} ({target_info['description']})")

    if os.path.isfile(args.input):
        src = args.input
        if args.output:
            dst = args.output
        else:
            base, ext = os.path.splitext(src)
            dst = f"{base}_{args.target}{ext}"
        print(f"[*] 正在处理: {src} -> {dst}")
        if disguise_arw_exiftool(src, dst, target_model):
            print(f"[+] 处理成功! 可以在 Sony Edit 中打开 {dst} 测试 FL2 效果。")
    elif os.path.isdir(args.input):
        src_dir = args.input
        dst_dir = args.output or os.path.join(src_dir, f"spoofed_{args.target}")
        os.makedirs(dst_dir, exist_ok=True)
        files = [f for f in os.listdir(src_dir) if f.lower().endswith((".arw", ".srf", ".sr2"))]
        print(f"[*] 发现 {len(files)} 个 RAW 文件...")
        for f in files:
            src_file = os.path.join(src_dir, f)
            dst_file = os.path.join(dst_dir, f)
            print(f" -> 处理: {f}")
            disguise_arw_exiftool(src_file, dst_file, target_model)
        print(f"[+] 批量处理完成，输出目录: {dst_dir}")
    else:
        print(f"[!] 错误: 输入路径不存在: {args.input}")
        sys.exit(1)

if __name__ == "__main__":
    main()
