# Changelog

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
