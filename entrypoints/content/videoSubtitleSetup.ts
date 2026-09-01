const supportedVideoHosts = [
  'youtube.com',
  'youtubekids.com',
  'udemy.com',
  'coursera.org',
  'khanacademy.org',
] as const

interface VideoSubtitleModule {
  initVideoSubtitle(): void
}

export function isSupportedVideoSubtitleHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return supportedVideoHosts.some(host => normalized === host || normalized.endsWith(`.${host}`))
}

export async function setupVideoSubtitle(
  hostname: string = window.location.hostname,
  loadModule: () => Promise<VideoSubtitleModule> = () => import('@/entrypoints/video/manager')
): Promise<boolean> {
  if (!isSupportedVideoSubtitleHost(hostname)) return false

  const module = await loadModule()
  module.initVideoSubtitle()
  return true
}
