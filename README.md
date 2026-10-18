<div align="center">

# 🤖 Sony ARW Creative Look Unlocker (Agent Skill)

### 索尼全套新一代胶片创意外观 (FL2/FL3) 真 3D-LUT 提取、移植与全机型解锁工具
**让你的 AI Agent 自动识别、解密并批量为索尼 A7C2 / A7M4 / A7R5 照片注入全部原厂胶片色彩**

[![Agent Skill](https://img.shields.io/badge/Agent%20Skill-Ready-5c4ee5.svg?style=flat-square&logo=openai&logoColor=white)](SKILL.md)
[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Sony ARW Format](https://img.shields.io/badge/Sony%20ARW-5.0%20Lossless-orange.svg?style=flat-square)](https://www.sony.com/)
[![Zero Dependency](https://img.shields.io/badge/dependencies-0%20(Pure%20Python)-brightgreen.svg?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[⚡ 一键安装到 Agent](#-一键安装-agent-skill) • [💎 提取与移植官方 3D-LUT](#-从新相机提取官方真实-3d-lut-并移植) • [💬 Agent 提示词模板](#-agent-自然语言调用) • [🎨 全套创意外观](#-全套创意外观-creative-look-支持) • [💻 命令行使用](#-手动命令行调用) • [🔬 逆向技术原理](#-逆向技术机理)

</div>

---

## 🌟 核心突破：跨代 3D-LUT 提取与无损移植机制

索尼相机在拍摄时，由机身内的 BIONZ XR 影像处理器生成每款外观专属的 **3110 字节 3D-LUT 查找表与色调曲线**，加密写入 RAW 文件的 `SR2SubIFD` 区域。桌面端 `Edit.app` 打开 RAW 时直接从该区域加载 3D-LUT。

**本项目的核心功能**：
1. **真实 3D-LUT 提取 (`extract`)**：只需提供一张搭载原生 FL2 / FL3 的新相机（如 A1 II、A7 V 等）拍摄的 sample.ARW，即可一键解密导出官方 100% 原汁原味的 `fl2_profile.bin` 和 `fl3_profile.bin`；
2. **跨机型精准注入**：将提取出的真实 3D-LUT 注入到 A7C2 / A7M4 / A7R5 的 ARW 中；
3. **官方原生渲染**：Sony Edit.app 读取 A7C2 照片时，将调用真实的官方 FL2/FL3 胶片调色管线！

---

## 💎 从新相机提取官方真实 3D-LUT 并移植

### 步骤 1：提取新机型的 3D-LUT 数据块
获取一张新相机拍摄的 ARW 样本文件（如网络样张或朋友拍摄的样片）：
```bash
python3 scripts/camouf_arw.py extract /path/to/A7M5_sample.ARW -o ./presets/
```
> 输出：在 `./presets/` 目录下生成 `fl2_profile.bin` 和 `fl3_profile.bin`。

### 步骤 2：批量为 A7C2 照片注入官方 3D-LUT
将提取出来的预设直接注入老机型的 ARW 目录：
```bash
python3 scripts/camouf_arw.py /path/to/a7c2_photos/ -o /path/to/output/
```
> 工具会自动识别 `./presets/` 中的官方数据块并精准写入。

---

## ⚡ 一键安装 Agent Skill

本项目全面支持 **Windows**、**macOS** 与 **Linux**。在终端中根据系统选择对应的一键安装方式（自动配置到全局与当前工程的 Agent 目录）：

### 🪟 Windows 系统 (推荐 PowerShell)
在 PowerShell 中运行：
```powershell
.\install-skill.ps1
```
*或双击运行 `install-skill.bat`，或在 CMD 中执行 `python install_skill.py`。*

### 🍎 macOS / 🐧 Linux 系统
在终端中运行：
```bash
chmod +x ./install-skill.sh
./install-skill.sh
```

### 🌐 任意平台通用 Python 安装命令
```bash
python install_skill.py
```

---

## 💬 Agent 自然语言调用示例

```text
🧑 用户 Prompt:
“帮我从 /path/to/sample_a7m5.ARW 中提取官方 FL2 3D-LUT，然后把 ./my_a7c2_photos/ 目录下的照片全部注入并解锁 FL2。”

🤖 Agent 自动行为:
• 自动执行 extract 命令提取真实的 fl2_profile.bin
• 保持 A7C2 传感器标定完全不变，将 FL2 真实 3D-LUT 注入至目标照片
• 输出无损处理后的 RAW 文件
```

---

## 🎨 全套创意外观 (Creative Look) 槽位全景表

| 槽位 | 官方全称 | 色彩与影调特征 | 适用场景 | 状态 |
| :---: | :--- | :--- | :--- | :---: |
| **ST** | **Standard (标准)** | **索尼基准自然色调、色彩还原真实** | 纪实、常规记录 | 原厂保留 |
| **VV** | **Vivid (生动)** | **高对比、高饱和度鲜艳色彩** | 鲜艳风光、日落晚霞 | 原厂保留 |
| **NT** | **Neutral (中性)** | **低饱和、宽容度保留最完整** | 商业后期、深度精修底片 | 原厂保留 |
| **PT** | **Portrait (人像)** | **优化亚洲人肤色、柔和粉嫩** | 人像摄影、婚礼活动 | 原厂保留 |
| **FL** | **Film 1 (经典胶片 1)** | **蓝绿色调、暗部微提、情绪氛围感** | 风光、城市、绿植、阴天场景 | 原厂保留 |
| **VV2** | **Vivid 2 (生动 2)** | **极清透亮、鲜艳度与清晰度增强** | 晴天、花卉、蓝天大海 | 原厂保留 |
| **IN** | **Instant (即时 / 拍立得)** | **哑光质感、低对比度、复古日系感** | 室内随拍、静物、文艺人像 | 原厂保留 |
| **SH** | **Soft Highkey (柔和高调)** | **明亮柔和、轻盈空气感、高光柔化** | 逆光人像、甜美写真、萌宠 | 原厂保留 |
| **FL2** | **Film 2 (怀旧复古胶片 2)** | **高反差、浓郁胶片质感、暗部沉稳内敛、暖调怀旧** | 复古街拍、扫街、情绪人像 | ⚡ **真 3D-LUT 已解锁** |
| **FL3** | **Film 3 (清透电影胶片 3)** | **柔和低反差、亮部通透清爽、柔美空气感** | 电影感写真、日系风光、日系人像 | ⚡ **真 3D-LUT 已解锁** |

---

## 💻 手动命令行调用 (Windows & macOS 通用)

> **提示**：Windows 下运行 `python`，macOS / Linux 下运行 `python3` 或 `python`。

```bash
# 1. 检测与验证 ARW 文件的机型标定与创意外观槽位 (零外部依赖)
python scripts/camouf_arw.py inspect /path/to/photo.ARW

# 2. 单张照片注入解锁 (默认 FL2 为激活外观)
python scripts/camouf_arw.py /path/to/DSC00001.ARW

# 3. 批量处理整个相册目录
python scripts/camouf_arw.py /path/to/my_arw_folder/ -o /path/to/output_folder/

# 4. 从新机型 (如 A1M2 / A7M5) 样张中提取官方原始 3D-LUT 数据块
python scripts/camouf_arw.py extract sample_new_camera.ARW

# 5. 将提取的 .bin 预设转换为通用 .cube 3D-LUT (供 DaVinci / Lightroom / FCP 套用)
python scripts/export_lut_cube.py presets/ -o luts/ --size 33
```

---

## 🎬 通用 3D-LUT (.cube) 跨平台套用

通过 `export_lut_cube.py` 导出的标准 `.cube` 文件（已保存在 `luts/` 目录）可直接在第三方后期软件中使用：

- **DaVinci Resolve (达芬奇)**：将 `luts/*.cube` 文件拷贝至 LUT 目录即可在调色节点直接调用。
- **Adobe Photoshop / Lightroom**：在【颜色查找】或导入为 Camera Raw 增强型配置文件。
- **Final Cut Pro / Premiere Pro**：通过自定义 LUT 插件直接套用原厂电影胶片调色。


---

## 🖥️ 在 Sony Imaging Edge Edit 中调色与批量导出

1. 启动官方软件 **Imaging Edge Desktop ➔ Edit**：
   - **macOS**: `/Applications/Imaging Edge/Edit.app`
   - **Windows**: `C:\Program Files\Sony\Imaging Edge Desktop\Edit.exe` 或从开始菜单启动
2. 将生成的 `*_all_looks.ARW` 照片导入到 Edit 软件中；
3. 在右侧 **“创意外观 (Creative Look)”** 下拉列表中选择 **`FL2 (Film 2)`** 或 **`FL3 (Film 3)`**；
4. 即可直接调用官方真实 FL2/FL3 胶片色彩矩阵进行微调与 16-bit TIFF / JPG 批量导出！

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

*免责声明：本项目为摄影色彩研究与逆向工程探索产物，相关商标与色彩算法版权归索尼公司 (Sony Group Corporation) 所有。*
