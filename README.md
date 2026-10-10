<div align="center">

# 🤖 Sony ARW Creative Look Unlocker (Agent Skill)

### 索尼全套新一代胶片创意外观 (FL2/FL3) 解锁与批量处理 AI Agent 技能仓库
**让你的 AI Agent 自动识别、解密并批量为索尼 A7C2 / A7M4 / A7R5 照片注入全部原厂胶片色彩**

[![Agent Skill](https://img.shields.io/badge/Agent%20Skill-Ready-5c4ee5.svg?style=flat-square&logo=openai&logoColor=white)](SKILL.md)
[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Sony ARW Format](https://img.shields.io/badge/Sony%20ARW-5.0%20Lossless-orange.svg?style=flat-square)](https://www.sony.com/)
[![Zero Dependency](https://img.shields.io/badge/dependencies-0%20(Pure%20Python)-brightgreen.svg?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[⚡ 一键安装到 Agent](#-一键安装-agent-skill) • [💬 Agent 提示词模板](#-agent-自然语言调用) • [🎨 全套创意外观](#-全套创意外观-creative-look-支持) • [💻 命令行使用](#-手动命令行调用) • [🔬 逆向技术原理](#-逆向技术机理)

</div>

---

## 🌟 为什么将本项目设计为 Agent Skill？

随着 AI 编程助手（如 **Antigravity、Claude Code、Cursor、Gemini CLI、Codex、OpenAI Swarm** 等）成为摄影后期与开发的核心工具，用户不再需要手动记忆复杂的命令行参数。

本仓库遵循 **AI Agent Skill 标准规范**，将底层的索尼 `SR2SubIFD` 密钥解密、零位移重加密（Zero-Shift Re-encryption）与批量文件处理逻辑封装为一个**即插即用的 Agent Skill**。

安装后，你只需在对话框中告诉 AI：
> *“帮我把这批 A7C2 照片全部解锁 FL2 怀旧胶片和 FL3 电影胶片滤镜”*

Agent 将自动加载本技能、执行安全检查并完成全量无损注入！

---

## ⚡ 一键安装 Agent Skill

### 方法 1：一行命令自动安装（推荐）

在终端中运行一键安装脚本（自动配置到全局与当前工程的 Agent 目录）：

```bash
git clone https://github.com/your-username/sony-arw-fl2-unlocker.git
cd sony-arw-fl2-unlocker
./install-skill.sh
```

### 方法 2：手动放入 Agent 技能目录

将仓库复制到对应 Agent 的技能路径即可：

| Agent 平台 | 目标安装路径 |
| :--- | :--- |
| **Antigravity (全局)** | `~/.gemini/config/skills/sony-arw-fl2-unlocker/` |
| **Antigravity (当前工作区)** | `.agents/skills/sony-arw-fl2-unlocker/` |
| **Claude Code** | `~/.claude/skills/sony-arw-fl2-unlocker/` |
| **Cursor** | `~/.cursor/skills/sony-arw-fl2-unlocker/` |

---

## 💬 Agent 自然语言调用示例

安装本 Skill 后，你可以在任何支持的 AI Agent 界面中直接发送以下 Prompt：

```text
🧑 用户 Prompt 示例 1 (单张处理):
“帮我把 /Users/kai/Pictures/DSC00506.ARW 转换为支持 FL2 和 FL3 的格式，默认预设为 FL2。”

🤖 Agent 自动行为:
• 识别 ARW 文件与 MakerNotes 加密块
• 保持原始传感器 CFA 标定与 RAW 像素切片 100% 不变
• 解密 SR2SubIFD 并原位注入全套创意外观 (FL2/FL3 等)
• 生成 DSC00506_all_looks.ARW 并提示在 Sony Edit.app 中打开
```

```text
🧑 用户 Prompt 示例 2 (相册批量):
“我刚拍了一组人像在 ./trip_photos/ 目录下，都是 A7C2 拍的 ARW，请批量帮我解锁所有胶片滤镜，输出到 ./unlocked/ 文件夹。”

🤖 Agent 自动行为:
• 自动遍历 ./trip_photos/ 下所有 .ARW 文件
• 批量执行原位零损坏修补
• 输出处理报告并在完成后通知你
```

---

## 🎨 全套创意外观 (Creative Look) 支持

经本 Skill 处理后的 RAW 文件导入 **Sony Imaging Edge Edit (`Edit.app`)** 后，右侧创意外观下拉菜单将**同时呈现以下全部外观**：

| 外观代号 | 官方全称 | 色彩与影调特征 | 适用场景 | 状态 |
| :---: | :--- | :--- | :--- | :---: |
| **FL2** | **Film 2 (怀旧复古胶片 2)** | **高反差、浓郁胶片质感、暗部沉稳内敛、暖调怀旧** | 复古街拍、扫街、情绪人像 | ⚡ **新相机特有 · 已解锁** |
| **FL3** | **Film 3 (清透电影胶片 3)** | **柔和低反差、亮部通透清爽、柔美空气感** | 电影感写真、日系风光、日系人像 | ⚡ **新相机特有 · 已解锁** |
| **FL** | **Film 1 (经典胶片 1)** | **蓝绿色调、暗部微提、情绪氛围感** | 风光、城市、绿植、阴天场景 | 原厂标配 |
| **VV2** | **Vivid 2 (生动 2)** | **极清透亮、鲜艳度与清晰度增强** | 晴天、花卉、蓝天大海 | 原厂标配 |
| **IN** | **Instant (即时 / 拍立得)** | **哑光质感、低对比度、复古日系感** | 室内随拍、静物、文艺人像 | 原厂标配 |
| **SH** | **Soft Highkey (柔和高调)** | **明亮柔和、轻盈空气感、高光柔化** | 逆光人像、甜美写真、萌宠 | 原厂标配 |
| **ST** | **Standard (标准)** | **索尼基准自然色调、色彩还原真实** | 纪实、常规记录 | 原厂标配 |
| **PT** | **Portrait (人像)** | **优化亚洲人肤色、柔和粉嫩** | 人像摄影、婚礼活动 | 原厂标配 |
| **NT** | **Neutral (中性)** | **低饱和、宽容度保留最完整** | 商业后期、深度精修底片 | 原厂标配 |
| **VV** | **Vivid (生动)** | **高对比、高饱和度鲜艳色彩** | 鲜艳风光、日落晚霞 | 原厂标配 |

---

## 💻 手动命令行调用

如果你更习惯在终端中直接运行，也可以随时使用底层脚本：

### 单张处理
```bash
python3 scripts/camouf_arw.py /path/to/DSC00001.ARW
```

### 批量处理整个目录
```bash
python3 scripts/camouf_arw.py /path/to/my_arw_folder/ -o /path/to/output_folder/
```

### 进阶参数
```bash
# 伪装机型为 A7M5 并指定默认预设为 FL3
python3 scripts/camouf_arw.py input.ARW -t a7m5 -l fl3
```

---

## 🖥️ 在 Sony Imaging Edge Edit (跨平台) 中调色与批量导出

1. 启动官方软件 **Imaging Edge Desktop ➔ Edit**：
   - **macOS**: `/Applications/Imaging Edge/Edit.app`
   - **Windows**: `C:\Program Files\Sony\Imaging Edge Desktop\Edit.exe` 或从开始菜单启动
2. 将生成的 `*_all_looks.ARW` 照片导入到 Edit 软件中；
3. 在右侧 **“创意外观 (Creative Look)”** 下拉列表中选择 **`FL2 (Film 2)`** 或 **`FL3 (Film 3)`**；
4. 可以在调色面板中进一步按需微调对比度、阴影、高光、褪色感与清晰度；
5. 点击 **“保存/批量导出”** 即可直接输出原厂调色渲染的高清 JPG 或 16-bit TIFF 成片！

---

## 🔬 逆向技术机理

```
                    ┌────────────────────────┐
                    │    Sony ARW 5.0 文件   │
                    └───────────┬────────────┘
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
       ┌─────────────────────┐     ┌─────────────────────┐
       │   TIFF IFD0 元数据  │     │ 加密块 SR2SubIFD    │
       │   (Model / Make)    │     │ (Key: 0x44332211)   │
       └─────────────────────┘     └──────────┬──────────┘
                                              │
                                  ┌───────────┴───────────┐
                                  ▼  PRNG Keystream 解密  │
                         ┌────────────────────────────────┴──┐
                         │ 明文 Look 列表 (Tag 0x7770)       │
                         │ [ST, VV, NT, PT, FL, VV2, IN, SH] │
                         └────────────────┬──────────────────┘
                                          │ 原位注入 FL2 (0x16) / FL3 (0x17)
                                          ▼
                         ┌───────────────────────────────────┐
                         │ 注入后 Look 清单                  │
                         │ [ST, VV, NT, PT, FL, FL2, FL3...] │
                         └────────────────┬──────────────────┘
                                          │ 对称 PRNG 重新加密
                                          ▼
                               ┌─────────────────────┐
                               │ 零位移写回原始 ARW  │
                               └─────────────────────┘
```

- **为什么纯改 Model 无效？**：反编译发现 Edit.app 的下拉选项严格由 `SR2SubIFD` 密文中的 `Tag 0x7770` 数组驱动。
- **为什么 ExifTool 会损坏？**：传统 ExifTool 会重新排布 TIFF 目录树，破坏 RAW 像素切片偏移。
- **零位移原位重加密 (Zero-Shift)**：本技能自主实现索尼对称 PRNG 算法，保证文件尺寸与物理切片偏移 100% 恒定。

---

## 📦 项目结构

```text
sony-arw-fl2-unlocker/
├── SKILL.md                  # 🤖 AI Agent 技能定义规范与 Prompt 指引
├── install-skill.sh          # ⚡ 一键安装到所有本地 Agent 环境的脚本
├── README.md                 # 📖 项目与技能使用文档
├── LICENSE                   # 📄 MIT 开源许可证
├── scripts/
│   └── camouf_arw.py         # 🐍 核心无损原位解密与注入引擎
└── .agents/
    └── skills/
        └── sony-arw-fl2-unlocker/   # 📦 工作区本地 Skill 镜像
```

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

*免责声明：本项目为摄影色彩研究与逆向工程探索产物，相关商标与色彩算法版权归索尼公司 (Sony Group Corporation) 所有。*
