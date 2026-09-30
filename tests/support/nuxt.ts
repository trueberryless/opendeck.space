import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent } from 'vue'

export async function inSetup<T>(fn: () => T): Promise<T> {
  let result!: T
  await mountSuspended(
    defineComponent({
      setup() {
        result = fn()
        return () => null
      },
    }),
  )
  return result
}
