import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { paths, readJson, writeJson, jsonFiles, hash, validId, compare, summarize, acceptedIssuesPath, validateAcceptedIssues } from './model.mjs'
import { browserConfig, openBrowser, closeBrowser, runBrowser, buildCollector, command, fingerprintSources } from './driver.mjs'
import { replayPayload, replayCode } from './replay.mjs'

const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const requireValue = (condition, message) => { if (!condition) throw new Error(message) }

async function loadInputs(p, policyPath) {
  const files = [p.manifest, policyPath, ...(await jsonFiles(p.decisions)).sort().map(file => join(p.decisions, file))]
  const content = await Promise.all(files.map(file => readFile(file, 'utf8')))
  const [manifest, policy, ...histories] = content.map(text => JSON.parse(text))
  const acceptedDocument = await readJson(acceptedIssuesPath(p.decisions), { schemaVersion: 1, issues: [] })
  const acceptedIssues = validateAcceptedIssues(acceptedDocument)
  requireValue(manifest.schemaVersion === 1 && Array.isArray(manifest.pages), '无效网页清单')
  requireValue(policy.schemaVersion === 1 && Number.isInteger(policy.annotationPolicyVersion) && policy.annotationPolicyVersion > 0 && Number.isInteger(policy.minimumConfirmed) && policy.minimumConfirmed >= 1, '无效校验策略，至少需要一项人工确认')
  const pages = new Map()
  for (const page of manifest.pages) {
    requireValue(validId(page.id) && !pages.has(page.id), '网页 ID 无效或重复')
    requireValue(/^https?:$/.test(new URL(page.url).protocol), '网页 URL 必须使用 HTTP(S)')
    pages.set(page.id, page)
  }
  requireValue(acceptedIssues.every(issue => pages.has(issue.pageId)), '已接受问题必须对应已登记页面')
  const groups = []
  for (let index = 0; index < histories.length; index++) {
    const pageId = files[index + 2].split(/[\\/]/).pop().slice(0, -5), history = histories[index]
    requireValue(pages.has(pageId) && Array.isArray(history), '裁决文件必须对应已登记页面：' + pageId)
    const latest = new Map()
    for (const decision of history) {
      requireValue(validId(decision.snapshotId) && validId(decision.blockId) && sha256(decision.textHash), '裁决定位无效：' + pageId)
      requireValue(['translate', 'exclude', 'either', 'pending'].includes(decision.verdict) && decision.confirmed === (decision.verdict !== 'pending') && decision.reviewer === 'user' && Number.isInteger(decision.specification), '无效人工裁决：' + pageId)
      latest.set(decision.snapshotId + '/' + decision.blockId, decision)
    }
    const bySnapshot = new Map()
    for (const decision of latest.values()) {
      if (!decision.confirmed) continue
      requireValue(decision.specification === policy.annotationPolicyVersion, '裁决规范版本需要用户复核：' + pageId)
      if (!bySnapshot.has(decision.snapshotId)) bySnapshot.set(decision.snapshotId, [])
      bySnapshot.get(decision.snapshotId).push(decision)
    }
    for (const [snapshotId, decisions] of bySnapshot) groups.push({ pageId, snapshotId, decisions })
  }
  return { groups, policy, acceptedIssues, digest: hash(JSON.stringify([files.map((file, i) => [file, hash(content[i])]), acceptedDocument])) }
}

function validateSnapshot(snapshot, group) {
  requireValue(snapshot.schemaVersion === 1 && snapshot.id === group.snapshotId && snapshot.pageId === group.pageId && sha256(snapshot.htmlHash), '快照身份不匹配')
  requireValue(/^https?:$/.test(new URL(snapshot.url).protocol) && snapshot.viewport?.width > 0 && snapshot.viewport?.height > 0 && Number.isFinite(snapshot.scrollY), '快照回放参数无效')
  requireValue(Array.isArray(snapshot.assets) && snapshot.assets.every(asset => sha256(asset.hash) && typeof asset.url === 'string' && typeof asset.type === 'string'), '快照资源清单无效')
  requireValue(Array.isArray(snapshot.catalogue?.texts) && Array.isArray(snapshot.catalogue?.blocks), '快照缺少原文索引')
  const texts = new Map(), blocks = new Map(), assigned = new Set()
  for (const text of snapshot.catalogue.texts) {
    requireValue(validId(text.id) && typeof text.text === 'string' && !texts.has(text.id), '原文文本索引无效')
    texts.set(text.id, text.text)
  }
  for (const block of snapshot.catalogue.blocks) {
    requireValue(validId(block.id) && typeof block.text === 'string' && !blocks.has(block.id) && Array.isArray(block.textIds) && block.textIds.length > 0, '原文块索引无效')
    for (const id of block.textIds) {
      requireValue(texts.has(id) && !assigned.has(id), '原文块含未知或重复文本定位')
      assigned.add(id)
    }
    blocks.set(block.id, block)
  }
  requireValue(assigned.size === texts.size, '原文索引有未归属文本')
  for (const decision of group.decisions) {
    const block = blocks.get(decision.blockId)
    requireValue(block && hash(block.text) === decision.textHash, '人工裁决的原文定位或摘要失效：' + decision.blockId)
  }
}

