export const DEFAULT_REMINDER_HOUR = 19
export const DEFAULT_REMINDER_DAYS = [1, 2, 3, 4, 5]

export interface ReminderSchedule {
  reminderEnabled?: boolean
  reminderHour?: number
  reminderDays?: number[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function localHourAndDay(now: Date, timeZone: string): { hour: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const day = WEEKDAYS.indexOf(parts.find((p) => p.type === 'weekday')?.value ?? '')
  return { hour, day }
}

export function isReminderDue(schedule: ReminderSchedule, timeZone: string, now: Date = new Date()): boolean {
  if (!schedule.reminderEnabled) return false
  const { hour, day } = localHourAndDay(now, timeZone)
  const days = schedule.reminderDays ?? DEFAULT_REMINDER_DAYS
  return days.includes(day) && hour === (schedule.reminderHour ?? DEFAULT_REMINDER_HOUR)
}
