# Chrome Web Store 素材

官方当前要求见 [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) 和 [Supplying Images](https://developer.chrome.com/docs/webstore/images?csw=1)：

- 商店图标：128 × 128 px
- 截图：至少 1 张、最多 5 张，1280 × 800 px
- 小宣传图：440 × 280 px，必填，不能按语言本地化
- Marquee 宣传图：1400 × 560 px，可选，不能按语言本地化

## zh-CN 截图上传顺序

`zh-CN` 目录中的五张 PNG 均为 1280 × 800，建议按编号顺序上传：

1. `01-web-translation.png`：真实网页识文演示，突出“正文双语、侧栏不打扰”。源文件位于 `source/smart-real-page.zh-CN.html`。
2. `02-video-subtitles.png`：视频双语字幕，保留。
3. `03-ebook-reader-beta.png`：本地 EPUB 翻译阅读器（Beta），保留。
4. `04-popup-bookshelf.png`：Popup 书架和最近阅读入口，保留为辅助说明。
5. `05-services-and-privacy.png`：翻译服务选择和本地隐私边界，保留为信任说明。

原来的网页翻译效果图仍保留在 `../v2ex/zh-CN/01-web-translation.png`，适合用于帖子、文章或 README 备用展示。

## 全球通用截图

`global` 目录中的五张 PNG 均为 1280 × 800，用于 Chrome Web Store 后台的“全球通用的资源”截图位。它们使用英文和少语言依赖的产品界面，作为未配置本地化截图时的兜底素材。

建议按编号顺序上传：

1. `01-web-translation.png`：Smart web translation
2. `02-video-subtitles.png`：Bilingual video subtitles
3. `03-ebook-reader-beta.png`：Local EPUB translation reader
4. `04-popup-bookshelf.png`：Popup ebook library
5. `05-services-and-privacy.png`：Services and privacy

源文件位于 `source/listing.global.html` 和 `source/listing.css`。

## 宣传图

- `small-promo-tile.png`：440 × 280，必填。由 ImageGen 底图和 `source/small-promo-tile.zh-CN.html` 叠加生成。
- `marquee-promo.png`：1400 × 560，可选。由 ImageGen 底图和 `source/marquee-promo.zh-CN.html` 叠加生成。

ImageGen 原图位于 `generated/`。最终文字由 HTML/CSS 叠加，避免图片模型生成乱码。

## 上传状态

Chrome Web Store 的中文截图、全球通用截图、小宣传图和 Marquee 宣传图已于 2026-07-24 更新。

## 文案

商店短描述、长描述、截图标题和上传清单见 `listing.zh-CN.md`。
