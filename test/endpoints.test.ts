import type { PayloadRequest } from 'payload'

import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../src/config.js'
import { byCustomerHandler, byProductHandler, summaryHandler } from '../src/endpoints.js'
import { createLab, order } from './fake.js'

const allowAll = resolveConfig({ isAdmin: () => true })

const withQuery = (req: PayloadRequest, values: Record<string, string>): PayloadRequest =>
  ({ ...req, query: values, searchParams: new URLSearchParams(values) }) as PayloadRequest

describe('summaryHandler', () => {
  it('refuses a request the access check rejects', async () => {
    const lab = createLab()

    expect((await summaryHandler(resolveConfig())(lab.req)).status).toBe(403)
  })

  it('returns the totals and the periods', async () => {
    const lab = createLab()

    lab.seed('orders', [order({})])

    const response = await summaryHandler(allowAll)(lab.req)
    const body = (await response.json()) as {
      byPeriod: { period: string }[]
      orders: number
      totals: unknown[]
    }

    expect(response.status).toBe(200)
    expect(body.orders).toBe(1)
    expect(body.byPeriod[0]?.period).toBe('2026-08')
    expect(body.totals).toHaveLength(1)
  })

  it('says which statuses it counted', async () => {
    const lab = createLab()
    const body = (await (await summaryHandler(allowAll)(lab.req)).json()) as { statuses: string[] }

    expect(body.statuses).toEqual(['processing', 'completed'])
  })

  it('takes the grouping from the query', async () => {
    const lab = createLab()

    lab.seed('orders', [order({})])

    const response = await summaryHandler(allowAll)(withQuery(lab.req, { period: 'day' }))
    const body = (await response.json()) as { byPeriod: { period: string }[]; period: string }

    expect(body.period).toBe('day')
    expect(body.byPeriod[0]?.period).toBe('2026-08-19')
  })

  it('ignores an unknown grouping and uses the configured one', async () => {
    const lab = createLab()

    const response = await summaryHandler(allowAll)(withQuery(lab.req, { period: 'quarter' }))

    expect(((await response.json()) as { period: string }).period).toBe('month')
  })

  it('takes the range and the currency from the query', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ createdAt: '2026-01-01T10:00:00.000Z' }),
      order({ createdAt: '2026-08-19T10:00:00.000Z', currency: 'USD' }),
    ])

    const response = await summaryHandler(allowAll)(
      withQuery(lab.req, { currency: 'USD', from: '2026-06-01T00:00:00.000Z' }),
    )

    expect(((await response.json()) as { orders: number }).orders).toBe(1)
  })

  it('reads the query from req.query when there are no search params', async () => {
    const lab = createLab()

    lab.seed('orders', [order({})])

    const response = await summaryHandler(allowAll)({
      ...lab.req,
      query: { period: 'year' },
      searchParams: new URLSearchParams(),
    } as PayloadRequest)

    expect(((await response.json()) as { period: string }).period).toBe('year')
  })

  it('returns 404 when the plugin is disabled', async () => {
    const lab = createLab()
    const response = await summaryHandler(
      resolveConfig({ disabled: true, isAdmin: () => true }),
    )(lab.req)

    expect(response.status).toBe(404)
  })
})

describe('byProductHandler', () => {
  it('refuses a request the access check rejects', async () => {
    const lab = createLab()

    expect((await byProductHandler(resolveConfig())(lab.req)).status).toBe(403)
  })

  it('returns the rows and says whether revenue could be attributed', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ items: [{ product: 'p1', quantity: 2 }] })])

    const body = (await (await byProductHandler(allowAll)(lab.req)).json()) as {
      byProduct: { units: number }[]
      revenueByProductAvailable: boolean
    }

    expect(body.byProduct[0]?.units).toBe(2)
    expect(body.revenueByProductAvailable).toBe(false)
  })

  it('takes the row limit from the query', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ items: [{ product: 'p1', quantity: 1 }] }),
      order({ items: [{ product: 'p2', quantity: 2 }] }),
    ])

    const response = await byProductHandler(allowAll)(withQuery(lab.req, { limit: '1' }))

    expect(((await response.json()) as { byProduct: unknown[] }).byProduct).toHaveLength(1)
  })
})

describe('byCustomerHandler', () => {
  it('refuses a request the access check rejects', async () => {
    const lab = createLab()

    expect((await byCustomerHandler(resolveConfig())(lab.req)).status).toBe(403)
  })

  it('returns one row per buyer', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ customer: '7' }), order({ customerEmail: 'g@example.com' })])

    const body = (await (await byCustomerHandler(allowAll)(lab.req)).json()) as {
      byCustomer: unknown[]
    }

    expect(body.byCustomer).toHaveLength(2)
  })
})
