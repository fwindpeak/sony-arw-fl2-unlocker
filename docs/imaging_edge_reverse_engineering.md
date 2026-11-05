# Sony Imaging Edge (Edit.app) 逆向工程与创意外观渲染管线深度分析

> 本文档通过对 macOS 平台 `/Applications/Imaging Edge/Edit.app` 二进制可执行文件（Mach-O arm64/x86_64）进行静态逆向工程、符号分析、虚表解析与汇编反汇编，完整揭示索尼官方 RAW 解码与创意外观（Creative Look）渲染管线的底层机理。

---

## 1. 软件架构体系概览

`Edit.app` 的底层实现采用高度模块化的 C++ 引擎，主要由两大核心子系统构成：

```mermaid
flowchart TD
    subgraph UI_Orchestration [sony_granada 框架 (GUI 与文档管理)]
        DC[DevColorModeViewController] --> GD[GfDocument]
        GD --> DCtrl[IGfDocumentControl]
        DCtrl --> Param[GfDevelopmentParameter]
    end

    subgraph Core_Engine [sony_zhacai 榨菜引擎 (RAW 调色与图像处理)]
        Parser[TIFFParser / ARWParser] --> Crypt[sony_sr2_crypt 解密]
        LLVC[sony_llvc3_dec 3代小波解码] --> TileDev[TileDevForARWFull 瓦片渲染管线]
        TileDev --> Preproc[ZcTaskPreprocess 黑电平归一化]
        Preproc --> Demosaic[ZcTaskDemosaicTrinity 拜耳插值]
        Demosaic --> WB[ZcWhiteBalanceFactory 白平衡增益]
        WB --> LinearMat[ZcTaskLinearMatrix 色彩校正矩阵]
        LinearMat --> ArgusLut[ZcCameraLutMakerArgus / ZcTask3DLut 3D-LUT]
        ArgusLut --> ToneCurve[ZcTaskToneCurve 对数调色曲线]
        ToneCurve --> ColorSpace[sony_granada::ColorSpace 色彩空间输出]
    end

    UI_Orchestration --> Core_Engine
```

### 1.1 `sony_granada`（格拉纳达框架）
- **定位**：负责文档生命周期、调色面板交互（Development Panes）、参数事务（`ZcTransactionManager`）以及多版本渲染调度。
- **关键类**：
  - `DevColorModeViewController`：创意外观（Creative Look / Creative Style）UI 控制器。
  - `GfDocument`：RAW 图像文档控制器，处理色彩模式变更（`ModifyColorMode`）、色调曲线变更（`ModifyToneCurve`）。
  - `IGfDocumentControl`：抽象文档渲染控制接口。

### 1.2 `sony_zhacai`（榨菜引擎 —— 索尼内部核心 RAW 图像处理系统）
- **定位**：索尼全套影像处理核心算法库（内部代号 `zhacai`），包含从 ARW 拜耳 RAW 解码、白平衡、色彩校正矩阵（CCM）、3D-LUT 生成到色调映射的完整算法。
- **关键组件**：
  - `sony_llvc3_dec`：索尼第 3 代无损压缩 RAW（ARW 4.0/5.0 Lossless Compressed）离散小波变换（DWT）解码器。
  - `TileDevForARWFull`：全尺寸 RAW 瓦片渲染编排器。
  - `ZcCameraLutMakerArgus`：内部代号 **Argus**，创意外观 3D-LUT 硬件加速渲染器生成器。
  - `ZcTaskLinearMatrix` / `ZcTaskSIMDLinearMatrix16`：3x3 线性色彩校正矩阵变换任务。
  - `ZcTaskToneCurve`：128 点样条非线性色调映射任务（在 $\log_2$ 曝光空间中计算）。
  - `ZcTask3DLut`：基于 ITP / YCbCr 色彩空间的 3D 网格插值渲染任务。

---

## 2. ARW 文件结构与 SR2SubIFD 加密机制

### 2.1 TIFF 树与 SR2SubIFD 定位
索尼 ARW 基于标准 TIFF 规范。相机的真实色彩参数与所有机内创意外观并不硬编码在桌面软件中，而是由机身 **BIONZ XR 芯片** 动态写入 ARW 文件的 `SR2SubIFD` 结构：

