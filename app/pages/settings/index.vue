<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { OpenDeckPrefs } from '~/composables/useProfile'
import { DEFAULT_PREFS } from '~/composables/useProfile'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
useHead(() => ({ title: `${t('settings.title')} · OpenDeck` }))

const colorMode = useColorMode()
const { accent, setAccent } = useAccent()
const { prefs, loaded, load, save } = useProfile()
const { supported, probe } = useSpacesSupport()
const authUser = useAuthUser()
const me = useMe()
const toast = useToast()

onMounted(() => {
  if (!loaded.value) load()
  probe()
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
const showProgress = prefToggle('showProgressOnProfile', DEFAULT_PREFS.showProgressOnProfile)

const defaultPrivate = computed({
  get: () => (prefs.value?.defaultVisibility ?? (supported.value ? 'private' : 'public')) === 'private',
  set: (value: boolean) => savePref({ defaultVisibility: value ? 'private' : 'public' }),
})

const reminderEnabled = computed({
  get: () => prefs.value?.reminderEnabled ?? false,
  set: (value: boolean) => toggleReminders(value),
})
const reminderTime = computed({
  get: () => prefs.value?.reminderTime ?? '19:00',
  set: (value: string) => savePref({ reminderTime: value }),
})
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const reminderDays = computed(() => prefs.value?.reminderDays ?? [1, 2, 3, 4, 5])
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
        <p class="text-sm font-medium">{{ $t('settings.theme') }}</p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="item in themeItems"
            :key="item.value"
            :icon="item.icon"
            :label="item.label"
            :color="theme === item.value ? 'primary' : 'neutral'"
            :variant="theme === item.value ? 'solid' : 'subtle'"
            @click="theme = item.value"
          />
        </div>
        <p class="text-xs text-neutral-400">{{ $t('settings.savedOnDevice') }}</p>
      </div>
      <div class="space-y-2">
        <p class="text-sm font-medium">{{ $t('settings.language') }}</p>
        <LocaleSwitcher />
        <p class="text-xs text-neutral-400">{{ $t('settings.languageHint') }}</p>
      </div>
      <div class="space-y-2">
        <p class="text-sm font-medium">{{ $t('settings.accentColor') }}</p>
        <AccentPicker v-model="localAccent" />
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.privacy') }}</h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('settings.privacyIntro') }}</p>

      <div v-if="supported" class="border-default flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <p class="font-medium">{{ $t('settings.defaultPrivateTitle') }}</p>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('settings.defaultPrivateBody') }}</p>
        </div>
        <USwitch v-model="defaultPrivate" />
      </div>

      <SettingsRow v-model="showDecks" :title="$t('settings.showDecks')" />
      <SettingsRow v-model="showProgress" :title="$t('settings.showProgress')" />
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.notifications') }}</h2>
      <SettingsRow
        v-model="reminderEnabled"
        :title="$t('settings.remindersTitle')"
        :description="$t('settings.remindersBody')"
      />
      <template v-if="reminderEnabled">
        <div class="space-y-2">
          <p class="text-sm font-medium">{{ $t('settings.reminderTime') }}</p>
          <UInput v-model="reminderTime" type="time" class="w-40" />
        </div>
        <div>
          <p class="mb-2 text-sm font-medium">{{ $t('settings.days') }}</p>
          <div class="flex flex-wrap gap-1">
            <UButton
              v-for="(day, i) in WEEKDAYS"
              :key="i"
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
      <h2 class="text-lg font-semibold">{{ $t('settings.account') }}</h2>
      <div class="flex items-center gap-3">
        <UAvatar :src="me?.avatar" :alt="me?.handle" size="lg" />
        <div class="min-w-0">
          <p class="truncate font-medium">{{ me?.displayName || me?.handle }}</p>
          <p class="truncate text-sm text-neutral-500">@{{ authUser?.handle || me?.handle }}</p>
        </div>
      </div>
      <div class="border-default rounded-lg border p-3 text-xs break-all text-neutral-500">
        {{ authUser?.did }}
      </div>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        {{ $t('settings.spacesLabel') }}
        <span :class="supported ? 'text-accent font-medium' : ''">{{
          supported === null ? $t('common.checking') : supported ? $t('common.available') : $t('common.notAvailable')
        }}</span>
      </p>
      <UButton :label="$t('common.signOut')" icon="i-lucide-log-out" color="error" variant="subtle" @click="signOut" />
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t('settings.about') }}</h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('settings.aboutBody') }}</p>
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
    </section>
  </div>
</template>
