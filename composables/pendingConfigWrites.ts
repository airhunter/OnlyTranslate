interface PendingWrite {
  count: number
  expiresAt: number
}

export class PendingConfigWrites {
  private readonly values = new Map<string, PendingWrite>()

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 10_000,
  ) {}

  remember(json: string): void {
    this.prune()
    const current = this.values.get(json)
    this.values.set(json, {
      count: (current?.count ?? 0) + 1,
      expiresAt: this.now() + this.ttlMs,
    })
  }

  consume(json: string): boolean {
    this.prune()
    const current = this.values.get(json)
    if (!current) return false
    if (current.count <= 1) this.values.delete(json)
    else this.values.set(json, { ...current, count: current.count - 1 })
    return true
  }

  private prune(): void {
    const now = this.now()
    for (const [json, pending] of this.values) {
      if (pending.expiresAt <= now) this.values.delete(json)
    }
  }
}
