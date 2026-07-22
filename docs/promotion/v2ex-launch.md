# OnlyTranslate V2EX 首发材料

## 发布信息

- 节点：分享创造
- 推荐标题：做了个开源浏览器翻译扩展「只译」：网页、视频字幕和 EPUB 都能双语读
- 备选标题：分享一个自己在用的开源翻译扩展：网页 / 字幕 / EPUB
- 建议标签：翻译、Chrome、开源、EPUB
- 发布时机：Chrome Web Store 已显示 `1.2.0`，并确认安装后可以看到「电子书（Beta）」入口

## 可直接发布的正文

> 复制下面分隔线之间的内容。发帖语法选择 Markdown，发布前先预览图片。

---

大家好，最近把一直在维护的浏览器翻译扩展「只译」更新到了 1.2.0。这次加入了本地 EPUB 翻译阅读器，第一次在 V 站正式发出来，请大家帮忙试用和挑问题。

浏览器翻译已经是一个很卷的品类了。之所以还在做这个项目，是因为我想要一套更偏阅读、尽量克制的工具：除了翻译网页，也能覆盖看外语视频和读本地电子书；翻译服务由用户自己选择，不绑定只译账号或订阅。

![只译的网页双语翻译效果](https://raw.githubusercontent.com/airhunter/OnlyTranslate/main/store-assets/v2ex/zh-CN/01-web-translation.png)

目前主要支持：

- **网页翻译**：可以选择「识文」或「全页」。识文模式尽量只处理正文、帖子和评论，减少导航、菜单等内容的干扰；支持双语对照和仅显示译文，也提供划词、悬停、输入框、快捷键和右键菜单等入口。
- **视频字幕翻译**：目前支持 YouTube、Udemy、Coursera 和 Khan Academy。扩展会结合附近字幕进行分段翻译，并通过播放调度和本地缓存减少等待及重复请求。
- **EPUB 电子书翻译（Beta）**：可以导入本地无 DRM 的 EPUB，滚动阅读时自动翻译当前章节，并保存书架、阅读进度和位置书签。
- **翻译服务可以自己选**：提供微软、Google、Chrome 内置翻译、DeepL、OpenAI、DeepSeek、Gemini、Claude 等预设，也支持 OpenAI Chat Completions 兼容接口。

![只译的视频双语字幕效果](https://raw.githubusercontent.com/airhunter/OnlyTranslate/main/store-assets/v2ex/zh-CN/02-video-subtitles.png)

![只译的 EPUB 翻译阅读器](https://raw.githubusercontent.com/airhunter/OnlyTranslate/main/store-assets/v2ex/zh-CN/03-epub-reader.png)

项目本身免费并以 GPLv3 开源，不需要注册只译账号，也不向项目方收集使用数据。设置、导入的 EPUB、阅读进度和书签保存在当前浏览器中；使用在线翻译服务时，待翻译文本会发送给用户选择的服务商。Chrome 内置翻译可在浏览器本地处理，但可用性取决于 Chrome 版本、语言组合和本地模型状态。

也提前说一下目前的不足：

- 目前主要支持 Chrome。
- EPUB 阅读器还是 Beta，只支持本地无 DRM 的 EPUB，暂时没有 PDF、MOBI、云同步、笔记或 AI 分析。
- 字幕翻译依赖视频本身提供可读取的原字幕轨道。
- 网页结构千奇百怪，识文模式仍可能遇到漏翻、多翻或排版不理想的页面。

项目基于 [FluentRead（流畅阅读）](https://github.com/Bistutu/FluentRead) 开发。在保留核心网页翻译能力的基础上，我继续补充了视频字幕翻译、电子书翻译、识文 / 全页切换和更精简的设置体验，感谢原作者及所有贡献者的开源工作。

Chrome 商店：

https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi

GitHub：

https://github.com/airhunter/OnlyTranslate

这个项目还在持续迭代，也想借这次发帖收集一些真实需求。相比直接列功能愿望，我更想了解具体使用场景：

1. 你平时最需要翻译的是网页、视频字幕还是电子书？
2. 目前使用的翻译工具，最影响体验的问题是什么？
3. 如果试用了只译，希望优先改进哪个地方？

如果遇到网页漏翻或排版异常，欢迎附上网址、浏览器版本、翻译模式和现象；涉及登录页面时，只描述页面结构和问题即可，不要贴隐私内容。

收到的建议我会结合项目“专注阅读翻译”的定位评估，不一定都会加入，但每条都会认真看。也欢迎直接在 GitHub 提 Issue。

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

FluentRead 提供了很好的网页翻译基础，只译在此基础上继续开发，并按照 GPLv3 开源。后续主要补充和重做了视频字幕、EPUB 阅读器、识文 / 全页范围、翻译目标识别、服务配置和界面体验。README 中也一直保留了项目来源和致谢。

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