async function createRunner(p, reportId) {
  const sourceHash = await fingerprintSources(p.root)
  const commit = (await command('git', ['rev-parse', 'HEAD'], { cwd: p.root })).trim()
  const build = { kind: 'build-check', commit, sourceHash }
  const bundle = await buildCollector(p, p.root, build, join(p.root, 'output/reading-review-build', reportId, 'collector.js'))
  const browser = await browserConfig(p, null, 'build-check-' + process.pid + '-' + randomUUID().slice(0, 6))
  try { await openBrowser(browser) } catch (error) { await closeBrowser(browser); throw error }
  return {
    build, bundleHash: hash(bundle),
    async replay(snapshot, pageId) {
      const payload = await replayPayload(p, pageId, snapshot, bundle)
      return runBrowser(browser, `async page=>{${replayCode(payload, true)}return await page.evaluate(()=>window.collectReadingReview());}`)
    },
    async unchanged() { return sourceHash === await fingerprintSources(p.root) },
    async close() { await closeBrowser(browser) },
  }
}

// Tests inject only a runner and isolated paths; the CLI always constructs a fresh real collector.
export async function checkCorpus(options = {}) {
  const root = resolve(options.root || fileURLToPath(new URL('../..', import.meta.url)))
  const p = { ...paths(root, options.dataRoot), ...options.paths }
  const policyPath = options.policyPath || join(root, 'tests/corpus/check-policy.json')
  const id = 'check-' + Date.now() + '-' + randomUUID().slice(0, 8)
  const report = { schemaVersion: 1, id, startedAt: new Date().toISOString(), ok: false, confirmed: 0, satisfied: 0, violations: 0, acceptedIssues: 0, blockingViolations: 0, pages: [], errors: [] }
  const reportPath = join(p.data, 'checks', id, 'report.json')
  const log = options.log || console.log
  let inputs, runner
  try {
    inputs = await loadInputs(p, policyPath)
    report.corpusHash = inputs.digest
    report.annotationPolicyVersion = inputs.policy.annotationPolicyVersion
    report.confirmed = inputs.groups.reduce((total, group) => total + group.decisions.length, 0)
    requireValue(report.confirmed >= inputs.policy.minimumConfirmed, '没有足够的已确认人工要求，停止构建')
    // Validate all required snapshots before starting Chromium; latest.json is deliberately unused.
    const samples = []
    for (const group of inputs.groups) {
      const item = { pageId: group.pageId, snapshotId: group.snapshotId, confirmed: group.decisions.length, status: 'error', violations: [], errors: [] }
      report.pages.push(item)
      try {
        const snapshotFile = join(p.snapshots, group.pageId, group.snapshotId, 'snapshot.json')
        const snapshot = await readJson(snapshotFile)
        validateSnapshot(snapshot, group)
        // Check source and all archived resources even when using an injected test runner.
        await replayPayload(p, group.pageId, snapshot, '')
        item.htmlHash = snapshot.htmlHash
        samples.push({ group, item, snapshot, snapshotFile, metadataHash: hash(JSON.stringify(snapshot)) })
      } catch (error) { item.errors.push(error.message) }
    }
    if (samples.length) {
      runner = await (options.createRunner || createRunner)(p, id)
      report.build = runner.build
      report.bundleHash = runner.bundleHash
      for (const { group, item, snapshot } of samples) {
        log('检查人工要求：' + group.pageId + ' / ' + group.snapshotId)
        try {
          const result = await runner.replay(snapshot, group.pageId)
          requireValue(result.build?.sourceHash === runner.build.sourceHash && Array.isArray(result.targets), '采集结果与本次源码不匹配')
          const ids = new Set(snapshot.catalogue.texts.map(text => text.id))
          requireValue(result.targets.every(target => Array.isArray(target.textIds) && target.textIds.every(id => ids.has(id))), '采集结果包含无法定位的原文')
          const compared = compare(snapshot, null, { ...result, snapshotId: snapshot.id }, group.decisions, inputs.acceptedIssues)
          const summary = summarize(compared)
          item.status = summary.blockingViolations ? 'violations' : summary.acceptedIssues ? 'accepted-known-issues' : 'passed'
          item.stats = result.stats
          item.elapsedMs = result.elapsedMs
          item.satisfied = summary.confirmed - summary.violations
          item.acceptedIssues = summary.acceptedIssues
          item.blockingViolations = summary.blockingViolations
          item.violations = compared.filter(block => block.violation).map(block => ({ blockId: block.id, text: block.text, expected: block.decision.verdict, selectedTextNodes: block.newSelected, totalTextNodes: block.textIds.length, note: block.decision.note, decisionId: block.decision.id, acceptedIssue: block.acceptedIssue, blocking: block.blockingViolation }))
          report.satisfied += item.satisfied
          report.violations += item.violations.length
          report.acceptedIssues += item.acceptedIssues
          report.blockingViolations += item.blockingViolations
          for (const violation of item.violations) {
            log(`  [${violation.blocking ? '阻断' : '已接受，不阻断'}] ${violation.blockId} 应${violation.expected === 'translate' ? '翻译' : '排除'}：${violation.text.slice(0, 160)}`)
            if (violation.acceptedIssue) log('    用户确认原因：' + violation.acceptedIssue.reason)
          }
          // Keep this fresh candidate visible in the review workspace; never replace old runs.
          item.runId = id + '-' + group.snapshotId
          await writeJson(join(p.runs, group.pageId, item.runId, 'run.json'), { ...result, schemaVersion: 1, id: item.runId, pageId: group.pageId, snapshotId: group.snapshotId, kind: 'candidate', origin: 'build-check', createdAt: new Date().toISOString(), status: 'complete', bundleHash: runner.bundleHash })
        } catch (error) { item.status = 'error'; item.errors.push(error.message) }
      }
      requireValue(await runner.unchanged(), '校验期间识别源码发生变化，请重新运行')
    }
    requireValue((await loadInputs(p, policyPath)).digest === inputs.digest, '校验期间清单、策略或人工裁决发生变化，请重新运行')
    for (const sample of samples) {
      requireValue(hash(JSON.stringify(await readJson(sample.snapshotFile))) === sample.metadataHash, '校验期间快照元数据发生变化')
      await replayPayload(p, sample.group.pageId, sample.snapshot, '')
    }
  } catch (error) { report.errors.push(error.message) }
  finally {
    if (runner) try { await runner.close() } catch (error) { report.errors.push('关闭校验浏览器失败：' + error.message) }
  }
  report.ok = !report.errors.length && report.confirmed > 0 && report.pages.length > 0 && report.pages.every(page => ['passed', 'accepted-known-issues'].includes(page.status))
  for (const item of report.pages) {
    if (item.runId && (report.errors.length || item.errors.length)) {
      await writeJson(join(p.runs, item.pageId, item.runId, 'validation.json'), { valid: false, reason: [...report.errors, ...item.errors].join('；'), checkedAt: new Date().toISOString() })
    }
  }
  report.finishedAt = new Date().toISOString()
  await writeJson(reportPath, report)
  log(`人工要求 ${report.confirmed} 项，满足 ${report.satisfied} 项，未满足 ${report.violations} 项（已接受 ${report.acceptedIssues} 项，仍阻断 ${report.blockingViolations} 项）；${report.ok ? '发布检查通过' + (report.acceptedIssues ? '（含已接受的已知限制）' : '') : '未通过，禁止正式构建'}`)
  for (const error of [...report.errors, ...report.pages.flatMap(page => page.errors)]) log(error)
  log('报告：' + reportPath)
  return { ...report, reportPath }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = (await checkCorpus()).ok ? 0 : 1 }
  catch (error) { console.error('人工验证集校验无法完成：' + error.message); process.exitCode = 1 }
}
