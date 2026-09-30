import { onTestFinished } from 'vitest'

export function stubNavigator(props: Record<string, unknown>) {
  for (const [key, value] of Object.entries(props)) {
    const own = Object.getOwnPropertyDescriptor(navigator, key)
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true })
    onTestFinished(() => {
      if (own) Object.defineProperty(navigator, key, own)
      else Reflect.deleteProperty(navigator, key)
    })
  }
}
