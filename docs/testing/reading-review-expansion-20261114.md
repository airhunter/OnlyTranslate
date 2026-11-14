# 历史测试网址扩充与发布版差分 · 2026-11-14

状态：本批完成。分支 codex/smart-reading-blocks，当前提交 7adaf68581e0b6b5964adf8ea777a9e49c8ff29a。本轮扩充数据，并修正采集完成统计及产物失败保存，没有修改识别算法、人工裁决或已接受限制，没有提交或发布。

## 范围与方法

从126个 translation-target fixture 的100个去重网址、docs/testing 中明确的网页链接及原五页清单中发现 111 个网址。保留原五页快照与固定发布版基线；新增计划 64 页，事先跳过 42 页。清单与来源见 tests/corpus/url-inventory.json；运行身份及逐页结果见 tests/corpus/batches/existing-test-urls-20261114.json。

发布基线固定为 v1.15.0 / 65d20abd7af0aa55ae59ee57b515692bd941ca22，ZIP SHA256 d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c。每页真实加载、滚动、稳定后归档，发布扩展实翻和当前分支识别在同一份快照上回放。原站脚本不在回放时运行；比较按原文位置覆盖，不按译文质量或简单目标数量打分。当前源码摘要 5eaa130c3b0ed9376fead033ebb09a7a5eb71b55725e1a8727fb78dbfeccf2ae。

发布版每次从校验后的 ZIP 字节及完整提交准备新目录。候选不调用翻译服务。目标已处理、实际插入、待处理、失败分别保存；processed-without-insert 保留原状，不伪造译文。没有合格实翻基线的页面不计入正式差分。

## 数量

完整配对 41 页（其中新增 36 页）；有差异 5 页，共新增 38 个原文块、减少 44 个原文块。有效基线保存 4060 条实际插入译文。状态计数：{"complete":41,"blocked":2,"capture-failed":16,"baseline-incomplete":10}。

新增/减少先作为核对项保存；已有的用户裁决继续生效，其余差异待用户裁决，不能自动当作修复或回归。本报告不计算未经标注页面的准确率。错误页、登录验证、访问失败和实翻不完整均单列，不算通过。

## 完整差分

