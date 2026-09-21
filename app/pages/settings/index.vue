<script setup lang="ts">
import type { OpenDeckPrefs } from '~/composables/useProfile'
import { DEFAULT_PREFS } from '~/composables/useProfile'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Settings · OpenDeck' })

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
const themeItems = [
  { label: 'System', value: 'system', icon: 'i-lucide-monitor' },
  { label: 'Light', value: 'light', icon: 'i-lucide-sun' },
  { label: 'Dark', value: 'dark', icon: 'i-lucide-moon' },
]

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
    toast.add({ title: 'Could not save setting', description: String(err), color: 'error' })
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
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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
        title: 'Notifications blocked',
        description: 'Allow notifications in your browser first.',
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
      <UButton to="/profile" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" aria-label="Back" />
      <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
    </div>

    <!-- Appearance -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Appearance</h2>
      <div class="space-y-2">
        <p class="text-sm font-medium">Theme</p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="t in themeItems"
            :key="t.value"
            :icon="t.icon"
            :label="t.label"
            :color="theme === t.value ? 'primary' : 'neutral'"
            :variant="theme === t.value ? 'solid' : 'subtle'"
            @click="theme = t.value"
          />
        </div>
        <p class="text-xs text-neutral-400">Saved on this device.</p>
      </div>
      <div class="space-y-2">
        <p class="text-sm font-medium">Accent color</p>
        <AccentPicker v-model="localAccent" />
      </div>
    </section>

    <!-- Privacy -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Privacy</h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Choose what appears on your public profile. By default nothing is shown.
      </p>

      <div v-if="supported" class="border-default flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <p class="font-medium">Make new decks private by default</p>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">Saved only in your Space, never public.</p>
        </div>
        <USwitch v-model="defaultPrivate" />
      </div>

      <SettingsRow v-model="showDecks" title="Show my decks on my profile" />
      <SettingsRow v-model="showProgress" title="Show my study progress on my profile" />
    </section>

    <!-- Notifications -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Notifications</h2>
      <SettingsRow
        v-model="reminderEnabled"
        title="Study reminders"
        description="Get a nudge to study at a time you pick."
      />
      <template v-if="reminderEnabled">
        <div class="space-y-2">
          <p class="text-sm font-medium">Reminder time</p>
          <UInput v-model="reminderTime" type="time" class="w-40" />
        </div>
        <div>
          <p class="mb-2 text-sm font-medium">Days</p>
          <div class="flex flex-wrap gap-1">
            <UButton
              v-for="(day, i) in WEEKDAYS"
              :key="i"
              :label="day"
              size="xs"
              :color="reminderDays.includes(i) ? 'primary' : 'neutral'"
              :variant="reminderDays.includes(i) ? 'solid' : 'subtle'"
              @click="toggleDay(i)"
            />
          </div>
        </div>
      </template>
    </section>

    <!-- Account -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Account</h2>
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
        Spaces on your PDS:
        <span :class="supported ? 'text-accent font-medium' : ''">{{
          supported === null ? 'checking…' : supported ? 'available' : 'not available'
        }}</span>
      </p>
      <UButton label="Sign out" icon="i-lucide-log-out" color="error" variant="subtle" @click="signOut" />
    </section>

    <!-- About -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">About</h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        OpenDeck lets you learn languages with flashcards you own, stored in your ATproto repository.
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton to="/terms" label="Terms of Service" icon="i-lucide-file-text" color="neutral" variant="subtle" />
        <UButton to="/privacy" label="Privacy Policy" icon="i-lucide-shield" color="neutral" variant="subtle" />
      </div>
    </section>
  </div>
</template>