1. **IFD0** 包含常规拍摄 EXIF 与指向 RAW 数据的 `SubIFD 0`（Tag `0x014a`）。
2. 在 `0x100` 至 `0x40000` 偏移范围内扫描定位：
   - Tag `0x7200`（`SR2SubIFDOffset`）：SR2SubIFD 密文在文件中的绝对偏移量。
   - Tag `0x7201`（`SR2SubIFDLength`）：SR2SubIFD 密文长度（通常约 35KB ~ 42KB）。
   - Tag `0x7202`（`SR2SubIFDKey`）：对称伪随机数发生器密钥，固定为 `0x44332211`。

### 2.2 索尼 SR2 对称流密码加解密算法
`Edit.app` 中的 `TIFFSourceAccessorDecrypted` 采用以下 128 字循环移位 PRNG 进行异或流解密：

```c
void sony_sr2_crypt(uint32_t *data, size_t word_count, uint32_t key) {
    uint32_t pad[128];
    uint32_t curr = key;
    
    // 初始化前 4 个种子字
    for (int i = 0; i < 4; i++) {
        uint32_t lo = (curr & 0xffff) * 0x0edd + 1;
        uint32_t hi = ((curr >> 16) * 0x0edd + (curr & 0xffff) * 0x02e9 + (lo >> 16)) & 0xffffffff;
        curr = ((hi & 0xffff) << 16) | (lo & 0xffff);
        pad[i] = curr;
    }
    pad[3] = ((pad[3] << 1) | ((pad[0] ^ pad[2]) >> 31)) & 0xffffffff;

    // 线性反馈移位展开至 128 个状态字
    for (int i = 4; i < 0x7f; i++) {
        pad[i] = (((pad[i-4] ^ pad[i-2]) << 1) | ((pad[i-3] ^ pad[i-1]) >> 31)) & 0xffffffff;
    }

    // 流式异或解密
    int pad_i = 0x7f;
    for (size_t j = 0; j < word_count; j++) {
        pad[pad_i & 0x7f] = pad[(pad_i + 1) & 0x7f] ^ pad[(pad_i + 65) & 0x7f];
        data[j] ^= pad[pad_i & 0x7f];
        pad_i++;
    }
}
```

---

## 3. Creative Look Profile 数据块结构（3110 字节规范）

解密后的 `SR2SubIFD` 内部包含多个固定长度为 **3110 字节** 的 IFD 槽位（`num_tags == 114`）。每个槽位独立承载一个外观的完整色彩参数：

```
+-------------------------------------------------------------+
| IFD 头 (2 字节): num_tags = 114 (0x0072)                     |
+-------------------------------------------------------------+
| 114 个 IFD Entry (每个 12 字节, 计 1368 字节):              |
|   Offset 0x0002 ~ 0x0559                                    |
+-------------------------------------------------------------+
| 附加数据负载 (Payload, 1740 字节, 紧接在 IFD 列表后):        |
|   Offset 0x055a ~ 0x0c25 (即 1370 ~ 3109 字节)               |
|   包含: 矩阵数组、128点色调曲线采样点、Argus 3D LUT 参数块等  |
+-------------------------------------------------------------+
```

### 3.1 核心色彩标签清单（Tag Map）

| 标签 ID | 类型 | 元素数 | 含义与解析规范 | 汇编读取位置 |
| :---: | :---: | :---: | :--- | :--- |
| **`0x7770`** | ASCII | 16 | **外观名称**（如 `Standard`, `FL2`, `FL3`, `IN`） | UI 下拉菜单匹配 |
| **`0x7800`** | INT16 | 9 | **色彩校正矩阵 (Linear CCM, 3x3)**。基数 1024，每行和恒为 1024（严格中性灰守恒） | `ZcTaskLinearMatrix` (0x1000e94f4) |
| **`0x7805`** | UINT32| 128 | **色调曲线输入 X 坐标**（非等间距，范围 0 ~ 2097120） | `ZcTaskToneCurve` (0x1000fcb38) |
| **`0x7806`** | UINT32| 128 | **色调曲线输出 Y 坐标**（18-bit 精度，范围 0 ~ 261892） | `ZcTaskToneCurve` (0x1000fcbb0) |
| **`0x7312`** | INT16 | 4 | **拍摄白平衡增益** $(R_{gain}, G_{gain}, G_{gain}, B_{gain})$，基数 1024 | `ZcWhiteBalanceFactory` |
| **`0x7842`** | INT16 | 8 | **Argus 3D LUT 色相/色度多项式基准参数** | `ZcCameraLutMakerArgus` (0x1000d6380) |
| **`0x7844`** | INT16 | 8 | **Argus 饱和度非线性拉伸系数** | `ZcCameraLutMakerArgus` (0x1000bf7ec) |
| **`0x7845`** | INT16 | 8 | **Argus 阴影/高光过渡加权系数** | `ZcCameraLutMakerArgus` (0x1000bf7ec) |
| **`0x780f`** | BYTE | 276 | **机内 3D 色彩扭曲控制表**（Chroma Shaping Table） | `ZcTask3DLut` |
| **`0x7870`** | UINT16| 1 | **高光 Knee 点阈值** | `ZcTaskToneCurve` 膝点压缩 |
| **`0x787a`** | UINT16| 1 | **最大高光截断值** | `ZcTaskMainGamma` |

