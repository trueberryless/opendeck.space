<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { OpenDeckPrefs } from '~/utils/records'

definePageMeta({ middleware: 'auth', centered: true })
const { t } = useI18n()
useHead(() => ({ title: `${t('welcome.title')} · OpenDeck` }))

const { save } = useProfile()
const toast = useToast()

interface Choice {
  value: string
  icon: string
  patch: Partial<OpenDeckPrefs>
  needsNotifications?: boolean
}

interface Question {
  id: 'privacy' | 'motivation' | 'reminders'
  choices: Choice[]
}

const QUESTIONS: Question[] = [
  {
    id: 'privacy',
    choices: [
      { value: 'private', icon: 'i-lucide-lock', patch: { showDecksOnProfile: false, showFollowsOnProfile: false } },
      { value: 'public', icon: 'i-lucide-globe', patch: { showDecksOnProfile: true, showFollowsOnProfile: true } },
    ],
  },
  {
    id: 'motivation',
    choices: [
      { value: 'themed', icon: 'i-lucide-sparkles', patch: { motivationEnabled: true, showTierOnProfile: true } },
      { value: 'quiet', icon: 'i-lucide-sprout', patch: { motivationEnabled: true, showTierOnProfile: false } },
      { value: 'off', icon: 'i-lucide-circle-minus', patch: { motivationEnabled: false, showTierOnProfile: false } },
    ],
  },
  {
    id: 'reminders',
    choices: [
      { value: 'on', icon: 'i-lucide-bell-ring', patch: { reminderEnabled: true }, needsNotifications: true },
      { value: 'off', icon: 'i-lucide-bell-off', patch: { reminderEnabled: false } },
    ],
  },
]

const step = ref(0)
const answers = reactive<Partial<Record<Question['id'], Choice>>>({})
const saving = ref(false)
const heading = useTemplateRef<HTMLElement>('heading')

const question = computed(() => QUESTIONS[step.value])
const done = computed(() => step.value >= QUESTIONS.length)

async function finish() {
  saving.value = true
  try {
    await save(Object.assign({}, ...Object.values(answers).map((c) => c.patch)))
  } catch (err) {
    toast.add({ title: t('welcome.saveError'), description: String(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

function advance() {
  step.value++
  if (done.value) void finish()
}

async function choose(q: Question, choice: Choice) {
  if (choice.needsNotifications && !(await requestNotificationPermission())) {
    toast.add({ title: t('settings.notifBlockedTitle'), description: t('settings.notifBlockedBody'), color: 'warning' })
    return
  }
  answers[q.id] = choice
  advance()
}

function skipQuestion(q: Question) {
  delete answers[q.id]
  advance()
}

function skipAll() {
  step.value = QUESTIONS.length
  void finish()
}

function focusHeading() {
  heading.value?.focus()
}

useShortcuts(
  'welcome',
  () => t('welcome.title'),
  () =>
    (question.value?.choices ?? []).map((choice, i) => ({
      keys: [String(i + 1)],
      label: t('shortcuts.chooseOption', { n: i + 1 }),
      run: () => void choose(question.value!, choice),
    })),
)
</script>

<template>
  <div class="mx-auto w-full max-w-md space-y-8 py-6">
    <div class="flex min-h-8 items-center justify-between gap-4">
      <div class="flex gap-1.5">
        <span
          v-for="(q, i) in QUESTIONS"
          :key="q.id"
          class="h-1.5 w-8 rounded-full transition-colors"
          :class="i <= step ? 'bg-accent' : 'bg-neutral-200 dark:bg-neutral-800'"
          aria-hidden="true"
        />
        <span v-if="!done" class="sr-only" role="status">
          {{ $t('welcome.progress', { current: step + 1, total: QUESTIONS.length }) }}
        </span>
      </div>
      <UButton v-if="!done" :label="$t('welcome.skipAll')" color="neutral" variant="ghost" size="sm" @click="skipAll" />
    </div>

    <Transition name="welcome-step" mode="out-in" @after-enter="focusHeading">
      <section v-if="question" :key="question.id" class="space-y-6" aria-labelledby="welcome-question">
        <div class="space-y-2">
          <p v-if="step === 0" class="text-accent text-sm font-semibold">{{ $t('welcome.title') }}</p>
          <h1
            id="welcome-question"
            ref="heading"
            tabindex="-1"
            class="text-2xl font-bold tracking-tight focus:outline-none"
          >
            {{ $t(`welcome.${question.id}.title`) }}
          </h1>
          <p v-if="step === 0" class="text-muted text-sm">{{ $t('welcome.intro') }}</p>
        </div>

        <div class="space-y-3">
          <button
            v-for="choice in question.choices"
            :key="choice.value"
            type="button"
            class="border-default hover:border-accent focus-visible:border-accent flex w-full items-start gap-4 rounded-xl border p-4 text-start transition-colors"
            :aria-pressed="answers[question.id]?.value === choice.value"
            @click="choose(question, choice)"
          >
            <span class="bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg" aria-hidden="true">
              <UIcon :name="choice.icon" class="size-5" />
            </span>
            <span class="min-w-0">
              <span class="block font-medium">{{ $t(`welcome.${question.id}.${choice.value}`) }}</span>
              <span class="text-muted block text-sm">{{ $t(`welcome.${question.id}.${choice.value}Body`) }}</span>
            </span>
          </button>
        </div>

        <div class="flex items-center justify-between gap-2">
          <UButton
            v-if="step > 0"
            :label="$t('common.back')"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="step--"
          />
          <span v-else />
          <UButton
            :label="$t('welcome.skip')"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="skipQuestion(question)"
          />
        </div>
        <p class="text-muted text-center text-xs">{{ $t('welcome.later') }}</p>
      </section>

      <section v-else key="done" class="space-y-6 text-center" aria-labelledby="welcome-question">
        <span
          class="bg-accent tier-pop mx-auto flex size-16 items-center justify-center rounded-2xl"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-party-popper" class="size-8" />
        </span>
        <div class="space-y-2">
          <h1
            id="welcome-question"
            ref="heading"
            tabindex="-1"
            class="text-2xl font-bold tracking-tight focus:outline-none"
          >
            {{ $t('welcome.done.title') }}
          </h1>
          <p class="text-muted text-sm">{{ $t('welcome.done.body') }}</p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <UButton
            to="/discover"
            :label="$t('welcome.done.packs')"
            icon="i-lucide-sparkles"
            size="lg"
            :loading="saving"
          />
          <UButton
            to="/decks/new"
            :label="$t('welcome.done.create')"
            icon="i-lucide-plus"
            size="lg"
            color="neutral"
            variant="subtle"
          />
        </div>
      </section>
    </Transition>
  </div>
</template>
