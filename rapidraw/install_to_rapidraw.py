#!/usr/bin/env python3
"""
RapidRAW Sony Creative Looks 一键安装脚本
==========================================
自动定位系统中的 RapidRAW 配置目录，并一键安装：
1. 12 款索尼原厂 3D-LUT (.cube) 到 RapidRAW 的 luts 目录；
2. 索尼创意外观预设组到 RapidRAW 的 presets/presets.json 中。
"""

import os
import sys
import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
LUTS_SRC = HERE / "luts"
PRESET_JSON_SRC = HERE / "rapidraw_sony_creative_looks.json"

def get_rapidraw_data_dir() -> Path:
    """获取不同操作系统下的 RapidRAW 应用数据目录"""
    home = Path.home()
    candidates = []
    
    if sys.platform == "darwin":  # macOS
        candidates.append(home / "Library" / "Application Support" / "io.github.CyberTimon.RapidRAW")
        candidates.append(home / "Library" / "Application Support" / "RapidRAW")
    elif sys.platform == "win32":  # Windows
        appdata = os.environ.get("APPDATA")
        if appdata:
            candidates.append(Path(appdata) / "io.github.CyberTimon.RapidRAW")
            candidates.append(Path(appdata) / "RapidRAW")
            candidates.append(Path(appdata) / "CyberTimon" / "RapidRAW")
        localappdata = os.environ.get("LOCALAPPDATA")
        if localappdata:
            candidates.append(Path(localappdata) / "io.github.CyberTimon.RapidRAW")
            candidates.append(Path(localappdata) / "RapidRAW")
    else:  # Linux
        candidates.append(home / ".local" / "share" / "io.github.CyberTimon.RapidRAW")
        candidates.append(home / ".local" / "share" / "RapidRAW")
        candidates.append(home / ".config" / "RapidRAW")

    for c in candidates:
        if c.exists():
            return c
            
    # 如果不存在，使用默认推荐路径
    return candidates[0]

def install():
    data_dir = get_rapidraw_data_dir()
    print("=" * 60)
    print("🚀 RapidRAW 索尼创意外观 (Sony Creative Looks) 一键安装工具")
    print("=" * 60)
    print(f"📁 目标 RapidRAW 目录: {data_dir}")

    data_dir.mkdir(parents=True, exist_ok=True)
    luts_dir = data_dir / "luts"
    presets_dir = data_dir / "presets"
    luts_dir.mkdir(parents=True, exist_ok=True)
    presets_dir.mkdir(parents=True, exist_ok=True)

    # 1. 拷贝 LUT 文件
    print("\n🎨 1. 正在安装 3D-LUT (.cube) 文件到 RapidRAW ...")
    count_lut = 0
    if LUTS_SRC.exists():
        for cube_path in LUTS_SRC.glob("*.cube"):
            dest = luts_dir / cube_path.name
            shutil.copy2(cube_path, dest)
            print(f"   ✓ 已安装 LUT: {cube_path.name}")
            count_lut += 1
    print(f"   ➜ 共成功安装 {count_lut} 个 3D-LUT！可在 RapidRAW 右侧 Effects -> LUT 中直接选用。")

    # 2. 合并或导入 Presets
    print("\n📑 2. 正在安装创意外观预设到 RapidRAW ...")
    if PRESET_JSON_SRC.exists():
        target_presets_json = presets_dir / "presets.json"
        with open(PRESET_JSON_SRC, "r", encoding="utf-8") as f:
            new_data = json.load(f)
        
        new_items = new_data.get("presets", [])
        
        current_presets = []
        if target_presets_json.exists():
            try:
                with open(target_presets_json, "r", encoding="utf-8") as f:
                    current_presets = json.load(f)
                # 备份旧预设
                backup_path = presets_dir / "presets.json.bak"
                shutil.copy2(target_presets_json, backup_path)
                print(f"   ℹ 已备份当前预设到: {backup_path.name}")
            except Exception as e:
                print(f"   ⚠ 读取现有 presets.json 失败: {e}，将新建文件")

        # 检查是否已存在同名 Sony Creative Looks 分组，若存在则更新
        existing_idx = None
        for i, item in enumerate(current_presets):
            if "folder" in item and "Sony Creative Looks" in item["folder"].get("name", ""):
                existing_idx = i
                break

        if existing_idx is not None:
            current_presets[existing_idx] = new_items[0]
            print("   ✓ 已更新现有的 'Sony Creative Looks' 预设组")
        else:
            current_presets.extend(new_items)
            print("   ✓ 已追加 'Sony Creative Looks' 预设组至 RapidRAW 预设库")

        with open(target_presets_json, "w", encoding="utf-8") as f:
            json.dump(current_presets, f, ensure_ascii=False, indent=2)
            
        print("   ➜ 预设安装完成！打开 RapidRAW 即可在预设面板看到 'Sony Creative Looks' 分组。")

    print("\n🎉 安装全部完成！请重启 RapidRAW 即可体验索尼原厂 FL2 / FL3 / IN / SH 等全套色彩！")
    print("=" * 60)

if __name__ == "__main__":
    install()
