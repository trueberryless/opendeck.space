import { describe, expect, it } from 'vitest'
import { isReminderDue } from '~~/shared/reminders'

describe('isReminderDue', () => {
  const monday19Utc = new Date('2026-06-15T19:30:00Z')

  it('is never due when disabled', () => {
    expect(isReminderDue({}, 'UTC', monday19Utc)).toBe(false)
  })

  it('is due at the default hour on default weekdays', () => {
    expect(isReminderDue({ reminderEnabled: true }, 'UTC', monday19Utc)).toBe(true)
  })

  it('respects the hour, days and time zone', () => {
    expect(isReminderDue({ reminderEnabled: true, reminderHour: 8 }, 'UTC', monday19Utc)).toBe(false)
    expect(isReminderDue({ reminderEnabled: true, reminderDays: [0, 6] }, 'UTC', monday19Utc)).toBe(false)
    expect(isReminderDue({ reminderEnabled: true, reminderHour: 21 }, 'Europe/Vienna', monday19Utc)).toBe(true)
  })

  it('does not fire on weekends by default', () => {
    expect(isReminderDue({ reminderEnabled: true }, 'UTC', new Date('2026-06-14T19:00:00Z'))).toBe(false)
  })
})
