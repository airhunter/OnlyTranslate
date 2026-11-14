// @vitest-environment node
import { expect, it } from 'vitest'
import { translationCoverage } from '../completion.mjs'

it('accepts a marked parent that completely covers the original child targets', () => {
  expect(translationCoverage([{textIds:['t1']},{textIds:['t2','t3']}], {
    items:[{attempted:false},{attempted:false}], unexpectedTargets:[{textIds:['t1','t2','t3']}]
  })).toEqual({coveredTargets:2,completedByCoveringHost:2,coverageComplete:true})
})

it('keeps a partly covered child incomplete', () => {
  expect(translationCoverage([{textIds:['t1']},{textIds:['t2','t3']}], {
    items:[{attempted:true},{attempted:false}], unexpectedTargets:[{textIds:['t2']}]
  })).toEqual({coveredTargets:1,completedByCoveringHost:0,coverageComplete:false})
})

it('does not confuse repeated text at different original positions', () => {
  expect(translationCoverage([{textIds:['t1']},{textIds:['t2']}], {
    items:[{attempted:true},{attempted:false}], unexpectedTargets:[{textIds:['t1','t1']}]
  }).coverageComplete).toBe(false)
})

it('never qualifies an empty collection or an unmarked target without source anchors', () => {
  expect(translationCoverage([], {items:[],unexpectedTargets:[]}).coverageComplete).toBe(false)
  expect(translationCoverage([{textIds:[]}], {items:[{attempted:false}],unexpectedTargets:[{textIds:['unrelated']}]}).coverageComplete).toBe(false)
})

it('preserves directly processed targets that legitimately insert no translation', () => {
  expect(translationCoverage([{textIds:[]}], {items:[{attempted:true}],unexpectedTargets:[]}))
    .toEqual({coveredTargets:1,completedByCoveringHost:0,coverageComplete:true})
})

it('keeps a page incomplete when a covered child is accompanied by an unanchored unprocessed target', () => {
  expect(translationCoverage([{textIds:['t1']},{textIds:['t2']},{textIds:[]}], {
    items:[{attempted:true},{attempted:false},{attempted:false}], unexpectedTargets:[{textIds:['t2']}]
  })).toEqual({coveredTargets:2,completedByCoveringHost:1,coverageComplete:false})
})

it('rejects missing or misaligned observations', () => {
  expect(() => translationCoverage([{textIds:['t1']}], {items:[],unexpectedTargets:[]})).toThrow('数量不匹配')
  expect(() => translationCoverage([{textIds:['t1']}], {items:[{} as {attempted:boolean}],unexpectedTargets:[]})).toThrow('处理状态')
})
