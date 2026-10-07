import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pluralCategories } from '~/utils/plural'
import { LOCALES } from '~/utils/i18n'
import { samePlaceholders } from '~~/shared/translations'

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

function runScript(name: string) {
  return execFileSync('node', [`scripts/${name}.ts`], { encoding: 'utf8', stdio: 'pipe' })
}

describe('repository checks', () => {
  it.each([
    ['check-i18n', 'i18n messages are consistent'],
    ['check-credits', 'Credits are valid'],
    ['check-verifications', 'Translation checks are valid'],
  ])('%s passes', (script, message) => {
    expect(runScript(script)).toContain(message)
  })
})

describe('interface translations', () => {
  const files = readdirSync('i18n').filter((f) => f.endsWith('.json'))

  it('has a file for every registered locale and vice versa', () => {
    expect(files.map((f) => f.replace('.json', '')).sort()).toEqual(LOCALES.map((l) => l.code).sort())
  })

  it('keeps the placeholders of every message', () => {
    const flatten = (o: Record<string, unknown>, prefix = ''): [string, string][] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'string' ? [[`${prefix}${k}`, v]] : flatten(v as Record<string, unknown>, `${prefix}${k}.`),
      )
    const en = new Map(flatten(readJson('i18n/en.json')))
    const broken: string[] = []
    for (const file of files) {
      for (const [key, value] of flatten(readJson(`i18n/${file}`))) {
        if (!samePlaceholders(en.get(key) ?? '', value)) broken.push(`${file}:${key}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('uses the plural forms of each language', () => {
    for (const { code } of LOCALES) expect(pluralCategories(code).length).toBeGreaterThan(0)
  })
})

describe('starter packs', () => {
  const packs = readdirSync('app/data/starter-packs', { withFileTypes: true }).filter((d) => d.isDirectory())

  it.each(packs.map((p) => p.name))('%s has consistent entries in every language', (id) => {
    const manifest = readJson(`app/data/starter-packs/${id}/pack.json`)
    expect(manifest.id).toBe(id)
    const keys = manifest.entries.map((e: { key: string }) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const entry of manifest.entries) expect(manifest.sections).toContain(entry.section)
    const orders = manifest.entries.map((e: { order: number }) => e.order).sort((a: number, b: number) => a - b)
    expect(orders).toEqual(keys.map((_: string, i: number) => i + 1))

    const languages = readdirSync(`app/data/starter-packs/${id}`).filter(
      (f) => f.endsWith('.json') && f !== 'pack.json',
    )
    expect(languages).toContain('en.json')
    for (const file of languages) {
      const { entries } = readJson(`app/data/starter-packs/${id}/${file}`)
      expect(Object.keys(entries).sort(), file).toEqual([...keys].sort())
      for (const key of keys) expect(entries[key].text?.trim(), `${file}:${key}`).toBeTruthy()
    }
  })
})