| 页面 | 发布版目标 | 当前目标 | 新增/减少原文块 | 扫描量 发布→当前 | 快照 |
| --- | ---: | ---: | ---: | ---: | --- |
| [Large Language Models Effectively Leverage Document-level Context for Literary Translation, but Critical Errors Persist - ACL Anthology](https://aclanthology.org/2023.wmt-1.41/) | 34 | 34 | +0 / -0 | 249→244 | 5af00339-8a8f-499f-8b91-05b629216bcc |
| [The Mystery in the Medicine Cabinet—Asterisk](https://asteriskmag.com/issues/14/the-mystery-in-the-medicine-cabinet) | 98 | 98 | +0 / -0 | 471→467 | 1aff7658-1d19-4b03-9a2f-393fedd6de13 |
| [command center: Less is exponentially more](https://commandcenter.blogspot.com/2012/06/less-is-exponentially-more.html) | 109 | 109 | +0 / -0 | 936→931 | 91c89e8e-681b-4820-81a9-4320a2a4e93d |
| [Getting Started — claude.nagdy.me](https://claude.nagdy.me/learn/getting-started/) | 77 | 77 | +0 / -0 | 528→527 | 2262dab5-dfa0-46a0-8182-d037c2a652a9 |
| [OpenAI GPT Image 2 vs Google Nano Banana 2: Which AI Image Generator Is Best? - Decrypt](https://decrypt.co/366408/openai-gpt-image-2-vs-google-nano-banana-2-review) | 146 | 146 | +0 / -0 | 1876→1875 | 8f1beff8-2b83-4901-b16e-460c05be94f8 |
| [Claude Opus 4.7 Is Here: Anthropic’s Latest Model Delivers, But It’s a Token Eating Machine - Decrypt](https://decrypt.co/364621/claude-opus-47-review-benchmarks-coding-test) | 163 | 163 | +0 / -0 | 1855→1854 | d54231bf-ad38-4d96-8894-829e28f017bc |
| [Devin Desktop changelog - Devin Docs](https://docs.devin.ai/desktop/changelog) | 995 | 995 | +0 / -0 | 8064→8064 | 12141ede-7ef0-4408-aeed-6bbcc9727af6 |
| [Nobody Argued For Your Stack - DEV Community](https://dev.to/playfulprogramming/nobody-argued-for-your-stack-51fj) | 74 | 74 | +0 / -0 | 1604→1603 | 7430e39f-4d7a-4779-8401-250494c6ceb7 |
| [Ziggit - A Zig community](https://ziggit.dev/) | 102 | 102 | +0 / -0 | 4664→4658 | 0818f21a-a5b3-4719-9fae-f19aee9deb7e |
| [All Workflow Runs · GitHub](https://github.com/HKUDS/nanobot/actions) | 64 | 63 | +0 / -0 | 3061→3060 | 54dee8c1-b31a-47a3-961f-1a0b0246039d |
| [Commits · alchaincyf/huashu-design · GitHub](https://github.com/alchaincyf/huashu-design/commits/main/) | 2 | 2 | +0 / -0 | 294→289 | eaf85bc4-0920-486a-9b05-6028b6ecee70 |
| [Issues · alchaincyf/huashu-design · GitHub](https://github.com/alchaincyf/huashu-design/issues) | 3 | 3 | +0 / -0 | 459→453 | 5ada5324-d2f0-495b-8cbd-4a93745829da |
| [Add GitAgent Protocol support (agent.yaml + SOUL.md) by shreyas-lyzr · Pull Request #4005 · HKUDS/nanobot · GitHub](https://github.com/HKUDS/nanobot/pull/4005) | 11 | 11 | +0 / -0 | 293→289 | 5a31a454-7a39-4ac4-b82f-bf53d1bbc73a |
| [Projects · HKUDS/nanobot · GitHub](https://github.com/HKUDS/nanobot/projects) | 2 | 2 | +0 / -0 | 177→176 | 522ffb0b-38bf-4d97-8202-c975f2c890da |
| [Projects · microsoft/vscode · GitHub](https://github.com/microsoft/vscode/projects) | 1 | 1 | +0 / -0 | 189→188 | 6b610a4d-6396-40f5-ad8d-dc44065eb507 |
| [Pull requests · HKUDS/nanobot · GitHub](https://github.com/HKUDS/nanobot/pulls) | 26 | 25 | +0 / -0 | 430→426 | d7306016-939d-4730-8fb8-a39fb3da08b3 |
| [GitHub - HKUDS/nanobot: Your lightweight open-source personal agent. · GitHub](https://github.com/HKUDS/nanobot) | 161 | 161 | +0 / -0 | 0→0 | f1fc5b0b-e3e3-49d9-95c8-fe2a4cc6dc1f |
| [Repository search results · GitHub](https://github.com/search?q=openclaw&type=repositories) | 1 | 1 | +0 / -0 | 1320→1319 | 7e2d3fcb-7a61-4c56-af48-7c7863e0f3b3 |
| [Overview · HKUDS/nanobot · GitHub](https://github.com/HKUDS/nanobot/security) | 189 | 184 | +0 / -5 | 527→527 | b3c6b90e-8564-4f71-be8d-de704b4877dc |
| [The risk of AI isn't making us lazy, but making "lazy" look productive \| Hacker News](https://news.ycombinator.com/item?id=47555081) | 90 | 90 | +0 / -0 | 3692→3688 | 490b3b77-acf9-46b4-9d9f-2aecd0c3e570 |
| [MosaicLeaks: Can your research agent keep a secret?](https://huggingface.co/blog/ServiceNow/mosaicleaks) | 92 | 92 | +0 / -0 | 479→479 | 9e1a8cd6-2957-4b34-8c00-2790a6286ecb |
| [Programmers need to start meditating now \| Jake Gold](https://jacob.gold/posts/programmers-need-to-start-meditating-now/) | 9 | 9 | +0 / -0 | 21→21 | 66722b67-05b1-4cfc-8991-2b3fc46ff6f6 |
| [There's No Limit to How Bad Code Can Get \| Lobsters](https://lobste.rs/s/rfn2mn/there_s_no_limit_how_bad_code_can_get) | 88 | 61 | +0 / -30 | 928→927 | 04b9d48d-c051-4c3a-ae59-8ac443a1260c |
| [Thoughts on slowing the fuck down](https://mariozechner.at/posts/2026-03-25-thoughts-on-slowing-the-fuck-down/) | 59 | 59 | +0 / -0 | 183→182 | 251b4abe-3e1d-4ffb-aaa6-fb79aa461a6d |
| [Expansion artifacts \|\| Matt Ström-Awn, designer-leader](https://mattstromawn.com/writing/expansion-artifacts/) | 49 | 46 | +0 / -0 | 318→312 | 8f0c35fb-959e-4b0d-babb-8565036b0be5 |
| [The PhD Metagame: Don't Try to Reform Science - Maxwell Forbes](https://maxwellforbes.com/posts/dont-try-to-reform-science/) | 79 | 64 | +0 / -0 | 573→568 | 92109b0c-0c82-4ce0-a9e0-9763de343f5b |
| [Why I close SSH port 22 entirely (and what I use instead) · Michele Bologna](https://www.michelebologna.net/2026/ssh-port-22-fwknop-single-packet-authorization/) | 63 | 63 | +0 / -0 | 786→785 | 4eff3683-4b0a-431a-a6d5-824a7640f139 |
| [Roundtables: Can AI Learn to Understand the World? \| NXGOAI](https://nxgoai.com/blog/roundtables-can-ai-learn-to-understand-the-world-207216) | 26 | 26 | +0 / -0 | 194→193 | f9bad244-22d8-4b9a-a2c7-69ef6130335f |
| [How to Earn a Billion Dollars](https://paulgraham.com/earn.html) | 37 | 37 | +0 / -0 | 420→415 | 900f0937-9a68-4503-ad2a-f90972aacdd0 |
| [Ministry of Natural Resources \| ontario.ca](https://www.ontario.ca/page/ministry-natural-resources) | 25 | 26 | +1 / -0 | 761→756 | 5f5f168e-357b-4297-8a07-5aa414080be3 |
| [ML Job Interviews: The Ultimate Guide – Silvia Sapora](https://silviasapora.github.io/blog/ml-interviews.html) | 227 | 227 | +0 / -0 | 693→692 | 14b51745-52cc-4b75-80cb-bffeb1237181 |
| [Datasette Agent](https://simonwillison.net/2026/May/21/datasette-agent/) | 32 | 32 | +0 / -0 | 370→365 | 9690580f-47b8-4d69-84de-1cd42a362ae1 |
| [Finding Miscompiles for Fun, Not Profit - by Justin Lebar](https://newsletter.semianalysis.com/p/finding-miscompiles-for-fun-not-profit) | 35 | 35 | +0 / -0 | 568→567 | 706ce14a-8a06-45bd-b3fe-4c196210dfce |
| [Jordan - Wikipedia](https://en.wikipedia.org/wiki/Jordan) | 727 | 724 | +0 / -0 | 20113→20108 | 2a780573-d478-4109-93fd-8a70b9aa315c |
| [Notepad++ and Don Ho: A story of software, activism, and defiance](https://www.xda-developers.com/story-notepad-plus-plus/) | 111 | 111 | +0 / -0 | 755→754 | 25249f34-90b6-41e9-a4b7-bdbcf5bfb93c |
| [Panic on attempting to access union payload - Help - Ziggit](https://ziggit.dev/t/panic-on-attempting-to-access-union-payload/18027) | 15 | 15 | +0 / -0 | 1505→1504 | 0c3973bb-9222-4213-82fc-c0e781252ae0 |
| [teapaw.org — Nitter replacement \| teapawt](https://teapaw.org/) | 8 | 15 | +17 / -0 | 195→194 | a15d480469e97ea9cf14c64f |
| [What is the exact semantic of export - Explain - Ziggit](https://ziggit.dev/t/what-is-the-exact-semantic-of-export/15822) | 11 | 11 | +0 / -0 | 1540→1539 | fadc07a466e17f30175a8d31 |
| [Lil'Log](https://lilianweng.github.io/) | 22 | 22 | +0 / -0 | 246→240 | 746df28629938d77d2402873 |
| [The Undeniable Utility Of CSS :has • Josh W. Comeau](https://www.joshwcomeau.com/css/has/) | 112 | 120 | +20 / -9 | 1711→1626 | f725f40a43c530131676b8de |
| [1. Whetting Your Appetite — Python 3.15.2 documentation](https://docs.python.org/3/tutorial/appetite.html) | 17 | 17 | +0 / -0 | 85→84 | 960bca572fcd880e7f5d3c27 |

## 访问或运行未完成

| 网址 | 阶段状态 | 原因 |
| --- | --- | --- |
| https://archive.md/myA7R | blocked / done | 已核对归档正文：这是 CAPTCHA / request for access 验证页，不是目标文章 |
| https://arstechnica.com/tech-policy/2026/05/citing-gandalf-pope-leo-says-we-must-disarm-ai/ | capture-failed / capture | 采集时主页面响应错误：405 |
| https://arstechnica.com/security/2026/08/a-segmented-story/ | capture-failed / capture | 采集时主页面响应错误：405 |
| https://www.azlyrics.com/lyrics/nemesea/angelinthedark.html | blocked / done | 已核对归档正文：这是 CAPTCHA / request for access 验证页，不是目标文章 |
| https://genius.com/Nemesea-angel-in-the-dark-lyrics | capture-failed / capture | 采集时主页面响应错误：403 |
| https://claytonwramsey.com/blog/mvt/ | baseline-incomplete / done | 实翻未完整完成，已保留运行结果，不能作为合格基线 |
| https://edition.cnn.com/2026/05/21/world/iran-live-updates | capture-failed / capture | 采集时主页面响应错误：404 |
| https://exercism.org/tracks/cpp/exercises/making-the-grade | baseline-incomplete / done | 实翻未完整完成，已保留运行结果，不能作为合格基线 |
| https://www.genengnews.com/topics/bioprocessing/peptistar-began-operation-of-the-asahi-kasei-fo-md-system-at-manufacturing-scale/ | baseline-incomplete / done | Command failed: C:\Program Files\nodejs\node.exe C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js --yes --package @playwright/cli playwright-cli -s=rr-138b8cc-release run-code --filename C:\coding\translates_project\OnlyTranslate\output\playwright\reading-review\b1dfe8e20729bb38.js  |
| https://github.com/alchaincyf/huashu-design/discussions | capture-failed / capture | 采集时主页面响应错误：404 |
| https://github.com/alchaincyf/huashu-design/issues/5256 | capture-failed / capture | 采集时主页面响应错误：404 |
| https://ynarwal.github.io/how-llms-work/ | baseline-incomplete / done | 实翻未完整完成，已保留运行结果，不能作为合格基线 |
| https://support.claude.com/en/articles/15400594-claude-cowork-june-2026-usage-promotion | capture-failed / capture | 采集时主页面响应错误：404 |
| https://www.liepin.com/job/1985555579.shtml | baseline-incomplete / done | 实翻未完整完成，已保留运行结果，不能作为合格基线 |
| https://lilianweng.github.io/posts/2026-06-24-scaling-laws/ | baseline-incomplete / done | 实翻未完整完成，已保留运行结果，不能作为合格基线 |
| https://medium.com/@sebastiancarlos/the-tech-market-situation-is-crazy-ec49ea772903 | capture-failed / capture | 采集时主页面响应错误：403 |
| https://blog.mempko.com/your-agentic-workflows-cache-keepalive-costs-8x-too-much-v2-the-interval-frontier/ | baseline-incomplete / done | Command failed: C:\Program Files\nodejs\node.exe C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js --yes --package @playwright/cli playwright-cli -s=rr-138b8cc-release run-code --filename C:\coding\translates_project\OnlyTranslate\output\playwright\reading-review\dd9ab45f6b337a0b.js  |
| https://metalstorm.net/pub/interview.php?interview_id=344 | capture-failed / capture | 采集时主页面响应错误：403 |
| https://www.nature.com/articles/s43856-026-01747-8 | baseline-incomplete / done | Command failed: C:\Program Files\nodejs\node.exe C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js --yes --package @playwright/cli playwright-cli -s=rr-138b8cc-release run-code --filename C:\coding\translates_project\OnlyTranslate\output\playwright\reading-review\e4dbf027b532f36d.js  |
| https://www.potownstore.com/prismatic-evolutions-super-premium-collection-ptcgl-code | capture-failed / capture | 采集时主页面响应错误：403 |
| https://www.producthunt.com/products/maritime | capture-failed / capture | 采集时主页面响应错误：403 |
| https://www.producthunt.com/products/omlx | capture-failed / capture | 采集时主页面响应错误：403 |
| https://realpython.com/claude-api-python/ | capture-failed / capture | 采集时主页面响应错误：403 |
| https://newsletter.kentbeck.com/p/hey-n00b-we-didnt-hire-you-to-complete/comments | baseline-incomplete / done | 实翻未完整完成，已保留运行结果，不能作为合格基线 |
| https://towardsdatascience.com/i-reduced-my-pandas-runtime-by-95-heres-what-i-was-doing-wrong/ | capture-failed / capture | 采集时主页面响应错误：403 |
| https://www.tuc.org.uk/research-analysis/reports/work-intensification | capture-failed / capture | 采集时主页面响应错误：403 |
| https://www.wsj.com/business/china-us-ai-model-costs-53a12e96 | capture-failed / capture | 采集时主页面响应错误：401 |
| https://www.ynetnews.com/business/article/rjeij9cgge | baseline-incomplete / done | 实翻未完整完成，已保留运行结果，不能作为合格基线 |

## 预先跳过

| 网址 | 原因 |
| --- | --- |
| https://example.com/story | synthetic-fixture-url |
| https://example.com/customer-stories | synthetic-fixture-url |
| https://reading-regression.example/interactive-examples | synthetic-fixture-url |
| https://example.com/full-page-interface | synthetic-fixture-url |
| https://example.com/heavy-news-page | synthetic-fixture-url |
| https://example.com/reports/inline-block-paragraphs | synthetic-fixture-url |
| https://example.com/articles/sibling-reading-regions | synthetic-fixture-url |
| https://www.google.com/search?q=recent+book+in+uk&udm=50 | account-dependent-generated-answer |
| https://example.com/live/weather-updates | synthetic-fixture-url |
| https://partner.microsoft.com/en-us/dashboard/microsoftedge/87c50666-1955-428b-b1f0-993ff97e2a7c/properties | login-or-platform-gate |
| https://example.com/noisy-name-readable-prose | synthetic-fixture-url |
| https://www.quora.com/Does-corruption-exist-in-Japan/answer/Ken-Hower?qv_src=email | login-or-platform-gate |
| https://www.quora.com/Why-is-Xi-Jinping-not-bad/answer/1LittleGranny64?qv_src=email | login-or-platform-gate |
| https://reading-blocks.example/garden | synthetic-fixture-url |
| https://ordinary-blocks.example/garden | synthetic-fixture-url |
| https://www.reddit.com/r/odinlang/ | login-or-platform-gate |
| https://www.reddit.com/r/PinoyProgrammer/comments/1u4tuvb/im_beginning_to_believe_made_a_basic_game_in_c/ | login-or-platform-gate |
| https://www.reddit.com/r/digitalnomad/comments/1t3d0e0/china/ | login-or-platform-gate |
| https://www.reddit.com/r/PinoyProgrammer/comments/1s950b7/claude-pro/ | login-or-platform-gate |
| https://example.com/semantic-article-with-comments | synthetic-fixture-url |
| https://example.com/discussion/empty | synthetic-fixture-url |
| https://example.com/discussion/semantic-heading | synthetic-fixture-url |
| https://example.com/discussion/short | synthetic-fixture-url |
| https://shop.example.org/products/keyboard | synthetic-fixture-url |
| https://example.com/short-copy-cards | synthetic-fixture-url |
| https://example.com/notifications | synthetic-fixture-url |
| https://example.com/component-navigation | synthetic-fixture-url |
| https://reading-blocks.example/ | synthetic-fixture-url |
| https://www.threads.com/ | login-or-platform-gate |
| https://www.threads.com/@mediaite/post/De3FHG9mzGJ | login-or-platform-gate |
| https://www.threads.com/@example/post/sample | login-or-platform-gate |
| https://example.com/topics | synthetic-fixture-url |
| https://twitter.com/example/status/123 | login-or-platform-gate |
| https://www.x.com/ | login-or-platform-gate |
| https://x.com/BranitezSports/status/2113847887033667664 | login-or-platform-gate |
| https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/providers/translation-only-gate.ts | implementation-reference-not-test-page |
| https://rsvp.withgoogle.com/events/devfest-in-siliconvalley-2025 | shadow-dom-state-not-preserved-by-current-html-archive |
| https://github.com/react/react | shadow-dom-state-not-preserved-by-current-html-archive |
| https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM | shadow-dom-state-not-preserved-by-current-html-archive |
| https://material-web.dev/components/button/ | shadow-dom-state-not-preserved-by-current-html-archive |
| https://lit.dev/docs/components/shadow-dom/ | shadow-dom-state-not-preserved-by-current-html-archive |
| https://www.youtube.com/watch?v=dQw4w9WgXcQ | shadow-dom-state-not-preserved-by-current-html-archive |

## 待人工核对的差异

### Overview · HKUDS/nanobot · GitHub

- 减少 e955：# Run in a container or VM docker run --rm -it python:3.11 pip install nanobot-ai（未裁决）
- 减少 e969：sudo useradd -m -s /bin/bash nanobot sudo -u nanobot nanobot gateway（未裁决）
- 减少 e981：chmod 700 ~ /.nanobot chmod 600 ~ /.nanobot/config.json chmod 700 ~ /.nanobot/whatsapp-auth（未裁决）
- 减少 e996：# Configure log monitoring tail -f ~ /.nanobot/logs/nanobot.log（未裁决）
- 减少 e1018：# Check for updates weekly pip install --upgrade nanobot-ai（未裁决）

### There's No Limit to How Bad Code Can Get \| Lobsters

- 减少 e77：hyperpape（未裁决）
- 减少 e78：2 months ago（未裁决）
- 减少 e98：Loup-Vaillant（未裁决）
- 减少 e99：2 months ago（未裁决）
- 减少 e119：tomhukins（未裁决）
- 减少 e120：2 months ago（未裁决）
- 减少 e143：hyperpape（未裁决）
- 减少 e144：2 months ago（未裁决）
- 减少 e157：3（未裁决）
- 减少 e163：schneems（未裁决）
- 减少 e164：2 months ago（未裁决）
- 减少 e201：4（未裁决）
- 减少 e207：sjamaan（未裁决）
- 减少 e208：2 months ago（未裁决）
- 减少 e226：gunduzc（未裁决）
- 减少 e227：2 months ago（未裁决）
- 减少 e319：greysonp（未裁决）
- 减少 e320：2 months ago（未裁决）
- 减少 e339：insom（未裁决）
- 减少 e340：2 months ago（未裁决）
- 减少 e397：marginalia（未裁决）
- 减少 e398：2 months ago（未裁决）
- 减少 e454：landon（未裁决）
- 减少 e455：2 months ago（未裁决）
- 减少 e474：Corbin（未裁决）
- 减少 e475：2 months ago（未裁决）
- 减少 e489：8（未裁决）
- 减少 e495：pyj（未裁决）
- 减少 e491：edited（未裁决）
- 减少 e496：2 months ago（未裁决）

### Ministry of Natural Resources \| ontario.ca

- 新增 e921：An Act to Confirm the Title of the Government of Canada to Certain Lands and Indian Lands（未裁决）

### teapaw.org — Nitter replacement \| teapawt

- 新增 e27：We had to turn on a Cloudflare check for everyone（未裁决）
- 新增 e28：Bots are loading far more pages than people are. Every page costs a request on a limited pool of X accounts, so profiles and feeds were stalling for real readers. For now, every visitor is asked to pa…（未裁决）
- 新增 e29：We will turn it off once we reach this month's $300 . That money buys the accounts the bots burn through.（未裁决）
- 新增 e30：donation goal（未裁决）
- 新增 e31：A ($15 a month) skips the check: , or add your address to the pass to skip it on every domain. Donated already? .（未裁决）
- 新增 e32：search pass（未裁决）
- 新增 e33：log in（未裁决）
- 新增 e34：Ask for a pass（未裁决）
- 新增 e63：Spare addresses（未裁决）
- 新增 e64：This site is also , , , , and . If a spam filter blocks nitter.cf or xitter.cf, open one of those. lists which names are up.（未裁决）
- 新增 e65：nitter.gq（未裁决）
- 新增 e66：xitter.gq（未裁决）
- 新增 e67：teapawt.net（未裁决）
- 新增 e68：teapawt.org（未裁决）
- 新增 e69：teapaw.org（未裁决）
- 新增 e70：d420.net（未裁决）
- 新增 e71：429s from X are watched. When they start, more accounts and proxy IPs go into rotation.（未裁决）

### The Undeniable Utility Of CSS :has • Josh W. Comeau

- 新增 e195：Intended audience（未裁决）
- 新增 e197：This blog post is intended for developers who are already comfortable with the fundamentals of CSS, but no prior experience with :has is expected.（未裁决）
- 新增 e199：Parts of this blog post are specifically written for fellow JavaScript developers who use a framework like React/Vue/Angular, but this blog post should still be very useful even if you’ve never writte…（未裁决）
- 减少 e216：Code Playground（已有用户裁决：exclude）
- 减少 e498：Code Playground（已有用户裁决：exclude）
- 新增 e1015：Why not use :focus-within ?（未裁决）
- 新增 e1018：:focus-within is a pseudo-class that selects an element which contains a focused descendant. It allows us to do something quite similar:（未裁决）
- 新增 e1052：The :focus-within pseudo-class has been around much longer than :has , and so it has . Seems like a better approach, no?（未裁决）
- 新增 e1055：significantly better browser support (opens in new tab)（未裁决）
- 新增 e1075：I don’t want to show the focus outline when any descendant is focused, I only want it to apply when a button is focused. Some of the cards contain focusable links:（未裁决）
- 新增 e1084：If I used :focus-within , it wouldn't be clear to the user which interactive child is actually focused!（未裁决）
- 新增 e1087：Ultimately, :focus-within can be useful, but it’s a pretty coarse tool. We have much finer control using :has .（未裁决）
- 新增 e1625：What about performance?（未裁决）
- 新增 e1627：You might be wondering about the performance implications of this strategy. With :has on the root HTML tag, doesn't that mean that the browser would have to inspect the entire DOM in order to tell if …（未裁决）
- 新增 e1630：I decided to test this using the new in the Chrome devtools.（未裁决）
- 新增 e1631：“Selector Stats” feature (opens in new tab)（未裁决）
- 新增 e1640：On this blog post, with more than 2500 DOM nodes, this selector took an average of 0.1 milliseconds (0.0001 seconds) to resolve. I performed this test on one of the slowest computers I've ever used in…（未裁决）
- 新增 e1641：Browsers are really good at doing style recalculation. This isn't something we need to worry about. 😄（未裁决）
- 减少 e1779：Code Playground（已有用户裁决：exclude）
- 减少 e1976：Code Playground（已有用户裁决：exclude）
- 减少 e2157：Code Playground（已有用户裁决：exclude）
- 减少 e2358：Code Playground（已有用户裁决：exclude）
- 新增 e2866：Alternative control schemes（未裁决）
- 新增 e2868：If you’re reading this blog post on a mobile/tablet device and don't have a mouse to hover with, you can alternatively tap the category buttons to trigger the same effect. And if you’re a keyboard use…（未裁决）
- 新增 e2869：The CSS for these alternative control schemes can be found at the bottom of the "CSS" tab.（未裁决）
- 新增 e2975：Sets the category data attribute to "sci-fi" , and（已有用户裁决：translate）
- 减少 e3277：Last updated on（已有用户裁决：exclude）
- 减少 e3278：September 9th, 2024（已有用户裁决：exclude）
- 减少 e3280：# of hits（已有用户裁决：exclude）

## 结果读取与边界

运行 pnpm review:reading，在 http://127.0.0.1:4188 打开页面；新增成功样本已固定有效发布基线，当前分支结果可直接查看高亮差异。正文完整内容、译文和全页截图位于仓库同级 OnlyTranslate-review-data；JSON 元数据和本报告进入仓库管理，完整网页内容不入库。

本轮保留采集时的渲染状态，不代表历史 fixture 的故障现场仍在线，也不表示虚拟化楼层、开放 Shadow DOM、iframe 或需登录状态已覆盖。原五页的关注状态未重新采集；新采集中的资源遗漏数单独保留。需要进一步交互或特殊状态的样本应后续另建状态，不以当前页面通过代替。

本轮使用发布版和当前分支各自默认的站点规则，未进行关闭规则的独立对照，不能据此退役站点规则。实翻未完成的已有 run.json 在机器索引 incompleteBaselineRuns 中保留身份和进度；失败任务及原始产物仍留在本地，不计入完整配对。

只读浏览器核对：总览加载69个登记页面，nanobot Security显示减少5块，详情绑定v1.15.0基线。评审台现有显示限制：只有候选而没有完整发布基线的行也可能显示 +0/−0，不能将它解读为零差异；以“发布版实翻”列和本报告完整配对清单为准。本轮识别代码未动；采集工具的完成统计改为按可验证原文位置覆盖计数，见下文。

采集沿用现有工具的 zh-CN 浏览器 locale，发布基线仍固定 en→zh-Hans。例如本次 Exercism 归档 HTML 的 lang=zh-CN、正文为中文，没有扩展译文标记；它的实翻未完成，不计入合格基线。本轮未为个别页面更改发布设置，后续如需英文状态，应另采新快照并单独记录设置。

## 采集完成统计的小修正

采样暴露出按初始节点标记计数的限制：实际扩展可能用其他宿主覆盖同一批原文。新增 completion.mjs 仅将已标记宿主可证明完整覆盖的原文位置计入完成；重复文字靠不同位置ID区分，部分覆盖和无锚点且未处理的目标仍不算完成，零目标也不放行。队列清空、无失败、连续稳定检查仍保留。旧运行不改写；新运行记录 source-coverage-v1、判定代码摘要、直接处理数、覆盖数与由其他宿主覆盖的数量。发布ZIP和识别采集器均未改变。

YNarwal旧运行初步统计曾被误读为9个目标都已覆盖，按原文ID重新计算后实际只有2个可证明覆盖，另7个没有位置锚点；该页依旧不合格，不会因此放行。completion-evidence.json保留真实旧运行与新统计的只读诊断。新增7项隔离单元测试，包含“部分覆盖加上无锚点目标仍未完成”的反例。

## 原五页的发布版重新核验

状态：complete。在原快照上重新准备经核验的发布输入并执行实翻，补齐修复缓存信任问题之后的基线来源。本批报告使用新核验成功的运行作为对照；旧运行、旧固定选择及裁决不改写。界面仍保留用户原固定选择，新实翻在历史记录中可选。下面只比较原文覆盖，不宣称两次译文内容一致。

| 页面 | 旧发布运行 | 新发布运行 | 两次原文覆盖新增/减少 |
| --- | --- | --- | --- |
| teapaw-home | release-1794406600722-b5903f | release-1794639475151-835acc | +0 / -0 |
| ziggit-topic | release-1794406767840-90d77e | release-1794639505220-6a0789 | +0 / -0 |
| lil-log-home | release-1794406727677-5f33e7 | release-1794639535476-b85b5b | +0 / -0 |
| josh-css-has | release-1794408848422-a3be7f | release-1794639565512-460d17 | +0 / -0 |
| python-appetite | release-1794406809997-fd7a26 | release-1794639609962-e57e63 | +0 / -0 |

## 全页截图失败时保留实翻数据

Wikipedia首次已处理724/724目标、观察到684条译文且无待处理/失败，随后全页截图报错，旧保存顺序导致没有写出run.json。已改为先以不完整状态写入实际目标、译文和进度，再保存HTML并尝试全页截图（仍为fullPage:true，最多60秒）；截图失败保留数据和artifacts失败原因，状态仍为incomplete，不算合格基线。产物成功也不会把实翻未完成的运行提升为完整。新增3项隔离回归；两个工具测试文件共16项通过。旧失败记录没有补写或伪造译文。

Wikipedia同快照重试：complete，release-1794639642333-032b99。

## 最终验证

- pnpm verify：类型检查通过，147个测试文件、1496项测试通过。
- pnpm test:reading：13项人工要求中11满足、2未满足且已接受、0阻断；报告 OnlyTranslate-review-data/checks/check-1794640050990-aea8d928/report.json。
- 53份归档快照的HTML及已归档资源摘要有效；41份完整配对的82张PNG截图存在且边界完整，摘要已保存。机器证据 tests/corpus/batches/existing-test-urls-20261114.validation.json。
- 评审台最终只读核对：69页登记、41份完整基线与候选配对、+38/-44、无剩余任务。
- 原五页的固定选择均未改；人工裁决、已接受限制、官方ZIP和识别源码摘要均保持。没有新建分支、提交、push、合并或发布。
