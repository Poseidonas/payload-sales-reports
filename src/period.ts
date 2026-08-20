import type { Period } from './types.js'

export type DateParts = {
  day: number
  month: number
  year: number
}

const cache = new Map<string, Intl.DateTimeFormat>()

const formatter = (timeZone: string): Intl.DateTimeFormat => {
  let found = cache.get(timeZone)

  if (!found) {
    found = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    })
    cache.set(timeZone, found)
  }

  return found
}

export const isTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })

    return true
  } catch {
    return false
  }
}

export const partsIn = (date: Date, timeZone: string): DateParts => {
  const parts = formatter(timeZone).formatToParts(date)
  const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? 0)

  return { day: read('day'), month: read('month'), year: read('year') }
}

export const isoWeek = (parts: DateParts): { week: number; year: number } => {
  const thursday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))

  thursday.setUTCDate(thursday.getUTCDate() - ((thursday.getUTCDay() + 6) % 7) + 3)

  const year = thursday.getUTCFullYear()
  const first = new Date(Date.UTC(year, 0, 4))

  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7) + 3)

  return {
    week: 1 + Math.round((thursday.getTime() - first.getTime()) / (7 * 86_400_000)),
    year,
  }
}

const pad = (value: number, width: number): string => String(value).padStart(width, '0')

export const periodKey = (args: {
  date: Date
  period: Period
  timeZone: string
}): null | string => {
  const { date, period, timeZone } = args

  if (!Number.isFinite(date.getTime())) {
    return null
  }

  const parts = partsIn(date, timeZone)

  if (period === 'year') {
    return pad(parts.year, 4)
  }

  if (period === 'month') {
    return `${pad(parts.year, 4)}-${pad(parts.month, 2)}`
  }

  if (period === 'week') {
    const { week, year } = isoWeek(parts)

    return `${pad(year, 4)}-W${pad(week, 2)}`
  }

  return `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`
}

export const isPeriod = (value: unknown): value is Period =>
  value === 'day' || value === 'month' || value === 'week' || value === 'year'
