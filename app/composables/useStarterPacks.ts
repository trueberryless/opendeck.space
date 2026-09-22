import type { ParsedDeck } from '~/utils/import/types'

export interface PackEntryMeta {
  key: string
  section: string
  note?: string
}

export interface PackManifest {
  id: string
  verified?: boolean
  sections: string[]
  entries: PackEntryMeta[]
}

export interface PackTranslation {
  text: string
  reading?: string
}

export interface PackLanguageFile {
  language: string
  entries: Record<string, PackTranslation>
}

export interface StarterPack {
  id: string
  verified: boolean
  sections: string[]
  entries: PackEntryMeta[]
  languages: string[]
  translations: Record<string, Record<string, PackTranslation>>
}

export interface PackCard {
  section: string
  front: string
  back: string
  reading?: string
  hint?: string
}

const manifestModules = import.meta.glob<{ default: PackManifest }>('../data/starter-packs/*/pack.json', {
  eager: true,
})
const languageModules = import.meta.glob<{ default: PackLanguageFile }>('../data/starter-packs/*/*.json', {
  eager: true,
})

function packIdFromPath(path: string): string {
  return path.split('/').slice(-2, -1)[0] ?? ''
}

function buildPacks(): StarterPack[] {
  const packs = new Map<string, StarterPack>()

  for (const mod of Object.values(manifestModules)) {
    const manifest = mod.default
    packs.set(manifest.id, {
      id: manifest.id,
      verified: manifest.verified ?? false,
      sections: manifest.sections,
      entries: manifest.entries,
      languages: [],
      translations: {},
    })
  }

  for (const [path, mod] of Object.entries(languageModules)) {
    if (path.endsWith('/pack.json')) continue
    const packId = packIdFromPath(path)
    const pack = packs.get(packId)
    const file = mod.default
    if (!pack || !file?.language || !file.entries) continue
    pack.translations[file.language] = file.entries
    if (!pack.languages.includes(file.language)) pack.languages.push(file.language)
  }

  for (const pack of packs.values()) pack.languages.sort()
  return [...packs.values()].sort((a, b) => a.id.localeCompare(b.id))
}

const ALL = buildPacks()

export function buildPackCards(pack: StarterPack, from: string, to: string): PackCard[] {
  const fromMap = pack.translations[from]
  const toMap = pack.translations[to]
  if (!fromMap || !toMap) return []
  const cards: PackCard[] = []
  for (const entry of pack.entries) {
    const source = fromMap[entry.key]
    const target = toMap[entry.key]
    if (!source?.text || !target?.text) continue
    cards.push({
      section: entry.section,
      front: source.text,
      back: target.text,
      reading: target.reading,
      hint: entry.note,
    })
  }
  return cards
}

export function groupPackCards(sections: string[], cards: PackCard[]): { section: string; cards: PackCard[] }[] {
  return sections
    .map((section) => ({ section, cards: cards.filter((c) => c.section === section) }))
    .filter((g) => g.cards.length > 0)
}

export function packToParsedDeck(
  pack: StarterPack,
  from: string,
  to: string,
  title: string,
  summary: string,
): ParsedDeck {
  return {
    title,
    summary,
    sourceLang: from,
    targetLang: to,
    tags: [pack.id, 'starter'],
    cards: buildPackCards(pack, from, to).map((c) => ({
      front: c.front,
      back: c.back,
      phonetic: c.reading,
      hint: c.hint,
    })),
  }
}

export function useStarterPacks() {
  function list(): StarterPack[] {
    return ALL
  }

  function get(id: string): StarterPack | undefined {
    return ALL.find((p) => p.id === id)
  }

  return { list, get }
}
