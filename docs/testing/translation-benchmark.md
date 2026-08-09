# 翻译性能基准测试

真实模型的响应时间会受网络、服务商负载和限流影响，因此本测试是手动、可选的真实接口基准，不进入常规 CI。

`v1.3.0` 和 `v1.5.0` profile 根据对应 Git tag 重现当时的单条翻译请求参数，用于隔离观察「接口／模型」耗时。它们不会启动旧版扩展，因此不包含旧版的 DOM 扫描、并发队列、重试和译文插入耗时。整体用户体感需要结合扩展诊断数据判断。

## 准备配置

在扩展的「设置 → 通用 → 导出完整配置 JSON」中导出配置。导出文件包含 API 密钥，应只保存在本地，不要提交到 Git、发送给他人或作为基准结果的一部分。

先执行不发起网络请求的检查：

```bash
pnpm benchmark:translation -- \
  --config /path/to/only-translate-config.json \
  --profiles v1.3.0,v1.5.0,current \
  --dry-run
```

`--dry-run` 只显示服务、模型、接口主机和影响性能的请求参数，不显示密钥、原文、提示词或完整端点。

## 比较版本请求策略

```bash
pnpm benchmark:translation -- \
  --config /path/to/only-translate-config.json \
  --profiles v1.3.0,v1.5.0,current \
  --runs 5 \
  --warmup 1 \
  --label deepseek-version-comparison
```

默认使用配置中当前选中的服务。如果配置中同时保存了多个服务的密钥，可以重复传入 `--service`：

```bash
pnpm benchmark:translation -- \
  --config /path/to/only-translate-config.json \
  --service deepseek \
  --service custom_bailian \
  --profiles v1.3.0,v1.5.0,current
```

`custom_bailian` 需替换为导出配置中实际的自定义服务 ID。多个版本策略会按轮换顺序执行，减少固定执行顺序带来的偏差。

每个服务会发起 `profile 数 ×（预热次数 + 正式次数）` 个真实请求，可能产生模型调用费用。上述默认对比会对每个服务发起 18 个请求。

## 结果指标

默认在 `benchmark-results/` 下生成权限为仅当前用户可读写的 JSON 和 CSV，该目录已加入 `.gitignore`。结果不包含密钥、原文、提示词和译文。

- `headersMs`：收到 HTTP 响应头的时间。
- `firstByteMs`：收到响应体第一个字节的时间。
- `totalMs`：完整读取并验证响应的时间。
- `p50` 和 `p95`：只根据成功的正式运行计算，不包含预热和失败请求。

扩展当前使用非流式请求，所以 `firstByteMs` 是服务商返回 HTTP 响应体的首字节时间，不是用户看到首段译文的时间。扩展侧的首次可见时间应以用户可选提交的最近翻译诊断为准。

## 降低波动

- 使用同一份配置、同一段文案和同一目标语言。
- 每组至少预热 1 次、正式运行 5 次；重要发布可增加到 10 次。
- 在同一网络、相近时间执行完所有对比组。
- 同时查看失败数和错误类型，不要只比较延迟百分位。
