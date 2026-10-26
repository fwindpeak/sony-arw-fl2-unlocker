#!/usr/bin/env python3
"""
Sony Creative Looks for RapidRAW - Preset & LUT Generator
=========================================================
基于索尼 BIONZ XR 原厂创意外观调色管线与 751K/sony-a7m5-looks 逆向工程成果，
为开源 RAW 编辑器 RapidRAW 生成：
1. 12 款可以直接导入 RapidRAW 的高保真 3D-LUT (.cube)
2. RapidRAW 原生预设文件 (rapidraw_sony_creative_looks.json)
3. RapidRAW 预设与 LUT 一键安装器 (install_to_rapidraw.py)
"""

import os
import sys
import json
import uuid
import math
import struct
import shutil
import colorsys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PRESETS_DIR = HERE / "presets"
LUTS_DIR = HERE / "luts"
OUTPUT_DIR = HERE / "rapidraw"
OUTPUT_LUTS = OUTPUT_DIR / "luts"
OUTPUT_PRESET_FILE = OUTPUT_DIR / "rapidraw_sony_creative_looks.json"

# 12 款官方创意外观规格定义
LOOK_DEFS = [
    {
        "id": "FL2",
        "name": "Sony FL2 (Film 2 怀旧复古胶片)",
        "short": "FL2",
        "desc": "高反差、浓郁胶片质感、暗部沉稳内敛、暖调怀旧，最受欢迎的索尼新一代胶片色",
        "lut_file": "Sony_Look_FL2.cube",
        "src_lut": "Sony_FL2.cube",
        "tone_curve": [
            {"x": 0, "y": 8},
            {"x": 58, "y": 48},
            {"x": 128, "y": 124},
            {"x": 195, "y": 198},
            {"x": 255, "y": 250}
        ],
        "contrast": 8,
        "highlights": -8,
        "shadows": 6,
        "whites": -4,
        "blacks": -2,
        "clarity": 3,
        "color_grading": {
            "shadows": {"hue": 195, "saturation": 6, "luminance": 0},
            "highlights": {"hue": 42, "saturation": 10, "luminance": 0},
            "midtones": {"hue": 38, "saturation": 5, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": -5,
            "blending": 55
        }
    },
    {
        "id": "FL3",
        "name": "Sony FL3 (Film 3 清透电影胶片)",
        "short": "FL3",
        "desc": "柔和低反差、亮部通透清爽、日系空气感、柔美电影感写真",
        "lut_file": "Sony_Look_FL3.cube",
        "src_lut": "Sony_FL3.cube",
        "tone_curve": [
            {"x": 0, "y": 6},
            {"x": 64, "y": 68},
            {"x": 128, "y": 132},
            {"x": 192, "y": 194},
            {"x": 255, "y": 248}
        ],
        "contrast": -10,
        "highlights": -12,
        "shadows": 14,
        "whites": -5,
        "blacks": 6,
        "clarity": -4,
        "color_grading": {
            "shadows": {"hue": 200, "saturation": 4, "luminance": 0},
            "highlights": {"hue": 48, "saturation": 8, "luminance": 0},
            "midtones": {"hue": 40, "saturation": 4, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": 0,
            "blending": 50
        }
    },
    {
        "id": "FL",
        "name": "Sony FL (Film 1 经典胶片)",
        "short": "FL",
        "desc": "蓝绿色调、暗部微提、情绪氛围感、经典冷暖对比",
        "lut_file": "Sony_Look_FL.cube",
        "src_lut": "Sony_FL.cube",
        "tone_curve": [
            {"x": 0, "y": 10},
            {"x": 62, "y": 56},
            {"x": 128, "y": 126},
            {"x": 196, "y": 198},
            {"x": 255, "y": 252}
        ],
        "contrast": 5,
        "highlights": -6,
        "shadows": 8,
        "whites": -3,
        "blacks": 2,
        "clarity": 0,
        "color_grading": {
            "shadows": {"hue": 185, "saturation": 12, "luminance": 0},
            "highlights": {"hue": 38, "saturation": 10, "luminance": 0},
            "midtones": {"hue": 35, "saturation": 6, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": -8,
            "blending": 60
        }
    },
    {
        "id": "IN",
        "name": "Sony IN (Instant 拍立得/即时)",
        "short": "IN",
        "desc": "哑光质感、低对比度、复古日系感、暗部明显褪色",
        "lut_file": "Sony_Look_IN.cube",
        "src_lut": "Sony_IN.cube",
        "tone_curve": [
            {"x": 0, "y": 18},
            {"x": 60, "y": 66},
            {"x": 128, "y": 128},
            {"x": 196, "y": 192},
            {"x": 255, "y": 242}
        ],
        "contrast": -14,
        "highlights": -10,
        "shadows": 16,
        "whites": -10,
        "blacks": 12,
        "clarity": -6,
        "color_grading": {
            "shadows": {"hue": 190, "saturation": 5, "luminance": 0},
            "highlights": {"hue": 45, "saturation": 6, "luminance": 0},
            "midtones": {"hue": 40, "saturation": 3, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": 0,
            "blending": 50
        }
    },
    {
        "id": "SH",
        "name": "Sony SH (Soft Highkey 柔和高调)",
        "short": "SH",
        "desc": "明亮柔和、轻盈透光、高光柔化、空气感写真",
        "lut_file": "Sony_Look_SH.cube",
        "src_lut": "Sony_SH.cube",
        "tone_curve": [
            {"x": 0, "y": 4},
            {"x": 64, "y": 76},
            {"x": 128, "y": 146},
            {"x": 192, "y": 210},
            {"x": 255, "y": 255}
        ],
        "contrast": -8,
        "highlights": -6,
        "shadows": 12,
        "whites": 6,
        "blacks": 4,
        "clarity": -8,
        "color_grading": {
            "shadows": {"hue": 0, "saturation": 0, "luminance": 0},
            "highlights": {"hue": 55, "saturation": 4, "luminance": 0},
            "midtones": {"hue": 45, "saturation": 3, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": 5,
            "blending": 50
        }
    },
    {
        "id": "VV2",
        "name": "Sony VV2 (Vivid 2 生动2)",
        "short": "VV2",
        "desc": "极清透亮、鲜艳度与微反差明显、通透纯净晴空与花卉",
        "lut_file": "Sony_Look_VV2.cube",
        "src_lut": "Sony_VV2.cube",
        "tone_curve": [
            {"x": 0, "y": 0},
            {"x": 60, "y": 54},
            {"x": 128, "y": 128},
            {"x": 196, "y": 204},
            {"x": 255, "y": 255}
        ],
        "contrast": 12,
        "highlights": 4,
        "shadows": -4,
        "whites": 6,
        "blacks": -4,
        "clarity": 8,
        "color_grading": {
            "shadows": {"hue": 220, "saturation": 5, "luminance": 0},
            "highlights": {"hue": 40, "saturation": 6, "luminance": 0},
            "midtones": {"hue": 0, "saturation": 0, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": 0,
            "blending": 50
        }
    },
    {
        "id": "VV",
        "name": "Sony VV (Vivid 生动)",
        "short": "VV",
        "desc": "鲜艳明朗、高饱和度、高对比度、风光与绚丽落日",
        "lut_file": "Sony_Look_VV.cube",
        "src_lut": "Sony_VIVID.cube",
        "tone_curve": [
            {"x": 0, "y": 0},
            {"x": 64, "y": 58},
            {"x": 128, "y": 130},
            {"x": 192, "y": 202},
            {"x": 255, "y": 255}
        ],
        "contrast": 10,
        "highlights": 2,
        "shadows": -6,
        "whites": 4,
        "blacks": -4,
        "clarity": 5,
        "color_grading": {
            "shadows": {"hue": 0, "saturation": 0, "luminance": 0},
            "highlights": {"hue": 35, "saturation": 8, "luminance": 0},
            "midtones": {"hue": 0, "saturation": 0, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": 0,
            "blending": 50
        }
    },
    {
        "id": "PT",
        "name": "Sony PT (Portrait 人像)",
        "short": "PT",
        "desc": "优化亚洲人肤色、柔和粉嫩、平滑肤质、适度降低阴影反差",
        "lut_file": "Sony_Look_PT.cube",
        "src_lut": "Sony_PORTRAIT.cube",
        "tone_curve": [
            {"x": 0, "y": 0},
            {"x": 64, "y": 66},
            {"x": 128, "y": 132},
            {"x": 192, "y": 196},
            {"x": 255, "y": 254}
        ],
        "contrast": -6,
        "highlights": -8,
        "shadows": 10,
        "whites": -2,
        "blacks": 2,
        "clarity": -4,
        "color_grading": {
            "shadows": {"hue": 0, "saturation": 0, "luminance": 0},
            "highlights": {"hue": 30, "saturation": 5, "luminance": 0},
            "midtones": {"hue": 25, "saturation": 4, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": 2,
            "blending": 50
        }
    },
    {
        "id": "NT",
        "name": "Sony NT (Neutral 中性)",
        "short": "NT",
        "desc": "低反差、低饱和、真实自然、保留最大宽容度供精细调色",
        "lut_file": "Sony_Look_NT.cube",
        "src_lut": "Sony_NEUTRAL.cube",
        "tone_curve": [
            {"x": 0, "y": 0},
            {"x": 64, "y": 64},
            {"x": 128, "y": 128},
            {"x": 192, "y": 192},
            {"x": 255, "y": 255}
        ],
        "contrast": -8,
        "highlights": 0,
        "shadows": 4,
        "whites": 0,
        "blacks": 0,
        "clarity": 0,
        "color_grading": {
            "shadows": {"hue": 0, "saturation": 0, "luminance": 0},
            "highlights": {"hue": 0, "saturation": 0, "luminance": 0},
            "midtones": {"hue": 0, "saturation": 0, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": 0,
            "blending": 50
        }
    },
    {
        "id": "ST",
        "name": "Sony ST (Standard 标准)",
        "short": "ST",
        "desc": "索尼官方基准色彩、自然真实还原、通用记录",
        "lut_file": "Sony_Look_ST.cube",
        "src_lut": "Sony_STANDARD.cube",
        "tone_curve": [
            {"x": 0, "y": 0},
            {"x": 64, "y": 64},
            {"x": 128, "y": 128},
            {"x": 192, "y": 192},
            {"x": 255, "y": 255}
        ],
        "contrast": 0,
        "highlights": 0,
        "shadows": 0,
        "whites": 0,
        "blacks": 0,
        "clarity": 0,
        "color_grading": {
            "shadows": {"hue": 0, "saturation": 0, "luminance": 0},
            "highlights": {"hue": 0, "saturation": 0, "luminance": 0},
            "midtones": {"hue": 0, "saturation": 0, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": 0,
            "blending": 50
        }
    },
    {
        "id": "BW",
        "name": "Sony BW (Monochrome 黑白单色)",
        "short": "BW",
        "desc": "经典原厂黑白、高纯度单色层次、影调醇厚",
        "lut_file": "Sony_Look_BW.cube",
        "src_lut": "Sony_BW.cube",
        "tone_curve": [
            {"x": 0, "y": 0},
            {"x": 64, "y": 58},
            {"x": 128, "y": 128},
            {"x": 192, "y": 200},
            {"x": 255, "y": 255}
        ],
        "contrast": 10,
        "highlights": 0,
        "shadows": 0,
        "whites": 5,
        "blacks": -5,
        "clarity": 10,
        "color_grading": {
            "shadows": {"hue": 0, "saturation": 0, "luminance": 0},
            "highlights": {"hue": 0, "saturation": 0, "luminance": 0},
            "midtones": {"hue": 0, "saturation": 0, "luminance": 0},
            "global": {"hue": 0, "saturation": 0, "luminance": 0},
            "balance": 0,
            "blending": 50
        }
    },
    {
        "id": "SE",
        "name": "Sony SE (Sepia 怀旧褐色)",
        "short": "SE",
        "desc": "温暖复古怀旧棕褐调、典雅历史感",
        "lut_file": "Sony_Look_SE.cube",
        "src_lut": "Sony_SEPIA.cube",
        "tone_curve": [
            {"x": 0, "y": 4},
            {"x": 64, "y": 62},
            {"x": 128, "y": 128},
            {"x": 192, "y": 196},
            {"x": 255, "y": 250}
        ],
        "contrast": 5,
        "highlights": -4,
        "shadows": 6,
        "whites": -2,
        "blacks": 2,
        "clarity": 2,
        "color_grading": {
            "shadows": {"hue": 35, "saturation": 20, "luminance": 0},
            "highlights": {"hue": 40, "saturation": 16, "luminance": 0},
            "midtones": {"hue": 38, "saturation": 18, "luminance": 0},
            "global": {"hue": 38, "saturation": 15, "luminance": 0},
            "balance": 0,
            "blending": 55
        }
    }
]


def load_base_adjustments():
    """RapidRAW 基础 adjustments 模版"""
    return {
        "blacks": 0,
        "brightness": 0,
        "centré": 0,
        "centréX": 0.5,
        "centréY": 0.5,
        "clarity": 0,
        "chromaticAberrationBlueYellow": 0,
        "chromaticAberrationRedCyan": 0,
        "colorCalibration": {
            "shadowsTint": 0,
            "redHue": 0,
            "redSaturation": 0,
            "greenHue": 0,
            "greenSaturation": 0,
            "blueHue": 0,
            "blueSaturation": 0
        },
        "colorGrading": {
            "balance": 0,
            "blending": 50,
            "global": {"hue": 0, "luminance": 0, "saturation": 0},
            "highlights": {"hue": 0, "luminance": 0, "saturation": 0},
            "midtones": {"hue": 0, "luminance": 0, "saturation": 0},
            "shadows": {"hue": 0, "luminance": 0, "saturation": 0}
        },
        "colorNoiseReduction": 0,
        "contrast": 0,
        "curveMode": "point",
        "curves": {
            "blue": [{"x": 0, "y": 0}, {"x": 255, "y": 255}],
            "green": [{"x": 0, "y": 0}, {"x": 255, "y": 255}],
            "luma": [{"x": 0, "y": 0}, {"x": 255, "y": 255}],
            "red": [{"x": 0, "y": 0}, {"x": 255, "y": 255}]
        },
        "pointCurves": {
            "blue": [{"x": 0, "y": 0}, {"x": 255, "y": 255}],
            "green": [{"x": 0, "y": 0}, {"x": 255, "y": 255}],
            "luma": [{"x": 0, "y": 0}, {"x": 255, "y": 255}],
            "red": [{"x": 0, "y": 0}, {"x": 255, "y": 255}]
        },
        "dehaze": 0,
        "exposure": 0,
        "grainAmount": 0,
        "grainRoughness": 50,
        "grainSize": 25,
        "highlights": 0,
        "hsl": {
            "aquas": {"hue": 0, "luminance": 0, "saturation": 0},
            "blues": {"hue": 0, "luminance": 0, "saturation": 0},
            "greens": {"hue": 0, "luminance": 0, "saturation": 0},
            "magentas": {"hue": 0, "luminance": 0, "saturation": 0},
            "oranges": {"hue": 0, "luminance": 0, "saturation": 0},
            "purples": {"hue": 0, "luminance": 0, "saturation": 0},
            "reds": {"hue": 0, "luminance": 0, "saturation": 0},
            "yellows": {"hue": 0, "luminance": 0, "saturation": 0}
        },
        "lumaNoiseReduction": 0,
        "lutData": None,
        "lutIntensity": 100,
        "lutIsSceneReferred": False,
        "lutName": None,
        "lutPath": None,
        "lutSize": 33,
        "saturation": 0,
        "shadows": 0,
        "sharpenDetail": 25,
        "sharpenMasking": 0,
        "sharpenRadius": 1.0,
        "sharpness": 20,
        "structure": 0,
        "temperature": 0,
        "tint": 0,
        "toneMapper": "basic",
        "vibrance": 0,
        "vignetteAmount": 0,
        "whites": 0
    }


def prepare_luts():
    """优化并输出可以直接放入 RapidRAW 的 3D-LUT 文件"""
    OUTPUT_LUTS.mkdir(parents=True, exist_ok=True)
    print(f"📦 正在导出 RapidRAW 3D-LUT 到: {OUTPUT_LUTS} ...")

    for item in LOOK_DEFS:
        src = LUTS_DIR / item["src_lut"]
        dst = OUTPUT_LUTS / item["lut_file"]
        if src.exists():
            # 规范化 cube 文件头部
            with open(src, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            
            clean_lines = []
            has_title = False
            for line in lines:
                if line.startswith("TITLE"):
                    clean_lines.append(f'TITLE "{item["name"]}"\n')
                    has_title = True
                else:
                    clean_lines.append(line)
            
            if not has_title:
                clean_lines.insert(0, f'TITLE "{item["name"]}"\n')
            
            with open(dst, "w", encoding="utf-8") as f:
                f.writelines(clean_lines)
            print(f"  ✓ {item['lut_file']} ({item['short']})")
        else:
            print(f"  ⚠ 找不到源 LUT: {src}")


def generate_presets_json():
    """生成 RapidRAW 原生预设包 JSON 文件"""
    folder_id = "folder-" + str(uuid.uuid4())
    children = []

    for item in LOOK_DEFS:
        adj = load_base_adjustments()
        # 填充外观专属参数
        adj["contrast"] = item["contrast"]
        adj["highlights"] = item["highlights"]
        adj["shadows"] = item["shadows"]
        adj["whites"] = item["whites"]
        adj["blacks"] = item["blacks"]
        adj["clarity"] = item["clarity"]
        adj["colorGrading"] = item["color_grading"]
        adj["curves"]["luma"] = item["tone_curve"]
        adj["pointCurves"]["luma"] = item["tone_curve"]
        
        # 绑定对应的 LUT 属性
        adj["lutName"] = item["lut_file"].replace(".cube", "")
        adj["lutPath"] = item["lut_file"]
        adj["lutIntensity"] = 100
        adj["lutIsSceneReferred"] = False
        adj["lutSize"] = 33

        preset_entry = {
            "id": "sony-" + item["short"].lower() + "-" + str(uuid.uuid4())[:8],
            "name": item["name"],
            "adjustments": adj,
            "includeMasks": False,
            "includeCropTransform": False,
            "presetType": "creative"
        }
        children.append(preset_entry)

    # 包装为 RapidRAW 的 PresetFile 结构
    preset_file_content = {
        "presets": [
            {
                "folder": {
                    "id": folder_id,
                    "name": "Sony Creative Looks (索尼全套创意外观)",
                    "children": children
                }
            }
        ]
    }

    with open(OUTPUT_PRESET_FILE, "w", encoding="utf-8") as f:
        json.dump(preset_file_content, f, ensure_ascii=False, indent=2)

    print(f"✨ 已生成 RapidRAW 预设包文件: {OUTPUT_PRESET_FILE}")
    print(f"   包含 {len(children)} 款索尼原厂创意外观预设！")


def generate_installer_script():
    """生成一键安装脚本 install_to_rapidraw.py"""
    installer_code = '''#!/usr/bin/env python3
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
    print("\\n🎨 1. 正在安装 3D-LUT (.cube) 文件到 RapidRAW ...")
    count_lut = 0
    if LUTS_SRC.exists():
        for cube_path in LUTS_SRC.glob("*.cube"):
            dest = luts_dir / cube_path.name
            shutil.copy2(cube_path, dest)
            print(f"   ✓ 已安装 LUT: {cube_path.name}")
            count_lut += 1
    print(f"   ➜ 共成功安装 {count_lut} 个 3D-LUT！可在 RapidRAW 右侧 Effects -> LUT 中直接选用。")

    # 2. 合并或导入 Presets
    print("\\n📑 2. 正在安装创意外观预设到 RapidRAW ...")
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

    print("\\n🎉 安装全部完成！请重启 RapidRAW 即可体验索尼原厂 FL2 / FL3 / IN / SH 等全套色彩！")
    print("=" * 60)

if __name__ == "__main__":
    install()
'''
    installer_path = OUTPUT_DIR / "install_to_rapidraw.py"
    with open(installer_path, "w", encoding="utf-8") as f:
        f.write(installer_code)
    installer_path.chmod(0o755)
    print(f"🛠️ 已生成一键安装脚本: {installer_path}")


def main():
    print("🌟 正在生成 RapidRAW 索尼创意外观完整套件...")
    prepare_luts()
    generate_presets_json()
    generate_installer_script()
    print("\n✅ RapidRAW 创意外观生成完毕！")


if __name__ == "__main__":
    main()
