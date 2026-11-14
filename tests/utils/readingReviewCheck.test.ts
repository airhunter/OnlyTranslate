// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { checkCorpus } from '../../scripts/reading-review/check.mjs'
import { enforceReadingCheck } from '../../scripts/reading-review/build-gate.mjs'
import { hash, writeJson } from '../../scripts/reading-review/model.mjs'

const folders: string[] = []
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true })
})

async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), 'reading-review-check-'))
  folders.push(folder)
  const data = join(folder, 'data'), corpus = join(folder, 'corpus')
  const text = 'This is the first complete sentence. This explains the second part.'
  const html = '<html><body><p>This is the first complete sentence. <em>This explains the second part.</em></p><a>Buy</a></body></html>'
  const snapshot = { schemaVersion: 1, id: 'snapshot-old', pageId: 'sample', url: 'https://example.org/article', htmlHash: hash(html), assets: [], viewport: { width: 1440, height: 950 }, scrollY: 0,
    catalogue: { texts: [{ id: 't1', text: 'This is the first complete sentence.' }, { id: 't2', text: 'This explains the second part.' }, { id: 't3', text: 'Buy' }], blocks: [
      { id: 'e1', text, textIds: ['t1', 't2'], visible: true }, { id: 'e2', text: 'Buy', textIds: ['t3'], visible: true },
    ] } }
  const decision = { blockId: 'e1', snapshotId: snapshot.id, textHash: hash(text), verdict: 'translate', confirmed: true, reviewer: 'user', specification: 1, note: '测试用标注', id: 'decision-1' }
  const historyPath = join(corpus, 'decisions/sample.json')
  const snapshotPath = join(data, 'snapshots/sample', snapshot.id, 'snapshot.json')
  await writeJson(join(corpus, 'pages.json'), { schemaVersion: 1, pages: [{ id: 'sample', url: snapshot.url }] })
  await writeJson(join(corpus, 'check-policy.json'), { schemaVersion: 1, annotationPolicyVersion: 1, minimumConfirmed: 1 })
  await writeJson(historyPath, [decision])
  await writeJson(snapshotPath, snapshot)
  await writeFile(join(data, 'snapshots/sample', snapshot.id, 'source.html'), html)
  // An older annotated snapshot must still be checked, regardless of this pointer.
  await writeJson(join(data, 'snapshots/sample/latest.json'), { id: 'snapshot-new-unannotated' })
  const build = { sourceHash: hash('current-sources'), commit: 'test-commit' }
  const replay = vi.fn(async () => ({ build, targets: [{ textIds: ['t1'] }, { textIds: ['t2'] }], stats: { scannedElements: 3 } }))
  const runner = { build, replay, bundleHash: hash('bundle'), unchanged: vi.fn(async () => true), close: vi.fn(async () => {}) }
  const options = { root: resolve('.'), dataRoot: data, paths: { manifest: join(corpus, 'pages.json'), decisions: join(corpus, 'decisions') }, policyPath: join(corpus, 'check-policy.json'), log: () => {}, createRunner: vi.fn(async () => runner) }
  return { folder, data, corpus, snapshot, snapshotPath, historyPath, decision, runner, options }
}

async function acceptIssue(f: Awaited<ReturnType<typeof fixture>>) {
  const issue = { id: 'known-issue-1', pageId: 'sample', snapshotId: f.snapshot.id, blockId: 'e1',
    decisionId: f.decision.id, specification: 1, expectedVerdict: 'translate', htmlHash: f.snapshot.htmlHash,
    textHash: f.decision.textHash, acceptedSelectedTextIds: [] as string[], status: 'accepted', revision: 1,
    reviewer: 'user', confirmedAt: '2026-11-14', reason: '仅测试：用户接受当前已知限制' }
  const path = join(f.corpus, 'accepted-issues.json')
  await writeJson(path, { schemaVersion: 1, issues: [issue] })
  f.runner.replay.mockResolvedValue({ build: f.runner.build, targets: [], stats: { scannedElements: 3 } })
  return { issue, path }
}

