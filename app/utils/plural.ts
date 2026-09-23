const CATEGORY_ORDER: Intl.LDMLPluralRule[] = ['zero', 'one', 'two', 'few', 'many', 'other']

export function pluralCategories(locale: string): Intl.LDMLPluralRule[] {
  return [...new Intl.PluralRules(locale).resolvedOptions().pluralCategories].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
  )
}

export function pluralRule(locale: string) {
  const rules = new Intl.PluralRules(locale)
  const categories = pluralCategories(locale)
  return (choice: number, choicesLength: number): number =>
    choicesLength === 1 ? 0 : Math.min(categories.indexOf(rules.select(choice)), choicesLength - 1)
}
