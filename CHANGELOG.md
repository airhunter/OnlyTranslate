# Changelog

# [1.0.0](https://github.com/airhunter/OnlyTranslate/compare/v0.9.1...v1.0.0) (2026-07-13)


### Bug Fixes

* **content:** 修复 Jacob Gold 文章未逐段翻译 ([23fa3e4](https://github.com/airhunter/OnlyTranslate/commit/23fa3e4ec00c9d147f76ddadf0205f2c794d49f4))


### Features

* **service:** 增加按服务配置的思考模式 ([5672ae7](https://github.com/airhunter/OnlyTranslate/commit/5672ae7f6ea8dc7c174e5d95dc53b7f5a505ed9d))
* **video:** 提升字幕翻译可靠性与上下文质量 ([91a5d09](https://github.com/airhunter/OnlyTranslate/commit/91a5d0909d5e456f09a4fafd5f5e74337cb55885))
* **video:** 增加字幕本地缓存 ([bb5f39c](https://github.com/airhunter/OnlyTranslate/commit/bb5f39c89fffb194d65b996eb89c58c8b0a44431))

## [0.9.1](https://github.com/airhunter/OnlyTranslate/compare/v0.9.0...v0.9.1) (2026-07-06)


### Bug Fixes

* **ui:** 优化悬浮球展开入口图标 ([e40f145](https://github.com/airhunter/OnlyTranslate/commit/e40f145e0360a3c3d23047ec7cec9173dee90977))

# [0.9.0](https://github.com/airhunter/OnlyTranslate/compare/v0.8.0...v0.9.0) (2026-07-05)


### Bug Fixes

* **content:** 修复 Substack 评论与转发翻译 ([e8e0810](https://github.com/airhunter/OnlyTranslate/commit/e8e08105e371e049182eab83226f2ed316e3cf7f))


### Features

* **ui:** 优化悬浮球主动作与工具条入口 ([dc63f0a](https://github.com/airhunter/OnlyTranslate/commit/dc63f0aa36960e50f7db44aca3690a09f8a448b5))

# [0.8.0](https://github.com/airhunter/OnlyTranslate/compare/v0.7.0...v0.8.0) (2026-07-03)


### Bug Fixes

* **content:** 优先调度可视区翻译 ([e7e454b](https://github.com/airhunter/OnlyTranslate/commit/e7e454b1b77bd33d52d2d0b74b87e21c24991b7e))
* **content:** 修复 Springer Nature 文章标题和摘要翻译 ([cba4729](https://github.com/airhunter/OnlyTranslate/commit/cba472944c1e27a946e67e2f412c923b7bf56cf5))
* **content:** 修复动作控件污染容器导致正文漏翻 ([970bbbe](https://github.com/airhunter/OnlyTranslate/commit/970bbbe315692e1ce57fb4c6a53f6bcef90aee40))
* **content:** 修复图文混排与 ynet 标题漏翻 ([0f0d859](https://github.com/airhunter/OnlyTranslate/commit/0f0d85947669eeed801f2ecfc58a64c896ac9be8))
* **content:** 恢复前导阅读兄弟区域 ([98fb598](https://github.com/airhunter/OnlyTranslate/commit/98fb598ef0640ec28e66796b4683353f651aa8aa))
* **content:** 恢复批量翻译首屏优先 ([eaf34a3](https://github.com/airhunter/OnlyTranslate/commit/eaf34a3bf89f9f0a8c0d0041e9ab47929bcb10dc))
* **content:** 恢复非可视区后台翻译 ([863e397](https://github.com/airhunter/OnlyTranslate/commit/863e397dc991dd475863661278dfe4e351d4cdd9))
* **content:** 提升后台翻译并发 ([add77c6](https://github.com/airhunter/OnlyTranslate/commit/add77c63725230eda3436f50cb47d6e63079adab))
* **content:** 翻译 Devin 更新日志段落正文 ([9ff5a88](https://github.com/airhunter/OnlyTranslate/commit/9ff5a88327f9a1c350ec27bac9d4f14953a61742))
* **content:** 跳过 Devin 更新日志元信息 ([3029c2f](https://github.com/airhunter/OnlyTranslate/commit/3029c2f5674c64e584e2855175bdbc3ac7198bd7))
* **service:** 修复批量翻译配置与消息类型 ([d9ce92e](https://github.com/airhunter/OnlyTranslate/commit/d9ce92e2c1b1bcd5e9a643774661b81500ae89a8))
* **service:** 校验批量翻译占位符 ([f13664f](https://github.com/airhunter/OnlyTranslate/commit/f13664f9de8763910ebd82493e95f18d2f7ae10e))


### Features

* **service:** 支持网页批量翻译队列 ([680ab1e](https://github.com/airhunter/OnlyTranslate/commit/680ab1eaecc60b9279e0d33ac46705a11b8a4f7a))


### Performance Improvements

* **content:** 修复长文档整页翻译卡死与正文漏翻 ([a293781](https://github.com/airhunter/OnlyTranslate/commit/a293781efe09da0bd2bfdb03f609dec62e4df787))

# [0.7.0](https://github.com/airhunter/OnlyTranslate/compare/v0.6.0...v0.7.0) (2026-06-28)


### Bug Fixes

* **content:** 保留嵌套目录列表目标 ([1a9c19f](https://github.com/airhunter/OnlyTranslate/commit/1a9c19f06669d3fda975eb97042c71392c479802))
* **content:** 修复 Hugging Face 博客识文目标 ([c9de3e0](https://github.com/airhunter/OnlyTranslate/commit/c9de3e0e904333da97a8e416e878148df13b08c6))
* **content:** 支持旧式 font 文本流分段 ([e948df4](https://github.com/airhunter/OnlyTranslate/commit/e948df49ab9d783701f7e7b407bbe185874a179f))
* **content:** 通用化双语插入布局 ([1649ee9](https://github.com/airhunter/OnlyTranslate/commit/1649ee9a9a22a7fdbdd371b0845130458c3b8332))
* **ui:** 同步页面翻译状态到浮动工具栏 ([d6b2c0a](https://github.com/airhunter/OnlyTranslate/commit/d6b2c0a5b904b5b417721f607598f3c1695e900d))


### Features

* **content:** 支持站点级 keepSelector ([d783a30](https://github.com/airhunter/OnlyTranslate/commit/d783a30581c8457cc4ecf8fa09cd599e666c70bc))

# [0.6.0](https://github.com/airhunter/OnlyTranslate/compare/v0.5.7...v0.6.0) (2026-06-23)


### Bug Fixes

* **content:** 修复图片标注自动翻译闪退 ([362cc80](https://github.com/airhunter/OnlyTranslate/commit/362cc80ca9cf4990c3a76ed653e4070e005e01c5))
* **ui:** 修正页面翻译快捷键文案 ([599f0c3](https://github.com/airhunter/OnlyTranslate/commit/599f0c3138edfd8b33329c71f622a3db6c9d66e0))
* **ui:** 收敛浮动工具条配置更新边界 ([f31e9da](https://github.com/airhunter/OnlyTranslate/commit/f31e9da9db050a595be4f5cbde5cf4d46ba1f7bc))


### Features

* **ui:** 实现页面内分离胶囊工具条 ([4f5230d](https://github.com/airhunter/OnlyTranslate/commit/4f5230d53259097498781688c1ee6fb7eb15b570))

## [0.5.7](https://github.com/airhunter/OnlyTranslate/compare/v0.5.6...v0.5.7) (2026-06-18)


### Bug Fixes

* **content:** 修复 Astro 推文嵌入识文命中 ([e83c287](https://github.com/airhunter/OnlyTranslate/commit/e83c287ca464d929c209144daaf94f6c796639ba))
* **content:** 修复嵌套块直接文本翻译目标 ([58a1b6f](https://github.com/airhunter/OnlyTranslate/commit/58a1b6f91fb1beaeddb008ddf4101f5fe4a69bb0))

## [0.5.6](https://github.com/airhunter/OnlyTranslate/compare/v0.5.5...v0.5.6) (2026-06-15)


### Bug Fixes

* **content:** 保留带分享按钮的文章标题 ([078cf5e](https://github.com/airhunter/OnlyTranslate/commit/078cf5e7fa4f3408440ffa7e2254633dc4ca4370))
* **content:** 保留含推广词的正文段落 ([1dc4c25](https://github.com/airhunter/OnlyTranslate/commit/1dc4c251b5ca1beb465f9c0cbb8689532b9069ed))
* **content:** 避免噪声词误杀正文 ([510ff36](https://github.com/airhunter/OnlyTranslate/commit/510ff36634f1d0d2fc2fb1e88386fee456f4287e))
* **content:** 识别内联块级正文段落 ([42401d9](https://github.com/airhunter/OnlyTranslate/commit/42401d9ebd4d4c0456acc4c2e5fddfc87917e97b))
* **content:** 识别内联样式正文段落 ([508b708](https://github.com/airhunter/OnlyTranslate/commit/508b708bbad4806060fed36b78e06c904463576d))
* **content:** 统一正文识别与噪声裁决 ([abab93c](https://github.com/airhunter/OnlyTranslate/commit/abab93c5aacbabf0388553737a83e3d8a13d4b92))
* **content:** 修复本地模型异常输出与正文漏译 ([62a3e66](https://github.com/airhunter/OnlyTranslate/commit/62a3e6642f29a9c70197f2a4e8b57431c83fdf9e))

## [0.5.5](https://github.com/airhunter/OnlyTranslate/compare/v0.5.4...v0.5.5) (2026-06-01)


### Bug Fixes

* **content:** 保持嵌套目标去重语义 ([8f89ba2](https://github.com/airhunter/OnlyTranslate/commit/8f89ba22005bf63ed79f4e8817f17e9bf3390e95))
* **content:** 修复 Ziggit 帖子回复漏翻 ([19c6382](https://github.com/airhunter/OnlyTranslate/commit/19c63829d201ac29e4c98424950446ad7fe76526))
* **content:** 避免 GitHub 链接被通用社交过滤误伤 ([b13f04c](https://github.com/airhunter/OnlyTranslate/commit/b13f04c84dee8d897dafd3b84a435e1be40e046e))
* **options:** 修复设置页标题占位符 ([a359b50](https://github.com/airhunter/OnlyTranslate/commit/a359b5017d49527daf111f8a7708c582e36e419f))


### Performance Improvements

* **content:** 收紧用户名识别并优化节点过滤 ([eacc715](https://github.com/airhunter/OnlyTranslate/commit/eacc71582de22479d5b516df0f78aae253ac876d))

## [0.5.4](https://github.com/airhunter/OnlyTranslate/compare/v0.5.3...v0.5.4) (2026-05-30)


### Bug Fixes

* **content:** 收窄热门内容过滤误判 ([3e0e4e5](https://github.com/airhunter/OnlyTranslate/commit/3e0e4e55760de364164b4cf493d57ee50c14d03c))
* **content:** 修复 Real Python 正文目标漏译 ([c313451](https://github.com/airhunter/OnlyTranslate/commit/c313451595d22737631358bf3dac6aab57c09e64))
* **content:** 修复多站点正文目标漏译 ([1ba481b](https://github.com/airhunter/OnlyTranslate/commit/1ba481b5bf30eb72abe3bf21beb4fa1a119e1462))


### Performance Improvements

* **content:** 优化 Heavy 页面识文性能 ([42932e2](https://github.com/airhunter/OnlyTranslate/commit/42932e299f084d37cda7d498036a9904a40eea0f))

## [0.5.3](https://github.com/airhunter/OnlyTranslate/compare/v0.5.2...v0.5.3) (2026-05-26)


### Bug Fixes

* **content:** 修复站点正文翻译目标识别 ([2684e47](https://github.com/airhunter/OnlyTranslate/commit/2684e47465d22e6d7a20528dadb454bfad4dd1e9))

## [0.5.2](https://github.com/airhunter/OnlyTranslate/compare/v0.5.1...v0.5.2) (2026-05-26)


### Bug Fixes

* **content:** 优化页面正文翻译目标识别 ([a0be666](https://github.com/airhunter/OnlyTranslate/commit/a0be666009919adaddfda8fdb1e8d3577b981d4c))

## [0.5.1](https://github.com/airhunter/OnlyTranslate/compare/v0.5.0...v0.5.1) (2026-05-22)


### Features

* **release:** 支持更新说明多语言 ([6a87123](https://github.com/airhunter/OnlyTranslate/commit/6a871234d4dc93f9076fa891a7442658ff660924))

# [0.5.0](https://github.com/airhunter/OnlyTranslate/compare/v0.4.0...v0.5.0) (2026-05-22)


### Bug Fixes

* **content:** 修复 CNN 标题误判广告 ([b4aece5](https://github.com/airhunter/OnlyTranslate/commit/b4aece5442b7b01f1131bceb6480eb2919788e2c))
* **github:** 修复搜索页翻译目标定位 ([568e31b](https://github.com/airhunter/OnlyTranslate/commit/568e31b7b8fb497f7ee77dbfb4138040b243597a))


### Features

* **content:** 引入翻译目标决策层 ([dd4a69a](https://github.com/airhunter/OnlyTranslate/commit/dd4a69a4946986735818eef004abc6687a5d0bcf))
* **ui:** 支持界面国际化 ([10d1d47](https://github.com/airhunter/OnlyTranslate/commit/10d1d470802092e3523237df4e435a758141b2c0))

# [0.4.0](https://github.com/airhunter/OnlyTranslate/compare/v0.3.1...v0.4.0) (2026-05-19)


### Bug Fixes

* **content:** 修复列表与社交链接翻译目标 ([e9f9b77](https://github.com/airhunter/OnlyTranslate/commit/e9f9b778e39280d21107c6f2b6fdf62056712ddf))
* **content:** 修复可展开内容卡片识别 ([f74dc6f](https://github.com/airhunter/OnlyTranslate/commit/f74dc6fc851d6aebf6cbb26c09cb902e41944446))
* **content:** 修复折叠卡片译文显示 ([686fda5](https://github.com/airhunter/OnlyTranslate/commit/686fda53addc3ad54e1c1ee11c5a6f2d40d7c2c6))
* **content:** 修复站点卡片标题识别 ([6ad2896](https://github.com/airhunter/OnlyTranslate/commit/6ad28968883ba26863dca3d0635e46e1a7b4805d))
* **content:** 修复配置检查提示乱码 ([e9aac6c](https://github.com/airhunter/OnlyTranslate/commit/e9aac6c1d261cc9f20c52886555a20cf071be508))


### Features

* **content:** 增强识文内容单元识别 ([241b6fd](https://github.com/airhunter/OnlyTranslate/commit/241b6fd33b7505a9e2da67db16c8fb76a13a4722))

## [0.3.1](https://github.com/airhunter/OnlyTranslate/compare/v0.3.0...v0.3.1) (2026-05-05)


### Bug Fixes

* **content:** 优化文章标题识别范围 ([46e320b](https://github.com/airhunter/OnlyTranslate/commit/46e320ba183d9815e9ef31f615d0bd3fb27dced1))
* **content:** 优化智能过滤兜底与 Reddit 正文识别 ([7052612](https://github.com/airhunter/OnlyTranslate/commit/7052612af95d4bc165e3c9d78e1ec8f40002c56d))
* **content:** 优化识文动态内容与站点适配 ([ea0f42f](https://github.com/airhunter/OnlyTranslate/commit/ea0f42f22d14571a6dfc9a472733ed8197aeb0e9))
* **content:** 避免脚本源码被误翻译 ([f6ab31e](https://github.com/airhunter/OnlyTranslate/commit/f6ab31e1d02551e94d280a429a147b5a73e58c21))

# [0.3.0](https://github.com/airhunter/OnlyTranslate/compare/v0.2.0...v0.3.0) (2026-05-04)


### Bug Fixes

* **ui:** 修复更新说明卡片定位与滚动问题 ([07efd7e](https://github.com/airhunter/OnlyTranslate/commit/07efd7e87537cb3e181005ee2ffa46e0fbd09d7b))


### Features

* **compat:** 拆分 GitHub smart/full 兼容层，统一跳过 About 侧边栏 ([df538b6](https://github.com/airhunter/OnlyTranslate/commit/df538b6df270f1bc192e5a7c7ffd68215b29c06a))
* **content:** 优化智能正文翻译过滤 ([efacdbb](https://github.com/airhunter/OnlyTranslate/commit/efacdbb55235ef61aba80b36e355b72967867943))
* **content:** 跳过交互式 ARIA role 元素的翻译 ([4df0f8a](https://github.com/airhunter/OnlyTranslate/commit/4df0f8a2c1c10eeb0a9f684d86e541df3a6a57b7))
* **options:** 支持刷新厂商模型列表 ([b7a1f4a](https://github.com/airhunter/OnlyTranslate/commit/b7a1f4ae39ab745f3aac72207f7034ead7f3ff44))
* **options:** 新增关于只译页面 ([2db8f4f](https://github.com/airhunter/OnlyTranslate/commit/2db8f4f1346880405738006ba73e54ed0b552786))
* **popup:** 翻译范围改为识文/全页分段控件 ([3842e31](https://github.com/airhunter/OnlyTranslate/commit/3842e31b32623435a09706669a592c4d094594f6))

# [0.2.0](https://github.com/airhunter/OnlyTranslate/compare/v0.1.0...v0.2.0) (2026-05-02)


### Bug Fixes

* **content:** 避免双语译文重复翻译 ([5b42dd2](https://github.com/airhunter/OnlyTranslate/commit/5b42dd24f9e2f6b65bda3d8324a4333e6e88a0a2))
* **content:** 避免空原文触发无关翻译 ([6465525](https://github.com/airhunter/OnlyTranslate/commit/64655254fe0bbcd06c3adc8f50527fdb379271e8))
* **ui:** 清理商店版运行时体验 ([8f58167](https://github.com/airhunter/OnlyTranslate/commit/8f5816746e80f7013ab31ea1b606678c23681e45))


### Features

* **options:** 支持默认目标语言双向互译 ([f82b651](https://github.com/airhunter/OnlyTranslate/commit/f82b6511b81d9a791563d3a74da290e5ee23fb1a))