describe('saved human decisions as a build requirement', () => {
  it('keeps the unmet verdict visible but permits only an explicitly accepted known issue', async () => {
    const f = await fixture()
    await acceptIssue(f)
    const report = await checkCorpus(f.options)
    expect(report).toMatchObject({ ok: true, confirmed: 1, satisfied: 0, violations: 1, acceptedIssues: 1, blockingViolations: 0 })
    expect(report.pages[0]).toMatchObject({ status: 'accepted-known-issues', violations: [expect.objectContaining({ blocking: false })] })
    expect(JSON.parse(await readFile(f.historyPath, 'utf8'))).toEqual([f.decision])
  })
  it('does not waive another block, a different failure, a new decision, or a revoked acceptance', async () => {
    const f = await fixture(), { issue, path } = await acceptIssue(f)
    await writeJson(f.historyPath, [f.decision, { ...f.decision, id: 'second', blockId: 'e2', textHash: hash('Buy') }])
    const other = await checkCorpus(f.options)
    expect(other).toMatchObject({ ok: false, violations: 2, acceptedIssues: 1, blockingViolations: 1 })
    await writeJson(f.historyPath, [f.decision])
    f.runner.replay.mockResolvedValueOnce({ build: f.runner.build, targets: [{ textIds: ['t1'] }], stats: { scannedElements: 3 } })
    expect(await checkCorpus(f.options)).toMatchObject({ ok: false, acceptedIssues: 0, blockingViolations: 1 })
    await writeJson(f.historyPath, [f.decision, { ...f.decision, id: 'new-decision' }])
    expect(await checkCorpus(f.options)).toMatchObject({ ok: false, acceptedIssues: 0, blockingViolations: 1 })
    await writeJson(f.historyPath, [f.decision])
    await writeJson(path, { schemaVersion: 1, issues: [issue, { ...issue, status: 'revoked', revision: 2 }] })
    expect(await checkCorpus(f.options)).toMatchObject({ ok: false, acceptedIssues: 0, blockingViolations: 1 })
  })
  it('never uses an accepted issue to bypass missing data, stale anchors, or malformed confirmations', async () => {
    const f = await fixture(), { issue, path } = await acceptIssue(f)
    await writeJson(path, { schemaVersion: 1, issues: [{ ...issue, reason: '' }] })
    expect((await checkCorpus(f.options)).errors[0]).toContain('有效的用户确认')
    await writeJson(path, { schemaVersion: 1, issues: [issue] })
    await writeJson(f.historyPath, [{ ...f.decision, textHash: hash('changed text') }])
    expect((await checkCorpus(f.options)).pages[0].errors[0]).toContain('原文定位或摘要失效')
    await writeJson(f.historyPath, [f.decision])
    await rm(f.snapshotPath)
    expect((await checkCorpus(f.options)).pages[0].errors[0]).toContain('ENOENT')
    expect(f.options.createRunner).not.toHaveBeenCalled()
  })
  it('rejects mismatched snapshot and source bindings, and stops counting a resolved issue as unmet', async () => {
    const f = await fixture(), { issue, path } = await acceptIssue(f)
    for (const changed of [{ pageId: 'unknown-page' }, { snapshotId: 'another-snapshot' }, { htmlHash: hash('other snapshot') }, { textHash: hash('other text') }, { specification: 2 }]) {
      await writeJson(path, { schemaVersion: 1, issues: [{ ...issue, ...changed }] })
      expect((await checkCorpus(f.options)).ok).toBe(false)
    }
    await writeJson(path, { schemaVersion: 1, issues: [issue] })
    f.runner.replay.mockResolvedValueOnce({ build: f.runner.build, targets: [{ textIds: ['t1', 't2'] }], stats: { scannedElements: 3 } })
    expect(await checkCorpus(f.options)).toMatchObject({ ok: true, satisfied: 1, violations: 0, acceptedIssues: 0 })
  })
  it('includes acceptance history in the input fingerprint', async () => {
    const f = await fixture(), { issue, path } = await acceptIssue(f)
    f.runner.unchanged.mockImplementationOnce(async () => {
      await writeJson(path, { schemaVersion: 1, issues: [issue, { ...issue, status: 'revoked', revision: 2 }] })
      return true
    })
    const report = await checkCorpus(f.options)
    expect(report.ok).toBe(false)
    expect(report.errors[0]).toContain('人工裁决发生变化')
  })
  it('checks an older snapshot using fresh coverage, stores a report and a reviewable candidate', async () => {
    const f = await fixture()
    const report = await checkCorpus(f.options)
    expect(report).toMatchObject({ ok: true, confirmed: 1, satisfied: 1, violations: 0 })
    expect(f.runner.replay).toHaveBeenCalledWith(f.snapshot, 'sample')
    expect(f.runner.close).toHaveBeenCalledOnce()
    expect(JSON.parse(await readFile(report.reportPath, 'utf8')).corpusHash).toHaveLength(64)
    const run = JSON.parse(await readFile(join(f.data, 'runs/sample', report.pages[0].runId, 'run.json'), 'utf8'))
    expect(run).toMatchObject({ snapshotId: f.snapshot.id, origin: 'build-check', kind: 'candidate' })
    expect(JSON.parse(await readFile(f.historyPath, 'utf8'))).toEqual([f.decision])
  })
  it('fails for partial coverage and selected excluded text, while either is accepted', async () => {
    const f = await fixture()
    await writeJson(f.historyPath, [f.decision, { ...f.decision, blockId: 'e2', textHash: hash('Buy'), verdict: 'exclude' }])
    f.runner.replay.mockResolvedValue({ build: f.runner.build, targets: [{ textIds: ['t1', 't3'] }], stats: { scannedElements: 3 } })
    const report = await checkCorpus(f.options)
    expect(report).toMatchObject({ ok: false, confirmed: 2, violations: 2 })
    expect(report.pages[0].violations).toEqual(expect.arrayContaining([expect.objectContaining({ blockId: 'e1', selectedTextNodes: 1 }), expect.objectContaining({ blockId: 'e2', expected: 'exclude' })]))
    await writeJson(f.historyPath, [{ ...f.decision, verdict: 'either' }])
    expect((await checkCorpus(f.options)).ok).toBe(true)
  })
  it('respects a pending revision without reusing the previous confirmed answer', async () => {
    const f = await fixture()
    await writeJson(f.historyPath, [f.decision, { ...f.decision, verdict: 'pending', confirmed: false }])
    const report = await checkCorpus(f.options)
    expect(report).toMatchObject({ ok: false, confirmed: 0 })
    expect(f.options.createRunner).not.toHaveBeenCalled()
  })
  it('does not silently skip a missing historical snapshot', async () => {
    const f = await fixture()
    await rm(f.snapshotPath)
    const report = await checkCorpus(f.options)
    expect(report.ok).toBe(false)
    expect(report.pages[0].errors[0]).toContain('ENOENT')
    expect(f.options.createRunner).not.toHaveBeenCalled()
  })
  it('rejects a stale annotation anchor or policy version instead of counting it as a pass', async () => {
    const f = await fixture()
    await writeJson(f.historyPath, [{ ...f.decision, textHash: hash('different source') }])
    expect((await checkCorpus(f.options)).pages[0].errors[0]).toContain('原文定位或摘要失效')
    await writeJson(f.historyPath, [{ ...f.decision, specification: 2 }])
    expect((await checkCorpus(f.options)).errors[0]).toContain('规范版本')
    expect(f.options.createRunner).not.toHaveBeenCalled()
  })
  it('requires the snapshot source and every archived asset to match their hashes', async () => {
    const f = await fixture()
    await writeFile(join(f.data, 'snapshots/sample', f.snapshot.id, 'source.html'), 'changed')
    expect((await checkCorpus(f.options)).pages[0].errors[0]).toContain('快照内容摘要')
    // A matching HTML file cannot hide a corrupted archived stylesheet.
    f.snapshot.htmlHash = hash('changed')
    const asset = { url: 'https://example.org/style.css', type: 'text/css', hash: hash('expected style') }
    await writeJson(f.snapshotPath, { ...f.snapshot, assets: [asset] })
    await mkdir(join(f.data, 'assets'), { recursive: true })
    await writeFile(join(f.data, 'assets', asset.hash), 'incorrect style')
    expect((await checkCorpus(f.options)).pages[0].errors[0]).toContain('归档资源摘要')
    expect(f.options.createRunner).not.toHaveBeenCalled()
  })
  it('rejects invalid histories and unknown pages even if other answers would pass', async () => {
    const f = await fixture()
    await writeJson(join(f.corpus, 'decisions/unknown-page.json'), [f.decision])
    expect((await checkCorpus(f.options)).errors[0]).toContain('已登记页面')
    await rm(join(f.corpus, 'decisions/unknown-page.json'))
    await writeJson(f.historyPath, [{ ...f.decision, verdict: 'translate', confirmed: false }])
    expect((await checkCorpus(f.options)).errors[0]).toContain('无效人工裁决')
  })
  it('fails if replay throws, returns another build, or has unknown text positions', async () => {
    const f = await fixture()
    f.runner.replay.mockRejectedValueOnce(new Error('回放身份校验失败'))
    expect((await checkCorpus(f.options)).pages[0].errors).toContain('回放身份校验失败')
    f.runner.replay.mockResolvedValueOnce({ build: { ...f.runner.build, sourceHash: 'old' }, targets: [], stats: { scannedElements: 3 } })
    expect((await checkCorpus(f.options)).pages[0].errors[0]).toContain('本次源码不匹配')
    f.runner.replay.mockResolvedValueOnce({ build: f.runner.build, targets: [{ textIds: ['unknown'] }], stats: { scannedElements: 3 } })
    expect((await checkCorpus(f.options)).pages[0].errors[0]).toContain('无法定位')
  })
  it('invalidates results if source or user decisions change during a check', async () => {
    const f = await fixture()
    f.runner.unchanged.mockResolvedValueOnce(false)
    const changed = await checkCorpus(f.options)
    expect(changed.ok).toBe(false)
    expect(changed.errors[0]).toContain('源码发生变化')
    expect(JSON.parse(await readFile(join(f.data, 'runs/sample', changed.pages[0].runId, 'validation.json'), 'utf8')).valid).toBe(false)
    f.runner.unchanged.mockImplementationOnce(async () => {
      await writeJson(f.historyPath, [f.decision, { ...f.decision, verdict: 'exclude' }])
      return true
    })
    expect((await checkCorpus(f.options)).errors[0]).toContain('人工裁决发生变化')
  })
  it('rejects snapshot metadata changes during checking', async () => {
    const f = await fixture()
    f.runner.unchanged.mockImplementationOnce(async () => {
      await writeJson(f.snapshotPath, { ...f.snapshot, url: 'https://example.org/another' })
      return true
    })
    expect((await checkCorpus(f.options)).errors[0]).toContain('快照元数据发生变化')
  })
})

describe('WXT build gate', () => {
  it('skips only serve and propagates failures for every formal command', async () => {
    const run = vi.fn(async () => { throw new Error('人工要求未通过') })
    await enforceReadingCheck('serve', 'root', run)
    expect(run).not.toHaveBeenCalled()
    for (const command of ['build', 'zip', 'unknown']) await expect(enforceReadingCheck(command, 'root', run)).rejects.toThrow('人工要求未通过')
  })
  it('launches the child process and accepts only a zero exit status', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'reading-review-gate-'))
    folders.push(folder)
    // The fixture CLI exits unsuccessfully; real production uses the same child exit handling.
    await mkdir(join(folder, 'scripts/reading-review'), { recursive: true })
    await writeFile(join(folder, 'scripts/reading-review/check.mjs'), "console.error('missing corpus');process.exitCode=1")
    await expect(enforceReadingCheck('build', folder)).rejects.toThrow('正式构建已停止')
    await writeFile(join(folder, 'scripts/reading-review/check.mjs'), 'process.exitCode=0')
    await expect(enforceReadingCheck('build', folder)).resolves.toBeUndefined()
  })
})
