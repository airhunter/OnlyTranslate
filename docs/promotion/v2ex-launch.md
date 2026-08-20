# OnlyTranslate V2EX 首发材料

## 发布信息

- 节点：分享创造
- 推荐标题：持续更新了很久，终于来分享 Chrome 扩展「只译」：网页、视频字幕和 EPUB 翻译
- 备选标题：分享一个自己在用的开源翻译扩展：网页 / 字幕 / EPUB
- 建议标签：翻译、Chrome、开源、EPUB
- 发布时机：Chrome Web Store 已显示 `1.2.0`，并确认安装后可以看到「电子书（Beta）」入口

## 推广数据

| 日期 | 周用户数 |
| --- | ---: |
| 2026-08-17 | 833 |

## 可直接发布的正文

> 复制下面分隔线之间的内容。发帖语法选择 Markdown，发布前先预览图片。

---

大家好，「只译」这个浏览器翻译扩展其实已经持续更新了很长时间。一路边用边改，直到今天的 1.2.0，我才觉得功能和体验终于打磨到了自己比较满意、可以拿出来见人的状态，所以第一次来 V 站分享。

它是一款偏阅读体验的免费开源翻译扩展，希望用一个扩展覆盖网页、外语视频和本地电子书。翻译服务由用户自己选择，不绑定只译账号或订阅。

![只译的网页双语翻译效果](https://raw.githubusercontent.com/airhunter/OnlyTranslate/main/store-assets/v2ex/zh-CN/01-web-translation.png)

主要功能：

- **识文翻译**：自动寻找标题、正文和评论，尽量避开导航、推荐等干扰内容；也可以切换全页翻译，并支持双语 / 仅译文、划词、悬停和输入框翻译。
- **视频字幕**：不是简单地逐条直译，而是清理重复与滚动字幕，结合上下文重新分段；还会根据播放进度预取和追赶，并通过本地缓存减少等待。支持 YouTube、Udemy、Coursera 和 Khan Academy。
- **EPUB 翻译（Beta）**：导入本地无 DRM 的 EPUB，按章节自动翻译，并保存书架、进度和书签。
- **自选服务**：支持微软、Google、Chrome 内置翻译、常见 AI 服务和兼容接口。

![只译的视频双语字幕效果](https://raw.githubusercontent.com/airhunter/OnlyTranslate/main/store-assets/v2ex/zh-CN/02-video-subtitles.png)

![只译的 EPUB 翻译阅读器](https://raw.githubusercontent.com/airhunter/OnlyTranslate/main/store-assets/v2ex/zh-CN/03-epub-reader.png)

项目以 GPLv3 开源，不需要注册只译账号，也不向项目方收集使用数据。设置、EPUB、进度和书签保存在浏览器本地；使用在线服务时，待翻译文本会发送给你选择的服务商。

目前主要支持 Chrome；EPUB 仍是 Beta，只支持本地无 DRM 的 EPUB；字幕翻译也需要视频本身提供可读取的字幕。

项目最初基于 [FluentRead（流畅阅读）](https://github.com/Bistutu/FluentRead) 开发。不过经过长时间持续更新，现在从功能范围、网页识别逻辑到交互和展示效果，都已经发生了很大变化，并陆续加入了视频字幕、EPUB 阅读器等能力。仍然感谢原作者及所有贡献者的开源工作。

Chrome 商店：

https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi

GitHub：

https://github.com/airhunter/OnlyTranslate

也想收集一些真实需求：你平时最常翻译的是网页、视频还是电子书？现有工具最影响体验的问题又是什么？

如果试用时遇到漏翻或排版异常，欢迎附上网址和现象。建议我会结合“专注阅读翻译”的定位评估，也欢迎直接提 Issue。

---

## 发帖前检查清单

- [ ] Chrome Web Store 显示的版本是 `1.2.0`
- [ ] 从商店全新安装后，Popup 中能看到「电子书（Beta）」
- [ ] 实测一次“导入 EPUB → 打开章节 → 出现译文 → 关闭后恢复进度”
- [ ] `store-assets/v2ex/zh-CN/` 已提交并推送到 GitHub 的 `main` 分支
- [ ] 在无痕窗口分别打开正文中的三条 `raw.githubusercontent.com` 图片地址
- [ ] V2EX 发帖语法选择 Markdown，并使用预览确认三张图片正常显示
- [ ] 截图、商店描述和帖子中没有 API Key、邮箱、头像、书签栏或其他个人信息
- [ ] 发布后预留时间及时回复第一批评论和问题

## 常见评论回复模板

### 和沉浸式翻译 / Kiss Translator 有什么区别？

功能上肯定有重叠，我也不打算把只译说成谁的平替。它现在更偏向开源、自选翻译服务，以及把网页、视频字幕和本地 EPUB 放进同一套阅读体验。其他工具已经很成熟，大家按自己的使用习惯选择就好。

### EPUB 文件和网页内容会上传吗？

导入的 EPUB 原文件、书架、进度和书签保存在当前浏览器中，不会上传给只译。开始翻译后，需要翻译的网页、字幕或章节文本会发送给你选择的在线翻译服务；如果当前使用的是可用的 Chrome 内置翻译，则文本在浏览器本地处理。

### 为什么目前主要支持 Chrome？

现阶段先集中把网页识别、字幕调度和 EPUB 阅读流程在 Chrome 上打磨稳定。仓库里保留了 Firefox 构建能力，但发布和完整兼容性还需要继续验证，所以暂时不承诺上线时间。

### 为什么基于 FluentRead，而不是从零开发？

FluentRead 提供了很好的网页翻译基础，只译最初在此基础上继续开发，并按照 GPLv3 开源。经过长时间持续更新，现在从功能范围、网页识别逻辑到交互和展示效果都已经有了很大变化，也加入了视频字幕和 EPUB 阅读器等能力。README 中一直保留了项目来源和致谢。

### 免费服务以后会不会失效？

免配置服务会受到上游接口和浏览器环境变化的影响，无法承诺永久可用。只译把翻译服务做成可切换配置，也是希望某个服务不可用时，用户仍能换到其他服务或自己的 API Key。

### 回复功能建议时

感谢建议。方便的话可以再说一下具体使用场景、目前的解决办法，以及现有工具最卡你的地方吗？我会先确认它是否属于“阅读翻译”的核心范围，再评估优先级。

### 回复网页漏翻或排版问题时

感谢反馈。麻烦补充一下页面网址、Chrome 版本、使用的是识文还是全页、双语还是仅译文，以及漏翻内容大致位于页面哪个区域。登录后页面不用发隐私截图，描述 DOM 结构或最小示例即可。

## 备用图片

正文建议只放前三张，避免帖子过长。下面两张可在评论解释 Popup 或隐私设计时使用：

```markdown
![只译 Popup 中的电子书书架](https://raw.githubusercontent.com/airhunter/OnlyTranslate/main/store-assets/v2ex/zh-CN/04-popup-library.png)

![只译的翻译服务与本地数据说明](https://raw.githubusercontent.com/airhunter/OnlyTranslate/main/store-assets/v2ex/zh-CN/05-services-privacy.png)
```
