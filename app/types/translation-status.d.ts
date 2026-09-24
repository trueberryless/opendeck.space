declare module 'virtual:translation-status' {
  import type { TranslationFileStatus } from '~~/shared/translations'

  const status: Record<string, TranslationFileStatus>
  export default status
}
