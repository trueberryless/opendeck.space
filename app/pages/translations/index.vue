<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { DASHBOARD_URL, REPO_URL, SOURCE_LANGUAGE } from '~~/shared/translations'

const { t, te } = useI18n()
const { current } = useLocale()
const { list } = useStarterPacks()
useHead(() => ({ title: `${t('translations.title')} | OpenDeck` }))

const packs = list()

function languageName(code: string): string {
  return LOCALES.find((l) => l.code === code)?.name ?? (te(`languages.${code}`) ? t(`languages.${code}`) : code)
}

const rows = computed(() => {
  const codes = [...new Set([...LOCALES.map((l) => l.code), ...packs.flatMap((p) => p.languages)])]
  return codes
    .map((code) => {
      const available = packs.filter((p) => p.languages.includes(code))
      return {
        code,
        name: languageName(code),
        hasUi: LOCALES.some((l) => l.code === code),
        original: isOriginalLanguage(code),
        checkers: uiVerifications(code),
        packsChecked: available.filter((p) => isPackChecked(p, code)).length,
        packsTotal: available.length,
      }
    })
    .sort((a, b) =>
      a.code === SOURCE_LANGUAGE ? -1 : b.code === SOURCE_LANGUAGE ? 1 : a.name.localeCompare(b.name, current.value),
    )
})

const reviewLink = computed(() => reviewRoute(isOriginalLanguage(current.value) ? undefined : current.value))
const guideUrl = `${REPO_URL}/blob/main/CONTRIBUTING.md#checking-translations`
const linkClass = 'text-(--accent) underline underline-offset-4 hover:opacity-80'
</script>

<template>
  <div class="max-w-3xl py-8">
    <h1 class="mb-4 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('translations.title') }}
    </h1>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('translations.intro') }}</p>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('translations.codeTitle') }}
    </h2>
    <i18n-t keypath="translations.codeBody" tag="p" class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
      <template #link>
        <a :href="REPO_URL" target="_blank" rel="noopener noreferrer" :class="linkClass">GitHub</a>
      </template>
    </i18n-t>

    <h2 class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('translations.draftTitle') }}
    </h2>
    <p class="mb-4 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('translations.draftBody') }}</p>
    <p class="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">{{ $t('translations.draftBody2') }}</p>

    <section id="help" class="border-default bg-muted mt-10 rounded-lg border p-5">
      <h2 class="mb-2 text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
        {{ $t('translations.helpTitle') }}
      </h2>
      <p class="mb-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {{ $t('translations.helpBody') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton :to="reviewLink" icon="i-lucide-badge-check" :label="$t('translations.reviewAction')" size="sm" />
        <UButton
          :to="DASHBOARD_URL"
          target="_blank"
          icon="i-lucide-chart-bar"
          :label="$t('translations.dashboardAction')"
          color="neutral"
          variant="subtle"
          size="sm"
        />
        <UButton
          :to="guideUrl"
          target="_blank"
          icon="i-lucide-book-open"
          :label="$t('translations.guideAction')"
          color="neutral"
          variant="ghost"
          size="sm"
        />
      </div>
    </section>

    <h2 id="status" class="mt-10 mb-4 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
      {{ $t('translations.statusTitle') }}
    </h2>
    <div class="border-default overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted text-start">
          <tr>
            <th scope="col" class="p-3 text-start font-medium">{{ $t('translations.language') }}</th>
            <th scope="col" class="p-3 text-start font-medium">{{ $t('translations.interface') }}</th>
            <th scope="col" class="p-3 text-end font-medium">{{ $t('translations.packs') }}</th>
          </tr>
        </thead>
        <tbody class="divide-default divide-y">
          <tr
            v-for="row in rows"
            :key="row.code"
            :aria-current="row.code === current ? 'true' : undefined"
            :class="row.code === current ? 'bg-elevated' : ''"
          >
            <th scope="row" class="p-3 text-start font-medium">
              <span :lang="langAttr(row.code)">{{ row.name }}</span>
              <span class="text-muted ms-2 text-xs font-normal">{{ row.code }}</span>
            </th>
            <td class="p-3">
              <UBadge
                v-if="row.original"
                :label="$t('translations.original')"
                color="primary"
                variant="subtle"
                size="sm"
              />
              <span v-else-if="row.checkers.length" class="inline-flex items-center gap-1.5">
                <UIcon name="i-lucide-badge-check" class="text-success size-4 shrink-0" aria-hidden="true" />
                <i18n-t keypath="translations.checkedBy" tag="span">
                  <template #names>
                    <template v-for="(checker, i) in row.checkers" :key="checker.github">
                      <template v-if="i > 0">, </template>
                      <a
                        :href="`https://github.com/${checker.github}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        :class="linkClass"
                        >{{ checker.name ?? `@${checker.github}` }}</a
                      >
                    </template>
                  </template>
                </i18n-t>
              </span>
              <UBadge
                v-else-if="row.hasUi"
                :label="$t('translations.draft')"
                color="neutral"
                variant="outline"
                size="sm"
              />
              <span v-else class="text-muted" aria-hidden="true">–</span>
            </td>
            <td class="p-3 text-end tabular-nums">
              <template v-if="row.packsTotal">{{ row.packsChecked }}/{{ row.packsTotal }}</template>
              <span v-else class="text-muted" aria-hidden="true">–</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
