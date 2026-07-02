# OnlyTranslate · 只译

> 强大而克制，只做一件事——翻译。

[English](./README_EN.md) | 中文

一款专注于翻译的浏览器插件，支持网页识文翻译、全页翻译、划词/悬停翻译和视频字幕翻译。

只译希望在你阅读外文网页时安静地补上语言差距，而不是把整个页面变成另一套工具。

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

---

## 特性

- **识文翻译**：默认推荐的网页翻译方式，优先处理正文、评论和主要阅读内容，减少对页面周边信息的打扰。
- **全页翻译**：更宽松的网页翻译方式，适合文档、论坛、工具页，以及你明确想看完整页面译文的场景。
- **划词与悬停翻译**：选中文本或悬停即可获得译文，适合快速查词、读短句和临时确认含义。
- **视频字幕翻译**：自动捕获 YouTube、Udemy、Coursera 等平台的字幕并实时翻译，支持双语对照显示。
- **双语对照 / 仅译文模式**：根据阅读习惯切换显示方式，兼顾理解和沉浸阅读。
- **多引擎支持**：内置 OpenAI、DeepSeek、Google 翻译、微软翻译、DeepL 等 20+ 种主流翻译引擎快捷预设。
- **自定义网关池**：支持添加多个兼容 OpenAI 格式的自定义接口，适配本地模型、企业中转服务或自建网关。
- **隐私优先**：所有配置本地存储，不收集任何用户数据。
- **完全免费**：开源，非商业化项目。

---

## 翻译范围

只译提供两种网页翻译范围：

- **识文**：适合阅读文章、帖子、评论和长内容。它会优先寻找页面中的主要阅读区域，让译文更集中。
- **全页**：适合文档、后台页面、工具站和信息密集页面。它会尽量翻译更多可见内容，同时保留页面结构和交互。

---

## 支持平台

| 平台 | 字幕翻译 | 网页翻译 |
|------|----------|----------|
| YouTube | ✅ | ✅ |
| Udemy | ✅ | ✅ |
| Coursera | ✅ | ✅ |
| Khan Academy | ✅ | ✅ |
| 通用网页 | — | ✅ |

---

## 项目来源与改进

OnlyTranslate 基于 [FluentRead（流畅阅读）](https://github.com/Bistutu/FluentRead) 开发，针对以下方向做了重点改进：

| | 流畅阅读 | OnlyTranslate |
|---|---|---|
| 视频字幕翻译 | 不支持 | ✅ YouTube、Udemy、Coursera 等 |
| 网页翻译范围 | 全页翻译为主 | ✅ 支持识文 / 全页切换 |
| 功能范围 | 功能丰富，但部分较少使用 | 精简核心功能，去除冗余选项 |
| 设置界面 | 选项繁多，配置门槛较高 | 全新极简设计，引入“我的服务”动态面板，支持多个自定义节点 |

**主要新增：**
- 视频字幕实时翻译，自动捕获并逐句翻译，支持双语对照叠加显示。
- 识文 / 全页翻译范围切换，兼顾正文阅读和完整页面翻译。
- 基于说话停顿智能合并字幕片段，翻译质量更佳。

**主要简化：**
- 去除使用频率低的功能，保持界面干净。
- 设置项重新梳理，开箱即用，减少配置负担。
- “我的服务”按需动态面板，隐藏未使用的翻译服务，减少满屏配置参数。

---

## 安装

**Chrome 扩展商店：**

[只译 - Chrome Web Store](https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi)

**手动安装（开发者模式）：**

1. 前往 [Releases](https://github.com/airhunter/OnlyTranslate/releases) 下载最新 `.zip` 包并解压。
2. 打开 Chrome，进入 `chrome://extensions/`。
3. 开启右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择解压后的目录。

---

## 开发

```bash
# 安装依赖
corepack pnpm install

# 开发模式（Chrome）
corepack pnpm dev

# 构建
corepack pnpm build

# 打包 zip
corepack pnpm zip
```

本项目在 `package.json` 中声明了 pnpm 版本。建议使用 `corepack pnpm ...`
运行脚本，确保使用项目声明的包管理器版本和本地依赖。

开发模式请在 Chrome 开发者模式中加载 `.output/chrome-mv3-dev`；生产构建请加载
`.output/chrome-mv3`。不要混用两个输出目录。

技术栈：[WXT](https://wxt.dev/) + [Vue 3](https://vuejs.org/) + TypeScript，Manifest V3。

## 致谢

本项目基于 [FluentRead（流畅阅读）](https://github.com/Bistutu/FluentRead) 开发，感谢原作者及所有贡献者的开源工作。

---

## 开源协议

本项目遵循 [GNU GPL v3.0](./LICENSE) 协议开源。
