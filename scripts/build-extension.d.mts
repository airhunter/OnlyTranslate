export function runNode(script: string, args: string[], root: string): Promise<void>
export function buildExtension(args: string[], options?: { root?: string; run?: typeof runNode }): Promise<void>
