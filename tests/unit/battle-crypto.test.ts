import { describe, expect, it } from 'vitest'
import { createKey, isKey, randomId, seal, unseal } from '~/utils/battle/crypto'

describe('createKey / isKey', () => {
  it('creates a url-safe 22 character key', () => {
    const key = createKey()
    expect(key).toMatch(/^[\w-]{22}$/)
    expect(isKey(key)).toBe(true)
  })

  it('rejects invalid keys', () => {
    expect(isKey('short')).toBe(false)
    expect(isKey(undefined)).toBe(false)
    expect(isKey('!'.repeat(22))).toBe(false)
  })
})

describe('randomId', () => {
  it('produces unique ids of the requested size', () => {
    expect(randomId()).toHaveLength(12)
    expect(randomId()).not.toBe(randomId())
  })
})

describe('seal / unseal', () => {
  it('round-trips data with the same key', async () => {
    const key = createKey()
    const payload = await seal(key, { a: 1, b: ['é'] })
    expect(payload).not.toContain('é')
    await expect(unseal(key, payload)).resolves.toEqual({ a: 1, b: ['é'] })
  })

  it('uses a fresh iv every time', async () => {
    const key = createKey()
    expect(await seal(key, 'x')).not.toBe(await seal(key, 'x'))
  })

  it('rejects a wrong key or tampered payload', async () => {
    const payload = await seal(createKey(), 'secret')
    await expect(unseal(createKey(), payload)).rejects.toThrow()
    await expect(unseal(createKey(), `${payload.slice(0, -2)}AA`)).rejects.toThrow()
  })
})
