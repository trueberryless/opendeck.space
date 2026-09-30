import { describe, expect, it, vi } from 'vitest'
import {
  applyLocaleGlobally,
  bindI18n,
  DEFAULT_LOCALE,
  isSupportedLocale,
  langAttr,
  LOCALES,
  localeDir,
  switchLocale,
} from '~/utils/i18n'

describe('locales', () => {
  it('lists forty unique locales with english first', () => {
    expect(LOCALES).toHaveLength(40)
    expect(new Set(LOCALES.map((l) => l.code)).size).toBe(40)
    expect(LOCALES[0]!.code).toBe(DEFAULT_LOCALE)
  })

  it('recognises supported codes', () => {
    expect(isSupportedLocale('de')).toBe(true)
    expect(isSupportedLocale('xx')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
  })

  it('knows the text direction', () => {
    expect(localeDir('ar')).toBe('rtl')
    expect(localeDir('de')).toBe('ltr')
    expect(localeDir('unknown')).toBe('ltr')
  })
})

describe('switchLocale', () => {
  it('loads messages before switching the bound composer', async () => {
    const order: string[] = []
    const composer = {
      locale: {
        _v: 'en',
        get value() {
          return this._v
        },
        set value(v: string) {
          order.push(`set ${v}`)
          this._v = v
        },
      },
    }
    bindI18n(composer, async (code) => void order.push(`load ${code}`))
    await switchLocale('de')
    expect(order).toEqual(['load de', 'set de'])
  })

  it('ignores unsupported codes', async () => {
    const loader = vi.fn(() => Promise.resolve())
    bindI18n({ locale: { value: 'en' } }, loader)
    await switchLocale('xx')
    await applyLocaleGlobally('xx')
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('langAttr', () => {
  it('canonicalizes valid tags', () => {
    expect(langAttr('EN-us')).toBe('en-US')
    expect(langAttr(' de ')).toBe('de')
  })

  it('returns undefined for invalid values', () => {
    expect(langAttr('')).toBeUndefined()
    expect(langAttr(null)).toBeUndefined()
    expect(langAttr('not a tag')).toBeUndefined()
    expect(langAttr('123')).toBeUndefined()
  })
})
