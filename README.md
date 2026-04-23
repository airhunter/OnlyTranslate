# OnlyTranslate · 只译

> 强大而克制，只做一件事——翻译。

一款专注于翻译的浏览器插件，支持网页文本翻译、视频字幕翻译，界面简洁、配置直观。

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

---

## 相比流畅阅读的改进

OnlyTranslate 基于 [FluentRead（流畅阅读）](https://github.com/Bistutu/FluentRead) 开发，针对以下方向做了重点改进：

| | 流畅阅读 | OnlyTranslate |
|---|---|---|
| 视频字幕翻译 | 不支持 | ✅ YouTube、Udemy、Coursera 等 |
| 功能范围 | 功能丰富，但部分较少使用 | 精简核心功能，去除冗余选项 |
| 设置界面 | 选项繁多，配置门槛较高 | 全新极简设计，引入“我的服务”动态面板，支持无限自定义节点 |

**主要新增：**
- 视频字幕实时翻译，自动捕获并逐句翻译，支持双语对照叠加显示
- 基于说话停顿（时间间隔）智能合并字幕片段，翻译质量更佳

**主要简化：**
- 去除使用频率低的功能，保持界面干净
- 设置项重新梳理，开箱即用，减少配置负担
- 首创“我的服务”按需动态面板，隐藏所有未使用的翻译服务，告别满屏配置参数

---

## 特性

- **视频字幕翻译**：自动捕获 YouTube 等平台的字幕并实时翻译，支持双语对照显示。
- **网页翻译**：悬停或划词即可获得译文，支持全文翻译模式。
- **双语对照**：原文与译文并列显示，阅读更轻松。
- **多引擎支持**：内置 OpenAI、DeepSeek、Google 翻译、微软翻译、DeepL 等 20+ 种主流翻译引擎快捷预设。
- **自定义网关池**：独家支持**无限添加**兼容 OpenAI 格式的自定义接口，完美适配本地部署的大语言模型（如 Ollama）或企业内部 API 中转服务。
- **隐私优先**：所有配置本地存储，不收集任何用户数据。
- **完全免费**：开源，非商业化项目。

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

## 安装

> Chrome 扩展商店版本即将上线，敬请期待。

**手动安装（开发者模式）：**

1. 前往 [Releases](https://github.com/airhunter/OnlyTranslate/releases) 下载最新 `.zip` 包并解压。
2. 打开 Chrome，进入 `chrome://extensions/`。
3. 开启右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择解压后的目录。

---

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（Chrome）
pnpm dev

# 构建
pnpm build

# 打包 zip
pnpm zip
```

技术栈：[WXT](https://wxt.dev/) + [Vue 3](https://vuejs.org/) + TypeScript，Manifest V3。

---

## 致谢

本项目基于 [FluentRead（流畅阅读）](https://github.com/Bistutu/FluentRead) 开发，感谢原作者及所有贡献者的开源工作。

---

## 开源协议

本项目遵循 [GNU GPL v3.0](./LICENSE) 协议开源。
