import type { Config } from '@netlify/functions'
import { sendDueReminders } from '../lib/push'

export default async (): Promise<void> => {
  const { sent, removed } = await sendDueReminders()
  console.log(`[opendeck] reminders sent: ${sent}, stale subscriptions removed: ${removed}`)
}

export const config: Config = {
  schedule: '@hourly',
}
