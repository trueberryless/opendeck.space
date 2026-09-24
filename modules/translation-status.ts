import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { addVitePlugin, defineNuxtModule } from 'nuxt/kit'
import {
  filePath,
  parseVerificationPath,
  pendingKeys,
  reviewableStrings,
  SOURCE_LANGUAGE,
  translatableStrings,
  type TranslationFileStatus,
  type TranslationVerification,
  VERIFICATIONS_DIR,
} from '../shared/translations'

const ID = 'virtual:translation-status'
const RESOLVED_ID = `\0${ID}`

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))

function translationStatus(): { status: Record<string, TranslationFileStatus>; files: string[] } {
  const status: Record<string, TranslationFileStatus> = {}
  const files: string[] = []
  const checkFiles = existsSync(VERIFICATIONS_DIR)
    ? readdirSync(VERIFICATIONS_DIR, { recursive: true, encoding: 'utf8' })
        .filter((f) => f.endsWith('.json'))
        .map((f) => `${VERIFICATIONS_DIR}/${f.replaceAll('\\', '/')}`)
    : []
  for (const checkFile of checkFiles) {
    const target = parseVerificationPath(checkFile)
    if (!target) continue
    const englishPath = filePath(target.scope, SOURCE_LANGUAGE)
    const targetPath = filePath(target.scope, target.language)
    if (!existsSync(englishPath) || !existsSync(targetPath)) continue
    files.push(checkFile, englishPath, targetPath)
    const checks = readJson(checkFile) as TranslationVerification[]
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
