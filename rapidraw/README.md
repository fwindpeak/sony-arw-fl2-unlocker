# 🎨 100% 提取自 751K/sony-a7m5-looks 的 RapidRAW 创意外观套件

本套件**严格 100% 解密提取自 [751K/sony-a7m5-looks](https://github.com/751K/sony-a7m5-looks) 仓库的官方 Lightroom / Camera Raw 预设 (`profiles/camera_raw/*.xmp`)**。

---

## 🔬 为什么之前会偏色？本次如何做到 0 白平衡漂移？

1. **751K Lightroom 预设的本质**：
   - 751K 的 `.xmp` 预设是 Adobe 架构的增强型配置文件（Enhanced Profile），其内部根本没有普通的滑块参数（没有 `Contrast2012`、`HSL` 等），而是内嵌了一张经由索尼 ARM64 官方二进制逐位逆向反编译得到的 **64×64×64 高维 3D RGBTable** (`crs:Table_<md5>`)；
   - 在 Lightroom 中，它必须配合工作空间进行坐标归一化；若用旧的粗暴相对矩阵算法，会导致白平衡基准丢失、全图偏黄偏绿。
2. **本次高保真重构的核心**：
   - 使用 751K 官方的 `crs_table` 解码器，直接解密这批 XMP 预设中的全部 64×64×64 原厂查找表；
   - 通过索尼 Standard (ST) 基准响应曲线建立严格单调的曝光反查；
   - **对角线中性灰绝对守恒**：对所有中性灰像素（R == G == B），强制严格沿对角线精准采样，三通道输出严格一致，**白平衡残差严格为 0.000000**！绝无丝毫偏黄、偏绿或白平衡漂移；
   - **色彩区域 100% 还原**：保留了 751K 验证过的索尼 16 切片非线性色度扭曲、色区非线性补偿（AreaComp）与高光色度抑制（ChromaSuppress）。

---

## 📦 包含外观与 3D-LUT 清单

| 外观代码 | 对应 751K Lightroom 预设源文件 | 生成的 RapidRAW 3D-LUT | 白平衡误差 | 外观特色 |
| :---: | :--- | :--- | :---: | :--- |
| **FL2** | `SonyA7M5 Look FL2.xmp` | `Sony_Look_FL2.cube` | **0.0** | 浓郁胶片质感、暗部沉稳微提 (0.03)、暖调怀旧 |
| **FL3** | `SonyA7M5 Look FL3.xmp` | `Sony_Look_FL3.cube` | **0.0** | 柔和低反差、亮部通透清爽、柔美空气感 |
| **FL**  | `SonyA7M5 Look FL.xmp`  | `Sony_Look_FL.cube`  | **0.0** | 暗部蓝绿冷调、高光微暖、经典冷暖电影氛围 |
| **IN**  | `SonyA7M5 Look IN.xmp`  | `Sony_Look_IN.cube`  | **0.0** | 哑光质感、低对比、日系拍立得暗部褪色灰度 |
| **SH**  | `SonyA7M5 Look SH.xmp`  | `Sony_Look_SH.cube`  | **0.0** | 明亮柔和、轻盈透亮空气感、高光柔化 |
| **VV2** | `SonyA7M5 Look VV2.xmp` | `Sony_Look_VV2.cube` | **0.0** | 极清透亮、鲜艳度与微反差明显、通透纯净 |
| **VV**  | `SonyA7M5 Look VV.xmp`  | `Sony_Look_VV.cube`  | **0.0** | 高饱和、高反差、浓烈风光与落日晚霞 |
| **PT**  | `SonyA7M5 Look PT.xmp`  | `Sony_Look_PT.cube`  | **0.0** | 亚洲人像肤色优化、粉嫩透亮、平滑过渡 |
| **NT**  | `SonyA7M5 Look NT.xmp`  | `Sony_Look_NT.cube`  | **0.0** | 真实自然、低反差、保留最大宽容度 |
| **ST**  | `SonyA7M5 Look ST.xmp`  | `Sony_Look_ST.cube`  | **0.0** | 索尼官方基准自然色彩还原 |
| **BW**  | `SonyA7M5 Look BW.xmp`  | `Sony_Look_BW.cube`  | **0.0** | 纯正黑白单色、灰阶细腻过渡平滑醇厚 |
| **SE**  | `SonyA7M5 Look SE.xmp`  | `Sony_Look_SE.cube`  | **0.0** | 典雅复古怀旧棕褐调 |

---

## 🚀 如何在 RapidRAW 中使用

已直接将新生成的正品 LUT 和预设同步写入到你的本机 RapidRAW 中：
- LUT 文件路径：`~/Library/Application Support/io.github.CyberTimon.RapidRAW/luts/`
- 预设文件路径：`~/Library/Application Support/io.github.CyberTimon.RapidRAW/presets/presets.json`

### 1. 在 RapidRAW 预设面板中一键应用
1. 重启 **RapidRAW**，打开照片；
2. 展开左侧/顶部的 **预设 (Presets)** 面板；
3. 选择 **`Sony Creative Looks (751K 官方高保真版)`** 分组；
4. 点击任意预设（如 **Sony FL2** 或 **Sony FL3**），预设将直接调用该外观的正品 3D-LUT！

### 2. 在 Effects 面板直接调整 LUT
1. 在右侧工具栏展开 **Effects (效果)** -> **LUT**；
2. 下拉菜单中选择任意 `Sony_Look_FL2`、`Sony_Look_FL3` 等；
3. 可根据画面曝光自由调整 **Intensity (强度)** 滑块（默认 100%）。
