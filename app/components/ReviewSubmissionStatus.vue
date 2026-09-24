<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ReviewSubmission, SubmissionStatus } from '~/composables/useReviewSubmission'

const props = defineProps<{
  submission: ReviewSubmission
  status: SubmissionStatus
  title: string
}>()

const emit = defineEmits<{ dismiss: []; markCreated: [] }>()

const { t } = useI18n()

const waiting = computed(() => ['searching', 'notFound', 'unreachable'].includes(props.status))

const tone = computed(() => {
  if (waiting.value) return { color: 'text-primary', icon: 'i-lucide-external-link' }
  if (props.status === 'closed') return { color: 'text-muted', icon: 'i-lucide-circle-slash' }
  return { color: 'text-success', icon: 'i-lucide-circle-check' }
})

const body = computed(() => {
  switch (props.status) {
    case 'received':
      return t('translations.review.sent.receivedBody')
    case 'approved':
      return t('translations.review.sent.approvedBody')
    case 'done':
      return t('translations.review.sent.doneBody')
    case 'closed':
      return t('translations.review.sent.closedBody')
    case 'manual':
      return t('translations.review.sent.manualBody')
    default:
      return undefined
  }
})

const steps = computed(() => [
  t('translations.review.sent.stepOpened'),
  ...(props.submission.review ? [t('translations.review.copied')] : []),
  t('translations.review.sent.stepCreate'),
  t('translations.review.sent.stepReturn'),
])

const copiedAgain = ref(false)

async function copyAgain() {
  if (!props.submission.review) return
  try {
    await navigator.clipboard.writeText(props.submission.review)
    copiedAgain.value = true
  } catch {}
}

function openAgain() {
  window.open(props.submission.url, '_blank', 'noopener')
}
</script>

<template>
  <div role="status" aria-live="polite">
    <h2 class="flex items-center gap-2 text-lg font-semibold">
      <UIcon :name="tone.icon" class="size-5 shrink-0" :class="tone.color" aria-hidden="true" />
      {{ title }}
    </h2>

    <template v-if="waiting">
      <ol class="mt-4 space-y-3">
        <li v-for="(step, i) in steps" :key="i" class="flex items-start gap-3 text-sm leading-relaxed">
          <span
            class="border-default flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums"
            aria-hidden="true"
          >
            {{ i + 1 }}
          </span>
          <span class="pt-0.5">{{ step }}</span>
        </li>
      </ol>
      <p class="text-muted mt-4 flex items-start gap-2 text-sm">
        <UIcon
          :name="status === 'unreachable' ? 'i-lucide-cloud-off' : 'i-lucide-loader-circle'"
          class="mt-0.5 size-4 shrink-0"
          :class="status === 'unreachable' ? '' : 'animate-spin'"
          aria-hidden="true"
        />
        {{
          status === 'unreachable'
            ? $t('translations.review.sent.unreachable')
            : status === 'notFound'
              ? $t('translations.review.sent.notFound')
              : $t('translations.review.sent.searching')
        }}
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-external-link"
          :label="$t('translations.review.sent.openAgain')"
          color="neutral"
          variant="subtle"
          @click="openAgain"
        />
        <UButton
          v-if="submission.review"
          :icon="copiedAgain ? 'i-lucide-clipboard-check' : 'i-lucide-clipboard'"
          :label="$t('translations.review.sent.copyAgain')"
          color="neutral"
          variant="subtle"
          @click="copyAgain"
        />
        <UButton
          v-if="status !== 'searching'"
          icon="i-lucide-check"
          :label="$t('translations.review.sent.markCreated')"
          color="neutral"
          variant="subtle"
          @click="emit('markCreated')"
        />
        <UButton
          :label="$t('translations.review.sent.cancel')"
          color="neutral"
          variant="ghost"
          @click="emit('dismiss')"
        />
      </div>
    </template>

    <template v-else>
      <p class="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{{ body }}</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton
          v-if="submission.issueUrl"
          :to="submission.issueUrl"
          target="_blank"
          icon="i-lucide-github"
          :label="$t('translations.review.sent.view')"
          color="neutral"
          variant="subtle"
        />
        <UButton :label="$t('common.close')" color="neutral" variant="ghost" @click="emit('dismiss')" />
      </div>
    </template>
  </div>
</template>
