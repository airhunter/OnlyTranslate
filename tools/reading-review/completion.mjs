// Translation can process a wrapping host instead of each initially collected child.
// Count original text positions covered by marked hosts, never matching by text alone.
export function translationCoverage(targets, observation) {
  if (targets.length !== observation.items.length) throw new Error('实翻观察与原始目标数量不匹配')
  const covered = new Set(observation.unexpectedTargets.flatMap(target => target.textIds))
  observation.items.forEach((item, index) => {
    if (typeof item.attempted !== 'boolean') throw new Error('实翻观察缺少处理状态')
    if (item.attempted) for (const id of targets[index].textIds) covered.add(id)
  })
  const coveredTargets = targets.filter((target, index) => observation.items[index].attempted
    || (target.textIds.length > 0 && target.textIds.every(id => covered.has(id)))).length
  const directlyAttempted = observation.items.filter(item => item.attempted).length
  return { coveredTargets, completedByCoveringHost: coveredTargets - directlyAttempted,
    coverageComplete: targets.length > 0 && coveredTargets === targets.length }
}
