import { Config } from '@/entrypoints/utils/model'

describe('Config', () => {
  it('should create Config instance with on property set to true', () => {
    const config = new Config()
    expect(config.on).toBe(true)
  })

  it('should create Config instance with service property as string', () => {
    const config = new Config()
    expect(typeof config.service).toBe('string')
  })
})