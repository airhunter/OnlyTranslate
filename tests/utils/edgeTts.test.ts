import { describe, expect, it } from 'vitest'
import { edgeTtsInternals } from '@/entrypoints/utils/edgeTts'

describe('edgeTts', () => {
  it('escapes text and removes invalid XML control characters in SSML', () => {
    const ssml = edgeTtsInternals.buildSsml('A & <B>\u0001', 'en-US-AvaMultilingualNeural')

    expect(ssml).toContain('A &amp; &lt;B&gt;')
    expect(ssml).not.toContain('\u0001')
    expect(ssml).toContain('voice name="en-US-AvaMultilingualNeural"')
  })

  it('splits multibyte input without exceeding the Edge request limit', () => {
    const chunks = edgeTtsInternals.splitText('你好，世界。'.repeat(500))
    const encoder = new TextEncoder()

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every(chunk => encoder.encode(chunk).byteLength <= 1800)).toBe(true)
    expect(chunks.join('')).toBe('你好，世界。'.repeat(500))
  })

  it('matches voice gender only after matching the text language', () => {
    const voices = [
      { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', lang: 'zh-CN', gender: 'Female' },
      { id: 'zh-CN-YunxiNeural', name: '云希', lang: 'zh-CN', gender: 'Male' },
      { id: 'ja-JP-NanamiNeural', name: '七海', lang: 'ja-JP', gender: 'Female' },
    ]

    expect(edgeTtsInternals.chooseVoice(voices, 'zh-CN', 'female')?.id).toBe('zh-CN-XiaoxiaoNeural')
    expect(edgeTtsInternals.chooseVoice(voices, 'zh-CN', 'male')?.id).toBe('zh-CN-YunxiNeural')
    expect(edgeTtsInternals.chooseVoice(voices, 'ja-JP', 'male')?.id).toBe('ja-JP-NanamiNeural')
  })

  it('prioritizes an exact locale over a different locale with a preferred voice type or gender', () => {
    const voices = [
      { id: 'en-AU-WilliamMultilingualNeural', name: 'William', lang: 'en-AU', gender: 'Male' },
      { id: 'en-US-JennyNeural', name: 'Jenny', lang: 'en-US', gender: 'Female' },
    ]

    expect(edgeTtsInternals.chooseVoice(voices, 'en-US')?.id).toBe('en-US-JennyNeural')
    expect(edgeTtsInternals.chooseVoice(voices, 'en-US', 'male')?.id).toBe('en-US-JennyNeural')
    expect(edgeTtsInternals.chooseVoice([...voices].reverse(), 'EN-us')?.id).toBe('en-US-JennyNeural')
  })

  it('applies gender and voice preferences within the exact locale', () => {
    const voices = [
      { id: 'en-AU-WilliamMultilingualNeural', name: 'William', lang: 'en-AU', gender: 'Male' },
      { id: 'en-US-GuyNeural', name: 'Guy', lang: 'en-US', gender: 'Male' },
      { id: 'en-US-AndrewMultilingualNeural', name: 'Andrew', lang: 'en-US', gender: 'Male' },
      { id: 'en-US-JennyNeural', name: 'Jenny', lang: 'en-US', gender: 'Female' },
    ]

    expect(edgeTtsInternals.chooseVoice(voices, 'en-US')?.id).toBe('en-US-AndrewMultilingualNeural')
    expect(edgeTtsInternals.chooseVoice(voices, 'en-US', 'female')?.id).toBe('en-US-JennyNeural')
    expect(edgeTtsInternals.chooseVoice(voices, 'en-GB', 'female')?.id).toBe('en-US-JennyNeural')
  })

  it('does not select an unrelated language when no matching voice is available', () => {
    const voices = [{ id: 'ja-JP-NanamiNeural', name: 'Nanami', lang: 'ja-JP', gender: 'Female' }]
    expect(edgeTtsInternals.chooseVoice(voices, 'en-US')).toBeUndefined()
    expect(edgeTtsInternals.chooseVoice([], 'en-US')).toBeUndefined()
  })
})
