import type { StarterDeck } from '~/composables/useStarterDecks'
import { LANGS as cjkThai } from './cjk-thai'
import { LANGS as cyrillicGreek } from './cyrillic-greek'
import { LANGS as indic } from './indic'
import { LANGS as latin } from './latin'
import { buildDeck } from './master'
import { LANGS as rtl } from './rtl'

export const generatedDecks: StarterDeck[] = [...latin, ...cyrillicGreek, ...rtl, ...indic, ...cjkThai].map(buildDeck)
