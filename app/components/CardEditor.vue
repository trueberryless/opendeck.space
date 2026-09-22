<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CardValue } from '~/composables/useDecks'

export interface CardFormData {
  front: string
  back: string
  hint?: string
  phonetic?: string
  phoneticFront?: string
  examples?: string[]
  image?: unknown
  imageAlt?: string
  audio?: unknown
  order?: number
}

const props = defineProps<{
  card?: Partial<CardValue>
  saving?: boolean
}>()

const emit = defineEmits<{ save: [data: CardFormData]; cancel: [] }>()

const { t } = useI18n()
const toast = useToast()
const { uploadImage, uploadAudio, blobUrl } = useMedia()
const authUser = useAuthUser()

const form = reactive({
  front: props.card?.front ?? '',
  back: props.card?.back ?? '',
  hint: props.card?.hint ?? '',
  phonetic: props.card?.phonetic ?? '',
  phoneticFront: props.card?.phoneticFront ?? '',
  examplesInput: (props.card?.examples ?? []).join('\n'),
  imageAlt: props.card?.imageAlt ?? '',
  order: props.card?.order,
})

const image = ref<unknown>(props.card?.image)
const audio = ref<unknown>(props.card?.audio)
const imagePreview = ref<string | null>(null)
const audioPreview = ref<string | null>(null)
const uploadingImage = ref(false)
const uploadingAudio = ref(false)

onMounted(async () => {
  const did = authUser.value?.did
  if (did && image.value) imagePreview.value = await blobUrl(did, image.value)
  if (did && audio.value) audioPreview.value = await blobUrl(did, audio.value)
})

async function onImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingImage.value = true
  try {
    const res = await uploadImage(file, file.type)
    image.value = res.blob
    imagePreview.value = URL.createObjectURL(file)
  } catch (err) {
    toast.add({ title: t('cardEditor.imageUploadFailed'), description: String(err), color: 'error' })
  } finally {
    uploadingImage.value = false
  }
}

async function onAudio(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingAudio.value = true
  try {
    const res = await uploadAudio(file, file.type)
    audio.value = res.blob
    audioPreview.value = URL.createObjectURL(file)
  } catch (err) {
    toast.add({ title: t('cardEditor.audioUploadFailed'), description: String(err), color: 'error' })
  } finally {
    uploadingAudio.value = false
  }
}

function removeImage() {
  image.value = undefined
  imagePreview.value = null
}
function removeAudio() {
  audio.value = undefined
  audioPreview.value = null
}

function submit() {
  if (!form.front.trim() || !form.back.trim()) return
  const examples = form.examplesInput
    .split('\n')
    .map((e) => e.trim())
    .filter(Boolean)
  emit('save', {
    front: form.front.trim(),
    back: form.back.trim(),
    hint: form.hint.trim() || undefined,
    phonetic: form.phonetic.trim() || undefined,
    phoneticFront: form.phoneticFront.trim() || undefined,
    examples: examples.length ? examples : undefined,
    image: image.value || undefined,
    imageAlt: image.value ? form.imageAlt.trim() || undefined : undefined,
    audio: audio.value || undefined,
    order: form.order,
  })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="$t('cardEditor.front')" name="front" required>
        <UTextarea
          v-model="form.front"
          :placeholder="$t('cardEditor.frontPlaceholder')"
          :rows="2"
          autofocus
          class="w-full"
        />
      </UFormField>
      <UFormField :label="$t('cardEditor.back')" name="back" required>
        <UTextarea v-model="form.back" :placeholder="$t('cardEditor.backPlaceholder')" :rows="2" class="w-full" />
      </UFormField>
    </div>

    <UFormField :label="$t('cardEditor.hint')" name="hint">
      <UInput v-model="form.hint" :placeholder="$t('cardEditor.hintPlaceholder')" class="w-full" />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="$t('cardEditor.readingFront')" name="phoneticFront">
        <UInput v-model="form.phoneticFront" :placeholder="$t('cardEditor.pronunciationPlaceholder')" class="w-full" />
      </UFormField>
      <UFormField :label="$t('cardEditor.readingBack')" name="phonetic">
        <UInput v-model="form.phonetic" :placeholder="$t('cardEditor.pronunciationPlaceholder')" class="w-full" />
      </UFormField>
    </div>

    <UFormField :label="$t('cardEditor.examples')" name="examples" :hint="$t('cardEditor.examplesHint')">
      <UTextarea v-model="form.examplesInput" :rows="2" class="w-full" />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <span class="block text-sm font-medium">{{ $t('cardEditor.image') }}</span>
        <div v-if="imagePreview" class="space-y-2">
          <img :src="imagePreview" alt="" class="border-default max-h-32 rounded-lg border" />
          <UButton
            :label="$t('common.remove')"
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="removeImage"
          />
          <UInput v-model="form.imageAlt" :placeholder="$t('cardEditor.altPlaceholder')" size="sm" class="w-full" />
        </div>
        <label v-else class="hover:text-accent inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-500">
          <UIcon
            :name="uploadingImage ? 'i-lucide-loader-circle' : 'i-lucide-image-plus'"
            :class="uploadingImage && 'animate-spin'"
            class="size-4"
          />
          {{ uploadingImage ? $t('cardEditor.uploading') : $t('cardEditor.addImage') }}
          <input type="file" accept="image/*" class="sr-only" :disabled="uploadingImage" @change="onImage" />
        </label>
      </div>

      <div class="space-y-2">
        <span class="block text-sm font-medium">{{ $t('cardEditor.audio') }}</span>
        <div v-if="audioPreview" class="space-y-2">
          <audio :src="audioPreview" controls class="w-full" />
          <UButton
            :label="$t('common.remove')"
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="removeAudio"
          />
        </div>
        <label v-else class="hover:text-accent inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-500">
          <UIcon
            :name="uploadingAudio ? 'i-lucide-loader-circle' : 'i-lucide-music'"
            :class="uploadingAudio && 'animate-spin'"
            class="size-4"
          />
          {{ uploadingAudio ? $t('cardEditor.uploading') : $t('cardEditor.addAudio') }}
          <input type="file" accept="audio/*" class="sr-only" :disabled="uploadingAudio" @change="onAudio" />
        </label>
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="emit('cancel')" />
      <UButton
        type="submit"
        :label="$t('cardEditor.saveCard')"
        :loading="saving"
        :disabled="!form.front.trim() || !form.back.trim()"
      />
    </div>
  </form>
</template>
