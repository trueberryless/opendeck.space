import { useI18n } from 'vue-i18n'
import { REPO } from '~~/shared/translations'

export interface ReviewSubmission {
  language: string
  scope: string
  approve: boolean
  title: string
  url: string
  sentAt: number
  review?: string
  issue?: number
  issueUrl?: string
  state?: IssueState
  manual?: boolean
}

type IssueState = 'received' | 'approved' | 'done' | 'closed'

export type SubmissionStatus = IssueState | 'searching' | 'notFound' | 'unreachable' | 'manual'

interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  state_reason?: string | null
  created_at: string
  html_url: string
  labels: { name: string }[]
  pull_request?: unknown
}

const ISSUES_API = `https://api.github.com/repos/${REPO}/issues`
const APPROVED_LABEL = 'translation-approved'
const CLOCK_SKEW = 5 * 60_000
const SEARCH_FOR = 2 * 60 * 60_000
const NOT_FOUND_AFTER = 90_000
const SEARCH_EVERY = 15_000
const REFRESH_EVERY = 60_000

function storageKey(language: string, scope: string): string {
  return `opendeck-translation-review:${language}:${scope}:sent`
}

function issueState(issue: GitHubIssue): IssueState {
  if (issue.state === 'closed') return issue.state_reason === 'completed' ? 'done' : 'closed'
  return issue.labels.some((l) => l.name === APPROVED_LABEL) ? 'approved' : 'received'
}

function matches(issue: GitHubIssue, submission: ReviewSubmission): boolean {
  if (issue.pull_request || Date.parse(issue.created_at) < submission.sentAt - CLOCK_SKEW) return false
  const body = issue.body ?? ''
  return (
    issue.title.trim() === submission.title ||
    (body.includes(`"language": "${submission.language}"`) && body.includes(`"scope": "${submission.scope}"`))
  )
}

async function github<T>(path: string): Promise<T> {
  const res = await fetch(`${ISSUES_API}${path}`, { headers: { Accept: 'application/vnd.github+json' } })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return (await res.json()) as T
}

export function useReviewSubmission(language: Ref<string | undefined>, scope: Ref<string | undefined>) {
  const submission = ref<ReviewSubmission>()
  const unreachable = ref(false)
  const checking = ref(false)
  const now = ref(Date.now())
  let lastCheck = 0

  const key = computed(() => (language.value && scope.value ? storageKey(language.value, scope.value) : undefined))

  watch(
    key,
    (k) => {
      unreachable.value = false
      lastCheck = 0
      if (!import.meta.client || !k) {
        submission.value = undefined
        return
      }
      try {
        const raw = localStorage.getItem(k)
        submission.value = raw ? (JSON.parse(raw) as ReviewSubmission) : undefined
      } catch {
        submission.value = undefined
      }
      void check(true)
    },
    { immediate: true },
  )

  watch(
    submission,
    (value) => {
      if (!key.value) return
      try {
        if (value) localStorage.setItem(key.value, JSON.stringify(value))
        else localStorage.removeItem(key.value)
      } catch {}
    },
    { deep: true },
  )

  const status = computed<SubmissionStatus | undefined>(() => {
    const s = submission.value
    if (!s) return undefined
    if (s.state) return s.state
    if (s.manual) return 'manual'
    if (unreachable.value) return 'unreachable'
    return now.value - s.sentAt > NOT_FOUND_AFTER ? 'notFound' : 'searching'
  })

  const { t } = useI18n()
  const title = computed(() => {
    const number = submission.value?.issue
    switch (status.value) {
      case 'received':
        return t('translations.review.sent.receivedTitle', { number })
      case 'approved':
        return t('translations.review.sent.approvedTitle', { number })
      case 'done':
        return t('translations.review.sent.doneTitle')
      case 'closed':
        return t('translations.review.sent.closedTitle', { number })
      case 'manual':
        return t('translations.review.sent.manualTitle')
      default:
        return t('translations.review.sent.waitingTitle')
    }
  })

  async function check(force = false) {
    const s = submission.value
    if (!s || checking.value || s.state === 'done' || s.state === 'closed') return
    if (document.visibilityState !== 'visible') return
    const due = s.issue ? REFRESH_EVERY : SEARCH_EVERY
    if (!force && Date.now() - lastCheck < due) return
    if (!s.issue && Date.now() - s.sentAt > SEARCH_FOR) return
    checking.value = true
    lastCheck = Date.now()
    try {
      const issue = s.issue
        ? await github<GitHubIssue>(`/${s.issue}`)
        : (
            await github<GitHubIssue[]>(
              `?state=all&sort=created&direction=desc&per_page=50&since=${new Date(s.sentAt - CLOCK_SKEW).toISOString()}`,
            )
          ).findLast((i) => matches(i, s))
      unreachable.value = false
      if (issue && submission.value === s) {
        submission.value = { ...s, issue: issue.number, issueUrl: issue.html_url, state: issueState(issue) }
      }
    } catch {
      unreachable.value = true
    } finally {
      checking.value = false
    }
  }

  if (import.meta.client) {
    useIntervalFn(() => {
      now.value = Date.now()
      void check()
    }, 5_000)
    useEventListener(document, 'visibilitychange', () => void check(true))
    useEventListener(window, 'focus', () => void check(true))
  }

  function start(next: Omit<ReviewSubmission, 'sentAt'>) {
    unreachable.value = false
    lastCheck = Date.now()
    now.value = Date.now()
    submission.value = { ...next, sentAt: Date.now() }
  }

  function markCreated() {
    if (submission.value) submission.value = { ...submission.value, manual: true }
  }

  function dismiss() {
    submission.value = undefined
  }

  return { submission, status, title, start, markCreated, dismiss }
}
