# Sony ARW 逆向与机型伪装工具库 (Sony ARW Camouflage & Reverse Engineering)

本项目旨在通过逆向分析索尼 **Imaging Edge Desktop (IED)** 工具（`/Applications/Imaging Edge/Edit.app`）对索尼 **ARW (RAW)** 文件的元数据解析与机型支持逻辑，将 **A7C II (ILCE-7CM2)** 等机型拍摄的 ARW 照片伪装为支持新一代创意外观（Creative Look）的机型（如 **A7M5 / ILCE-7M5** 或 **A1M2 / ILCE-1M2**），从而在官方 Edit 工具中成功解锁并套用 **FL2 (Film 2 / 胶片2)** 与 **FL3 (Film 3)** 等全新胶片滤镜。

---

## 目录
1. [逆向工具链安装与配置](#1-逆向工具链安装与配置)
2. [索尼 ARW 文件格式与元数据机理](#2-索尼-arw-文件格式与元数据机理)
3. [Sony Imaging Edge Edit.app 逆向分析](#3-sony-imaging-edge-editapp-逆向分析)
4. [机型伪装操作指南 (A7C2 ➔ A7M5)](#4-机型伪装操作指南-a7c2--a7m5)
5. [在 Edit.app 中套用 FL2 滤镜流程](#5-在-editapp-中套用-fl2-滤镜流程)
6. [工具脚本使用参考](#6-工具脚本使用参考)

---

## 1. 逆向工具链安装与配置

### 1.1 REA (Reverse Engineer Anything)
[REA (morluto/rea)](https://github.com/morluto/rea) 是一套多语言、跨平台的二进制与应用逆向分析工具链与 MCP 服务端，专为深入逆向分析原生 Mach-O 二进制文件、Electron、JavaScript 等应用而设计。

- **全局 CLI 安装**（已完成）：
  ```bash
  npm install -g rea-agents
  rea --version
  ```
- **核心功能**：
  - `rea inspect-macho <path>`：分析 macOS Mach-O 可执行文件的头结构、Load Commands 与段布局。
  - `rea search <query>`：搜索已反编译与符号数据库中的关键字符串或流程。
  - `rea trace-native-values` / `observe-native-calls`：动态追踪原生调用与参数流向。
  - 支持联动 Hopper、Ghidra、LLDB 等外部反编译与调试引擎。

### 1.2 ExifTool (底层元数据读写器)
Sony ARW 遵循 TIFF/EP 规范，元数据使用 EXIF 与 Sony 私有 MakerNotes 存储。
- **安装**（已完成）：
  ```bash
  brew install exiftool
  ```

---

## 2. 索尼 ARW 文件格式与元数据机理

索尼 ARW (Sony Alpha Raw) 结构本质为标准的 TIFF 容器，包含以下核心数据块：

```
+-------------------------------------------------------------+
| TIFF Header (II / 0x4949 Little-Endian, 0x002A)             |
+-------------------------------------------------------------+
| IFD0 (主图像目录 / 元数据)                                  |
|  - Tag 0x010F (Make)         : "SONY"                       |
|  - Tag 0x0110 (Model)        : "ILCE-7CM2"  <-- [待伪装字段]  |
|  - Tag 0x0131 (Software)     : "ILCE-7CM2 v1.00"            |
|  - Tag 0x8769 (ExifIFDPointer)                              |
+-------------------------------------------------------------+
| ExifIFD & SubIFDs (缩略图、预览图、Raw 压缩数据流)          |
+-------------------------------------------------------------+
| Sony MakerNotes (索尼私有厂商标签 0x927C)                   |
|  - Tag 0xb028 / Tag9050 (SonyModelID) : 对应相机内部型号 ID  |
|  - Tag 0xb023 (CreativeStyle / CreativeLook) : 创意外观设置 |
+-------------------------------------------------------------+
```

### 关键伪装参数对照表：

| 机型名称 | 官方型号代码 (Model) | 创意外观 (Creative Look) 支持特性 |
| :--- | :--- | :--- |
| **A7C II** | `ILCE-7CM2` | ST, PT, NT, VV, VV2, FL, IN, SH, BW, SE |
| **A7 IV** | `ILCE-7M4` | ST, PT, NT, VV, VV2, FL, IN, SH, BW, SE |
| **A7 V (A7M5)** | `ILCE-7M5` | **解锁 FL2 (Film 2), FL3 (Film 3)** + 全套创意外观 |
| **A1 II** | `ILCE-1M2` | **解锁 FL2 (Film 2), FL3 (Film 3)** + 全套创意外观 |

> **关键发现**：Sony Imaging Edge 的 Edit 工具在读取 ARW 时，会校验 TIFF IFD0 中的 `Model` 标签和 MakerNotes 中的 `SonyModelID`。若识别为支持新 Look 的机型，UI 调色面板的 “创意外观 / Creative Look” 下拉菜单中就会自动激活 **FL2 (Film 2)** 选项。

---

## 3. Sony Imaging Edge Edit.app 逆向分析

### 3.1 二进制位置与特征
- **主程序路径**：`/Applications/Imaging Edge/Edit.app/Contents/MacOS/Edit`
- **架构**：Universal Binary (`x86_64` + `arm64`)

### 3.2 逆向发现与特征字符串
使用字符串检索可直接在 Edit 核心二进制中定位到 FL2/FL3 相关符号定义：
```text
SE (Sepia)
FL (Film)
VV2 (Vivid 2)
IN (Instant)
SH (Soft Highkey)
FL2 (Film 2)       <--- 已内置支持 FL2 滤镜算法
FL3 (Film 3)       <--- 已内置支持 FL3 滤镜算法
```

这证明 Edit.app 的 RAW 处理渲染管线中**已经完整内建了 FL2 渲染管线**，限制旧机型使用的是前置的**机型元数据白名单**机制。

---

## 4. 机型伪装操作指南 (A7C2 ➔ A7M5)

本项目提供一键伪装脚本 [`camouf_arw.py`](file:///Users/kai/code/myprj/re-arw/camouf_arw.py)，不会破坏原始 RAW 图像像素数据，仅安全修改机型元数据头。

### 4.1 检查单张 ARW 元数据
```bash
python3 camouf_arw.py /path/to/DSC01234.ARW --inspect
```

### 4.2 单张照片伪装为 A7M5
```bash
python3 camouf_arw.py /path/to/DSC01234.ARW -t a7m5
```
> 将在同目录下生成 `DSC01234_a7m5.ARW`。

### 4.3 批量伪装整个照片目录
```bash
python3 camouf_arw.py /path/to/raw_folder/ -t a7m5 -o /path/to/output_folder/
```

### 4.4 伪装为 A1M2 (Alpha 1 II)
```bash
python3 camouf_arw.py /path/to/DSC01234.ARW -t a1m2
```

---

## 5. 在 Edit.app 中套用 FL2 滤镜流程

1. **打开索尼官方工具**：
   运行 `/Applications/Imaging Edge/Edit.app`。
2. **导入伪装后的 ARW 文件**：
   将生成的 `*_a7m5.ARW` 文件拖入 Edit.app 窗口或通过菜单“文件 ➔ 打开”载入。
3. **选择创意外观 (Creative Look)**：
   - 在右侧编辑面板中展开 **“创意外观 / Creative Look”** 下拉菜单。
   - 选择 **`FL2 (Film 2)`** 或 **`FL3 (Film 3)`**。
4. **微调胶片参数**：
   - 对比度 (Contrast)
   - 高光 / 阴影 (Highlights / Shadows)
   - 褪色感 (Fade)
   - 饱和度与清晰度 (Saturation & Clarity)
5. **导出高质量 JPG / TIFF**：
   点击导出，即可获得基于 Sony 原厂算法渲染的 FL2 胶片质感成片。

---

## 6. 工具脚本使用参考

[`camouf_arw.py`](file:///Users/kai/code/myprj/re-arw/camouf_arw.py) 参数说明：

```bash
usage: camouf_arw.py [-h] [-o OUTPUT] [-t {a7m5,a1m2,a9m3,a7rm5,a7c2}] [-i] input

索尼 ARW 照片机型伪装工具 (Sony ARW Camouflage for Imaging Edge Edit)

positional arguments:
  input                 输入的 ARW 文件或包含 ARW 文件的目录

options:
  -h, --help            显示帮助信息
  -o, --output OUTPUT   输出文件或输出目录 (默认在原文件名后加 _spoofed.ARW)
  -t, --target TARGET   目标伪装机型 (可选: a7m5, a1m2, a9m3, a7rm5, a7c2, 默认: a7m5)
  -i, --inspect         仅查看文件元数据信息
```

---

## 7. 进阶逆向调试 (可选)

如果你需要对 Edit.app 的内部渲染逻辑进一步调试或 Hook：
- 使用 REA 工具检查段与符号：
  ```bash
  rea inspect-macho "/Applications/Imaging Edge/Edit.app/Contents/MacOS/Edit"
  ```
- 动态断点观察机型加载判定（基于 LLDB）：
  ```bash
  lldb "/Applications/Imaging Edge/Edit.app/Contents/MacOS/Edit"
  ```
