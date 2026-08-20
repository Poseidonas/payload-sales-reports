import { describe, expect, it } from 'vitest'

import { amountOf, buyerOf, createdAtOf, currencyOf, linesOf, toId } from '../src/documents.js'

describe('toId', () => {
  it('reads a numeric id as a string, for the postgres adapter', () => {
    expect(toId(7)).toBe('7')
  })

  it('reads the id of a populated document', () => {
    expect(toId({ id: 'abc' })).toBe('abc')
  })

  it('returns null for nothing', () => {
    expect(toId(null)).toBeNull()
  })
})

describe('amountOf', () => {
  it('reads the minor units as an integer', () => {
    expect(amountOf({ amount: 1999 })).toBe(1999)
  })

  it('truncates rather than rounding a stray fraction', () => {
    expect(amountOf({ amount: 1999.7 })).toBe(1999)
  })

  it('reads a missing amount as zero', () => {
    expect(amountOf({})).toBe(0)
    expect(amountOf({ amount: '1999' })).toBe(0)
  })
})

describe('currencyOf', () => {
  it('upper cases the code', () => {
    expect(currencyOf({ currency: 'eur' })).toBe('EUR')
  })

  it('names an order with no currency rather than dropping it', () => {
    expect(currencyOf({})).toBe('UNKNOWN')
  })
})

describe('createdAtOf', () => {
  it('reads an iso string', () => {
    expect(createdAtOf({ createdAt: '2026-08-19T00:00:00.000Z' })?.getUTCFullYear()).toBe(2026)
  })

  it('returns null for an unreadable value', () => {
    expect(createdAtOf({ createdAt: 'nonsense' })).toBeNull()
    expect(createdAtOf({})).toBeNull()
  })
})

describe('buyerOf', () => {
  it('keys a logged in order by customer, which carries no email', () => {
    expect(buyerOf({ customer: { id: 7 } })).toEqual({
      customer: '7',
      email: null,
      key: 'customer:7',
    })
  })

  it('keys a guest order by email', () => {
    expect(buyerOf({ customerEmail: 'Buyer@Example.com' })).toEqual({
      customer: null,
      email: 'buyer@example.com',
      key: 'email:buyer@example.com',
    })
  })

  it('prefers the customer when an order somehow carries both', () => {
    expect(buyerOf({ customer: '7', customerEmail: 'a@example.com' }).key).toBe('customer:7')
  })

  it('names an order with neither', () => {
    expect(buyerOf({}).key).toBe('unknown')
  })
})

describe('linesOf', () => {
  it('reads product, variant and quantity', () => {
    expect(linesOf({ items: [{ product: 'p1', quantity: 3, variant: { id: 'v1' } }] })).toEqual([
      { amount: null, product: 'p1', quantity: 3, variant: 'v1' },
    ])
  })

  it('reads a per line amount when the schema carries one', () => {
    expect(linesOf({ items: [{ amount: 500, product: 'p1' }] })[0]?.amount).toBe(500)
  })

  it('defaults a missing quantity to one', () => {
    expect(linesOf({ items: [{ product: 'p1' }] })[0]?.quantity).toBe(1)
  })

  it('refuses a negative quantity', () => {
    expect(linesOf({ items: [{ product: 'p1', quantity: -4 }] })[0]?.quantity).toBe(0)
  })

  it('returns nothing when there are no items', () => {
    expect(linesOf({})).toEqual([])
  })
})
