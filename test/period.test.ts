import { describe, expect, it } from 'vitest'

import { isoWeek, isPeriod, isTimeZone, partsIn, periodKey } from '../src/period.js'

describe('periodKey', () => {
  const date = new Date('2026-08-19T10:30:00.000Z')

  it('groups by day', () => {
    expect(periodKey({ date, period: 'day', timeZone: 'UTC' })).toBe('2026-08-19')
  })

  it('groups by month', () => {
    expect(periodKey({ date, period: 'month', timeZone: 'UTC' })).toBe('2026-08')
  })

  it('groups by year', () => {
    expect(periodKey({ date, period: 'year', timeZone: 'UTC' })).toBe('2026')
  })

  it('groups by iso week', () => {
    expect(periodKey({ date, period: 'week', timeZone: 'UTC' })).toBe('2026-W34')
  })

  it('cuts the day on the boundary of the given time zone', () => {
    const late = new Date('2026-08-19T22:30:00.000Z')

    expect(periodKey({ date: late, period: 'day', timeZone: 'UTC' })).toBe('2026-08-19')
    expect(periodKey({ date: late, period: 'day', timeZone: 'Europe/Athens' })).toBe('2026-08-20')
  })

  it('cuts the month on the boundary of the given time zone', () => {
    const late = new Date('2026-08-31T22:30:00.000Z')

    expect(periodKey({ date: late, period: 'month', timeZone: 'UTC' })).toBe('2026-08')
    expect(periodKey({ date: late, period: 'month', timeZone: 'Europe/Athens' })).toBe('2026-09')
  })

  it('pads a single digit month and day, so keys sort as text', () => {
    expect(periodKey({ date: new Date('2026-01-05T00:00:00.000Z'), period: 'day', timeZone: 'UTC' }))
      .toBe('2026-01-05')
  })

  it('returns null for an unreadable date', () => {
    expect(periodKey({ date: new Date('nonsense'), period: 'day', timeZone: 'UTC' })).toBeNull()
  })
})

describe('isoWeek', () => {
  it('puts the first of January 2026 in the first week of 2026', () => {
    expect(isoWeek({ day: 1, month: 1, year: 2026 })).toEqual({ week: 1, year: 2026 })
  })

  it('puts the first of January 2027 in the week of the preceding year', () => {
    expect(isoWeek({ day: 1, month: 1, year: 2027 })).toEqual({ week: 53, year: 2026 })
  })

  it('counts the week of a mid year date', () => {
    expect(isoWeek({ day: 19, month: 8, year: 2026 })).toEqual({ week: 34, year: 2026 })
  })
})

describe('partsIn', () => {
  it('reads the parts in the given zone', () => {
    expect(partsIn(new Date('2026-08-19T23:30:00.000Z'), 'Europe/Athens')).toEqual({
      day: 20,
      month: 8,
      year: 2026,
    })
  })
})

describe('isTimeZone', () => {
  it('accepts a real zone', () => {
    expect(isTimeZone('Europe/Athens')).toBe(true)
    expect(isTimeZone('UTC')).toBe(true)
  })

  it('refuses nonsense', () => {
    expect(isTimeZone('Middle/Earth')).toBe(false)
  })
})

describe('isPeriod', () => {
  it('accepts the four groupings', () => {
    expect(['day', 'week', 'month', 'year'].every(isPeriod)).toBe(true)
  })

  it('refuses anything else', () => {
    expect(isPeriod('quarter')).toBe(false)
    expect(isPeriod(undefined)).toBe(false)
  })
})
