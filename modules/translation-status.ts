import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { addVitePlugin, defineNuxtModule } from 'nuxt/kit'
import {
  filePath,
  pendingKeys,
  reviewableStrings,
  SOURCE_LANGUAGE,
  translatableStrings,
  type TranslationFileStatus,
  type TranslationVerification,
  verificationPath,
} from '../shared/translations'

const ID = 'virtual:translation-status'
const RESOLVED_ID = `\0${ID}`

const PACKS_DIR = 'app/data/starter-packs'

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))

function targets(): { scope: string; language: string }[] {
  const ui = readdirSync('i18n')
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ scope: 'ui', language: f.replace(/\.json$/, '') }))
  const packs = readdirSync(PACKS_DIR).flatMap((pack) =>
    existsSync(`${PACKS_DIR}/${pack}/pack.json`)
      ? readdirSync(`${PACKS_DIR}/${pack}`)
          .filter((f) => f.endsWith('.json') && f !== 'pack.json')
          .map((f) => ({ scope: pack, language: f.replace(/\.json$/, '') }))
      : [],
  )
  return [...ui, ...packs].filter((t) => t.language !== SOURCE_LANGUAGE)
}

function translationStatus(): { status: Record<string, TranslationFileStatus>; files: string[] } {
  const status: Record<string, TranslationFileStatus> = {}
  const files: string[] = []
  for (const target of targets()) {
    const checkFile = verificationPath(target.scope, target.language)
    const englishPath = filePath(target.scope, SOURCE_LANGUAGE)
    const targetPath = filePath(target.scope, target.language)
    if (!existsSync(englishPath)) continue
    const checked = existsSync(checkFile)
    files.push(...(checked ? [checkFile] : []), englishPath, targetPath)
    const checks = checked ? (readJson(checkFile) as TranslationVerification[]) : []
    const strings = reviewableStrings(
      translatableStrings(target.scope, readJson(englishPath)),
      translatableStrings(target.scope, readJson(targetPath)),
    )
    status[`${target.scope}/${target.language}`] = {
      checks: checks.map((entry) => {
        const { strings: _, ...check } = entry
        return check
      }),
      pending: pendingKeys(strings, checks).length,
      total: strings.size,
    }
  }
  return { status, files }
}

function translationStatusPlugin() {
  return {
    name: 'opendeck:translation-status',
    resolveId(id: string) {
      return id === ID ? RESOLVED_ID : undefined
    },
    load(this: { addWatchFile(file: string): void }, id: string) {
      if (id !== RESOLVED_ID) return undefined
      const { status, files } = translationStatus()
      for (const file of files) this.addWatchFile(resolve(file))
      return `export default ${JSON.stringify(status)}`
    },
  }
}

export default defineNuxtModule({
  meta: { name: 'translation-status' },
  setup() {
    addVitePlugin(translationStatusPlugin())
  },
})