---

## 4. 关键函数反汇编与色彩管线执行细节

### 4.1 切换创意外观时的参数分发
在 `DevColorModeViewController` 中，用户在下拉框切换外观时触发：

```arm64
// Edit.app::DevColorModeViewController::receiveButtonPopUpColorMode: (0x1000131fc)
0x1000133e8: ldr  x0, [sp, #0x20]      // 获取 GfDocument 实例
0x1000133ec: mov  x1, x21              // 选中的 Look ID (例如 FL2=0x16, FL3=0x17)
0x1000133f0: bl   0x10004d9cc          // 调用 GfDocument::ModifyColorMode
0x10001340c: bl   0x100227680          // 触发渲染刷新
```

在 `GfDocument::ModifyColorMode` (0x10004d9cc) 中：
```arm64
0x10004daa8: mov  w8, #0x13            // 参数类型 ID 0x13 = ColorMode
0x10004daac: orr  w8, w8, w20, lsl #16 // 载入新外观枚举
0x10004dae4: bl   0x10004c3c8          // 推送更新至 ZcTransactionManager
```

### 4.2 3x3 线性色彩校正矩阵变换（`ZcTaskLinearMatrix`）
位于 `0x1000e9430`，反汇编提取出的核心像素处理内联循环：

```arm64
// 加载 Tag 0x7800 的 9 个 int16 元素并转为 float
0x1000e94f4: ldr    h0, [x13, #0x18a4] // M00
0x1000e94f8: sshll  v0, v0, #0
0x1000e94fc: scvtf  s0, s0             // s0 = float(M00)
...
0x1000e9594: fmov   d26, #0.125        // 缩放比例因子
0x1000e95a8: fmov   d29, #8.0          // 8.0 * 1/1024 = 1/128
```

其等价数学公式为：
$$\begin{bmatrix} R_{out} \\ G_{out} \\ B_{out} \end{bmatrix} = \frac{1}{1024} \begin{bmatrix} M_{00} & M_{01} & M_{02} \\ M_{10} & M_{11} & M_{12} \\ M_{20} & M_{21} & M_{22} \end{bmatrix} \begin{bmatrix} R_{in} \\ G_{in} \\ B_{in} \end{bmatrix}$$

### 4.3 3D-LUT 构造与插值（`ZcCameraLutMakerArgus`）
位于 `0x1000d6390` 与 `0x1000bf810`：
- `mov w1, #0x21; mov w2, #0x21; mov w3, #0x21`：生成 $33 \times 33 \times 33$ 的 3D 网格查找表。
- 采用 **YCbCr / ITP** 空间进行非线性插值，内嵌 ITU-R BT.601 / 709 转换常数：
  - `1.401988`（Cr 到 R 放大系数）
  - `1.771978`（Cb 到 B 放大系数）
  - `0.0009765625`（$1/1024$ 归一化）

### 4.4 对数空间非线性色调映射（`ZcTaskToneCurve`）
位于 `0x1000fcadc`：
- 索尼色调曲线在输入阶段执行 `_log2f`，即转入 $\text{EV}$ 对数域：
  $$EV = \log_2(I_{linear} \times \text{gain} + \epsilon)$$
- 在对数域中通过样条插值（Cubic Spline）穿过由 Tag `0x7805` 与 `0x7806` 定义的 128 个控制点，有效防止高光过曝产生色相偏移（Hue Skew），使肤色与胶片高光呈现自然的平滑衰减。

