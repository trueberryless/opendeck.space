<script setup lang="ts">
import type { OpenDeckPrefs } from '~/utils/records'
import { useI18n } from 'vue-i18n'
import { DEFAULT_PREFS } from '~/composables/useProfile'
import { DEFAULT_REMINDER_DAYS, DEFAULT_REMINDER_HOUR } from '~~/shared/reminders'
import { formatShortTerm, SHORT_TERM_PRESET_KEYS, type ShortTermChoice } from '~/utils/fsrs'

definePageMeta({ middleware: 'auth' })
const { t, locale } = useI18n()
useHead(() => ({ title: `${t('settings.title')} · OpenDeck` }))

const colorMode = useColorMode()
const { accent, setAccent } = useAccent()
const { prefs, loaded, load, save } = useProfile()
const { supported, ensure } = useSpacesSupport()
const authUser = useAuthUser()
const me = useMe()
const toast = useToast()
const { available: installAvailable, installed } = useInstallApp()
const { running: deletingAll, done: deletedCount, total: deleteTotal, deleteAll } = useDeleteAllData()

async function deleteAllData() {
  try {
    await deleteAll()
  } catch (err) {
    toast.add({ title: t('settings.deleteAllError'), description: String(err), color: 'error' })
  }
}

onMounted(() => {
  if (!loaded.value) load()
  ensure()
})

const theme = computed({
  get: () => colorMode.preference,
  set: (value: string) => {
    colorMode.preference = value
  },
})
const themeItems = computed(() => [
  { label: t('theme.system'), value: 'system', icon: 'i-lucide-monitor' },
  { label: t('theme.light'), value: 'light', icon: 'i-lucide-sun' },
  { label: t('theme.dark'), value: 'dark', icon: 'i-lucide-moon' },
])

const localAccent = ref(accent.value)
watch(accent, (v) => (localAccent.value = v))
const persistAccent = useDebounceFn((value: string) => savePref({ accentColor: value }), 400)
watch(localAccent, (value) => {
  setAccent(value)
  persistAccent(value)
})

const shortTermIntervals = computed<ShortTermChoice>({
  get: () => prefs.value?.shortTermIntervals ?? 'auto',
  set: (value) => savePref({ shortTermIntervals: value }),
})
const intervalItems = computed(() => [
  { value: 'auto', label: t('shortTerm.auto'), description: t('shortTerm.autoHelp') },
  ...SHORT_TERM_PRESET_KEYS.map((p) => ({
    value: p,
    label: t(`shortTerm.presets.${p}`),
    description: formatShortTerm(p),
  })),
])

async function savePref(patch: Partial<OpenDeckPrefs>) {
  try {
    await save(patch)
  } catch (err) {
    toast.add({ title: t('settings.saveError'), description: String(err), color: 'error' })
  }
}

function prefToggle(key: keyof OpenDeckPrefs, fallback = false) {
  return computed({
    get: () => (prefs.value?.[key] as boolean | undefined) ?? fallback,
    set: (value: boolean) => savePref({ [key]: value }),
  })
}

const showDecks = prefToggle('showDecksOnProfile', DEFAULT_PREFS.showDecksOnProfile)
const showFollows = prefToggle('showFollowsOnProfile', DEFAULT_PREFS.showFollowsOnProfile)
const showProgress = prefToggle('showProgressOnProfile', DEFAULT_PREFS.showProgressOnProfile)

const motivation = useMotivation()
const breakReminders = prefToggle('breakReminders', DEFAULT_PREFS.breakReminders)
const motivationEnabled = computed({
  get: () => motivation.enabled.value,
  set: (value: boolean) => updateMotivation({ motivationEnabled: value }),
})
const showTier = computed({
  get: () => prefs.value?.showTierOnProfile ?? DEFAULT_PREFS.showTierOnProfile,
  set: (value: boolean) => updateMotivation({ showTierOnProfile: value }),
})

async function updateMotivation(patch: Partial<OpenDeckPrefs>) {
  await savePref(patch)
  if (motivation.enabled.value && !motivation.summary.value) await motivation.refresh()
  else await motivation.publish()
}

const defaultPrivate = computed({
  get: () => (prefs.value?.defaultVisibility ?? (supported.value ? 'private' : 'public')) === 'private',
  set: (value: boolean) => savePref({ defaultVisibility: value ? 'private' : 'public' }),
})

const reminderEnabled = computed({
  get: () => prefs.value?.reminderEnabled ?? false,
  set: (value: boolean) => toggleReminders(value),
})
const reminderHour = computed({
  get: () => prefs.value?.reminderHour ?? DEFAULT_REMINDER_HOUR,
  set: (value: number) => savePref({ reminderHour: value }),
})
const hourItems = computed(() => {
  const format = new Intl.DateTimeFormat(locale.value, { hour: 'numeric', minute: '2-digit' })
  return Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: format.format(new Date(2000, 0, 1, hour)) }))
})
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const shortcutsEnabled = useShortcutsEnabled()
const shortcutHelp = useShortcutHelp()
const reminderDays = computed(() => prefs.value?.reminderDays ?? DEFAULT_REMINDER_DAYS)
function toggleDay(day: number) {
  const set = new Set(reminderDays.value)
  if (set.has(day)) set.delete(day)
  else set.add(day)
  savePref({ reminderDays: [...set].sort((a, b) => a - b) })
}

async function toggleReminders(enable: boolean) {
  if (enable) {
    const ok = await requestNotificationPermission()
    if (!ok) {
      toast.add({
        title: t('settings.notifBlockedTitle'),
        description: t('settings.notifBlockedBody'),
        color: 'warning',
      })
      return
    }
  }
  await savePref({ reminderEnabled: enable })
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-10">
    <div class="flex items-center gap-2">
      <UButton
        to="/profile"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="$t('common.back')"
      />
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('settings.title') }}</h1>
    </div>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.appearance') }}</h2>
      <div class="space-y-2">
        <p id="settings-theme" class="text-sm font-medium">{{ $t('settings.theme') }}</p>
        <div class="flex flex-wrap gap-2" role="group" aria-labelledby="settings-theme">
          <UButton
            v-for="item in themeItems"
            :key="item.value"
            :aria-pressed="theme === item.value"
            :icon="item.icon"
            :label="item.label"
            :color="theme === item.value ? 'primary' : 'neutral'"
            :variant="theme === item.value ? 'solid' : 'subtle'"
            @click="theme = item.value"
          />
        </div>
        <p class="text-muted text-xs">{{ $t('settings.savedOnDevice') }}</p>
      </div>
      <div class="space-y-2">
        <p class="text-sm font-medium">{{ $t('settings.language') }}</p>
        <LocaleSwitcher />
        <p class="text-muted text-xs">
          {{ $t('settings.languageHint') }}
          <NuxtLink to="/translations" class="text-(--accent) underline underline-offset-4 hover:opacity-80">
            {{ $t('translations.settingsLink') }}
          </NuxtLink>
        </p>
      </div>
      <div class="space-y-2">
        <p id="settings-accent" class="text-sm font-medium">{{ $t('settings.accentColor') }}</p>
        <AccentPicker v-model="localAccent" role="group" aria-labelledby="settings-accent" />
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.studying') }}</h2>
      <div class="space-y-2">
        <URadioGroup
          v-model="shortTermIntervals"
          :items="intervalItems"
          variant="card"
          :disabled="!loaded"
          :ui="{ legend: 'mb-2 text-sm font-medium' }"
        >
          <template #legend>
            {{ $t('shortTerm.title') }}
            <span class="text-muted mt-1 block text-sm font-normal">
              {{ $t('shortTerm.help') }}
            </span>
          </template>
        </URadioGroup>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.motivation') }}</h2>
      <p class="text-muted text-sm">{{ $t('settings.motivationIntro') }}</p>
      <SettingsRow
        v-model="motivationEnabled"
        :title="$t('settings.motivationTitle')"
        :description="$t('settings.motivationBody')"
        :disabled="!loaded"
      />
      <SettingsRow
        v-model="showTier"
        :title="$t('settings.showTier')"
        :description="$t('settings.showTierBody')"
        :disabled="!loaded || !motivationEnabled"
      />
      <SettingsRow
        v-model="breakReminders"
        :title="$t('settings.breakReminders')"
        :description="$t('settings.breakRemindersBody')"
        :disabled="!loaded"
      />
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.privacy') }}</h2>
      <p class="text-muted text-sm">{{ $t('settings.privacyIntro') }}</p>
      <UAlert
        icon="i-lucide-globe"
        color="neutral"
        variant="subtle"
        :title="$t('settings.publicNoticeTitle')"
        :description="$t('settings.publicNoticeBody')"
      />

      <SettingsRow
        v-if="supported"
        v-model="defaultPrivate"
        :title="$t('settings.defaultPrivateTitle')"
        :description="$t('settings.defaultPrivateBody')"
      />

      <SettingsRow v-model="showDecks" :title="$t('settings.showDecks')" :description="$t('settings.showDecksBody')" />
      <SettingsRow
        v-model="showFollows"
        :title="$t('settings.showFollows')"
        :description="$t('settings.showFollowsBody')"
      />
      <SettingsRow
        v-model="showProgress"
        :title="$t('settings.showProgress')"
        :description="$t('settings.showProgressBody')"
      />
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.notifications') }}</h2>
      <SettingsRow
        v-model="reminderEnabled"
        :title="$t('settings.remindersTitle')"
        :description="$t('settings.remindersBody')"
      />
      <template v-if="reminderEnabled">
        <UFormField :label="$t('settings.reminderTime')" name="reminderHour">
          <USelect v-model="reminderHour" :items="hourItems" class="w-40" />
        </UFormField>
        <div>
          <p id="settings-days" class="mb-2 text-sm font-medium">{{ $t('settings.days') }}</p>
          <div class="flex flex-wrap gap-1" role="group" aria-labelledby="settings-days">
            <UButton
              v-for="(day, i) in WEEKDAYS"
              :key="i"
              :aria-pressed="reminderDays.includes(i)"
              :label="$t(`settings.weekdays.${day}`)"
              size="xs"
              :color="reminderDays.includes(i) ? 'primary' : 'neutral'"
              :variant="reminderDays.includes(i) ? 'solid' : 'subtle'"
              @click="toggleDay(i)"
            />
          </div>
        </div>
      </template>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.keyboard') }}</h2>
      <ClientOnly>
        <SettingsRow
          v-model="shortcutsEnabled"
          :title="$t('shortcuts.singleKey')"
          :description="$t('shortcuts.singleKeyHint')"
        />
      </ClientOnly>
      <UButton
        :label="$t('shortcuts.open')"
        icon="i-lucide-keyboard"
        color="neutral"
        variant="subtle"
        aria-keyshortcuts="? Control+/ Meta+/"
        @click="shortcutHelp = true"
      />
    </section>

    <ClientOnly>
      <section v-if="installAvailable || installed" class="space-y-4">
        <h2 class="text-lg font-semibold">{{ $t('install.section') }}</h2>
        <div class="border-default flex items-center justify-between gap-4 rounded-lg border p-4">
          <div class="min-w-0">
            <p class="font-medium">{{ installed ? $t('install.installed') : $t('install.title') }}</p>
            <p class="text-muted text-sm">{{ $t('install.body') }}</p>
          </div>
          <InstallAppButton v-if="!installed" size="sm" />
          <UIcon v-else name="i-lucide-circle-check" class="text-accent size-5 shrink-0" aria-hidden="true" />
        </div>
      </section>
    </ClientOnly>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.account') }}</h2>
      <div class="flex items-center gap-3">
        <UAvatar :src="me?.avatar" :alt="me?.handle" size="lg" />
        <div class="min-w-0">
          <p class="truncate font-medium">{{ me?.displayName || me?.handle }}</p>
          <p class="text-muted truncate text-sm">@{{ authUser?.handle || me?.handle }}</p>
        </div>
      </div>
      <div class="border-default text-muted rounded-lg border p-3 text-xs break-all">
        {{ authUser?.did }}
      </div>
      <p class="text-muted text-sm">
        {{ $t('settings.spacesLabel') }}
        <span :class="supported ? 'text-accent font-medium' : ''">{{
          supported === null ? $t('common.checking') : supported ? $t('common.available') : $t('common.notAvailable')
        }}</span>
      </p>
      <UButton :label="$t('common.signOut')" icon="i-lucide-log-out" color="error" variant="subtle" @click="signOut" />
    </section>

    <section class="space-y-4">
      <h2 class="text-error text-lg font-semibold">{{ $t('settings.dangerZone') }}</h2>
      <div class="border-error/40 space-y-3 rounded-lg border p-4">
        <div>
          <p class="font-medium">{{ $t('settings.deleteAllTitle') }}</p>
          <p class="text-muted text-sm">{{ $t('settings.deleteAllBody') }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <ConfirmPopover
            :title="$t('settings.deleteAllConfirm')"
            :description="$t('settings.deleteAllConfirmBody')"
            :confirm-label="$t('settings.deleteAllConfirmBtn')"
            :disabled="deletingAll"
            @confirm="deleteAllData"
          >
            <UButton
              :label="$t('settings.deleteAllButton')"
              icon="i-lucide-trash-2"
              color="error"
              variant="subtle"
              :loading="deletingAll"
              :disabled="deletingAll"
            />
          </ConfirmPopover>
          <p v-if="deletingAll" class="text-muted text-sm" role="status">
            {{ $t('settings.deleteAllProgress', { done: deletedCount, total: deleteTotal || '…' }) }}
          </p>
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.about') }}</h2>
      <p class="text-muted text-sm">{{ $t('settings.aboutBody') }}</p>
      <div class="flex flex-wrap gap-2">
        <UButton
          to="/terms"
          :label="$t('settings.termsBtn')"
          icon="i-lucide-file-text"
          color="neutral"
          variant="subtle"
        />
        <UButton
          to="/privacy"
          :label="$t('settings.privacyBtn')"
          icon="i-lucide-shield"
          color="neutral"
          variant="subtle"
        />
      </div>
      <p class="text-muted text-sm">
        <a href="https://www.netlify.com" target="_blank" rel="noopener noreferrer" class="hover:text-accent">
          {{ $t('footer.hostedOn') }}
        </a>
      </p>
    </section>
  </div>
</template>
