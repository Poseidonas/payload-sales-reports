import { describe, expect, it } from 'vitest'

import { ordersWhere, salesByCustomer, salesByPeriod, salesByProduct, salesReport } from '../src/aggregate.js'
import { resolveConfig } from '../src/config.js'
import { createLab, order } from './fake.js'

const config = resolveConfig()

describe('ordersWhere', () => {
  it('asks only for the statuses that count', () => {
    const where = ordersWhere({ config, currency: null, from: null, to: null })

    expect(where).toEqual({ and: [{ status: { in: ['processing', 'completed'] } }] })
  })

  it('adds the range and the currency when they are given', () => {
    const where = ordersWhere({
      config,
      currency: 'EUR',
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-12-31T00:00:00.000Z'),
    })

    expect(where.and).toHaveLength(4)
  })
})

describe('salesReport', () => {
  it('counts only orders in a counted status', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ status: 'processing' }),
      order({ status: 'completed' }),
      order({ status: 'cancelled' }),
      order({ status: 'refunded' }),
    ])

    const report = await salesReport({ config, req: lab.req })

    expect(report.orders).toBe(2)
    expect(report.totals[0]).toMatchObject({ currency: 'EUR', orders: 2, revenue: 2000 })
  })

  it('honours a narrower status list', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ status: 'processing' }), order({ status: 'completed' })])

    const report = await salesReport({ config: resolveConfig({ statuses: ['completed'] }), req: lab.req })

    expect(report.orders).toBe(1)
  })

  it('keeps currencies apart rather than summing them', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ amount: 1000, currency: 'EUR' }),
      order({ amount: 2000, currency: 'USD' }),
    ])

    const report = await salesReport({ config, req: lab.req })

    expect(report.totals).toEqual([
      { currency: 'EUR', orders: 1, revenue: 1000, units: 1 },
      { currency: 'USD', orders: 1, revenue: 2000, units: 1 },
    ])
    expect(report.currencies).toEqual(['EUR', 'USD'])
  })

  it('filters to one currency when asked', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ currency: 'EUR' }), order({ currency: 'USD' })])

    const report = await salesReport({ config, currency: 'usd', req: lab.req })

    expect(report.currencies).toEqual(['USD'])
  })

  it('works in minor units, never in decimals', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ amount: 1999 })])

    expect((await salesReport({ config, req: lab.req })).totals[0]?.revenue).toBe(1999)
  })

  it('groups by month by default', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ createdAt: '2026-07-31T10:00:00.000Z' }),
      order({ createdAt: '2026-08-01T10:00:00.000Z' }),
      order({ createdAt: '2026-08-19T10:00:00.000Z' }),
    ])

    const report = await salesReport({ config, req: lab.req })

    expect(report.byPeriod.map((row) => row.period)).toEqual(['2026-07', '2026-08'])
    expect(report.byPeriod[1]?.orders).toBe(2)
  })

  it('groups by day when asked', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ createdAt: '2026-08-19T10:00:00.000Z' })])

    const rows = await salesByPeriod({ config, period: 'day', req: lab.req })

    expect(rows[0]?.period).toBe('2026-08-19')
  })

  it('cuts periods on the configured time zone', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ createdAt: '2026-08-31T22:00:00.000Z' })])

    const rows = await salesByPeriod({
      config: resolveConfig({ timeZone: 'Europe/Athens' }),
      req: lab.req,
    })

    expect(rows[0]?.period).toBe('2026-09')
  })

  it('sorts periods ascending, so a chart can use them as they are', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ createdAt: '2026-12-01T10:00:00.000Z' }),
      order({ createdAt: '2026-01-01T10:00:00.000Z' }),
    ])

    const rows = await salesByPeriod({ config, req: lab.req })

    expect(rows.map((row) => row.period)).toEqual(['2026-01', '2026-12'])
  })

  it('limits the range with from and to', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ createdAt: '2026-01-01T10:00:00.000Z' }),
      order({ createdAt: '2026-08-19T10:00:00.000Z' }),
    ])

    const report = await salesReport({
      config,
      from: '2026-06-01T00:00:00.000Z',
      req: lab.req,
    })

    expect(report.orders).toBe(1)
    expect(report.from).toBe('2026-06-01T00:00:00.000Z')
  })

  it('ignores an unreadable from', async () => {
    const lab = createLab()

    lab.seed('orders', [order({})])

    const report = await salesReport({ config, from: 'nonsense', req: lab.req })

    expect(report.orders).toBe(1)
    expect(report.from).toBeNull()
  })

  it('counts units from the line quantities', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ items: [{ product: 'p1', quantity: 2 }, { product: 'p2', quantity: 3 }] }),
    ])

    expect((await salesReport({ config, req: lab.req })).totals[0]?.units).toBe(5)
  })

  it('reports units per product and no revenue, because the order line carries none', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ items: [{ product: 'p1', quantity: 2 }] })])

    const report = await salesReport({ config, req: lab.req })

    expect(report.revenueByProductAvailable).toBe(false)
    expect(report.byProduct[0]).toMatchObject({ product: 'p1', revenue: null, units: 2 })
  })

  it('reports revenue per product when the order line carries an amount', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ items: [{ amount: 500, product: 'p1', quantity: 2 }] })])

    const report = await salesReport({ config, req: lab.req })

    expect(report.revenueByProductAvailable).toBe(true)
    expect(report.byProduct[0]?.revenue).toBe(1000)
  })

  it('keeps a variant apart from its product', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ items: [{ product: 'p1', quantity: 1, variant: 'v1' }] })])

    expect((await salesByProduct({ config, req: lab.req }))[0]).toMatchObject({
      product: 'p1',
      variant: 'v1',
    })
  })

  it('counts an order once per product even when it appears on two lines', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ items: [{ product: 'p1', quantity: 1 }, { product: 'p1', quantity: 2 }] }),
    ])

    expect((await salesByProduct({ config, req: lab.req }))[0]).toMatchObject({
      orders: 1,
      units: 3,
    })
  })

  it('sorts products by units sold', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ items: [{ product: 'p1', quantity: 1 }] }),
      order({ items: [{ product: 'p2', quantity: 9 }] }),
    ])

    expect((await salesByProduct({ config, req: lab.req })).map((row) => row.product)).toEqual([
      'p2',
      'p1',
    ])
  })

  it('names the product when the catalogue still has it', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ items: [{ product: 'p1', quantity: 1 }] })])
    lab.seed('products', [{ id: 'p1', title: 'Blue mug' }])

    expect((await salesByProduct({ config, req: lab.req }))[0]?.title).toBe('Blue mug')
  })

  it('leaves the title empty when the product is gone', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ items: [{ product: 'p1', quantity: 1 }] })])

    expect((await salesByProduct({ config, req: lab.req }))[0]?.title).toBeNull()
  })

  it('groups a logged in buyer by customer and a guest by email', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ amount: 1000, customer: '7' }),
      order({ amount: 500, customer: '7' }),
      order({ amount: 300, customerEmail: 'guest@example.com' }),
    ])

    const rows = await salesByCustomer({ config, req: lab.req })

    expect(rows).toEqual([
      { currency: 'EUR', customer: '7', email: null, key: 'customer:7', orders: 2, revenue: 1500, units: 2 },
      {
        currency: 'EUR',
        customer: null,
        email: 'guest@example.com',
        key: 'email:guest@example.com',
        orders: 1,
        revenue: 300,
        units: 1,
      },
    ])
  })

  it('sorts customers by revenue', async () => {
    const lab = createLab()

    lab.seed('orders', [
      order({ amount: 100, customer: '1' }),
      order({ amount: 900, customer: '2' }),
    ])

    expect((await salesByCustomer({ config, req: lab.req })).map((row) => row.customer)).toEqual([
      '2',
      '1',
    ])
  })

  it('reads in pages rather than in one query', async () => {
    const lab = createLab()

    lab.seed('orders', Array.from({ length: 25 }, () => order({})))

    const report = await salesReport({ config: resolveConfig({ pageSize: 10 }), req: lab.req })

    expect(report.orders).toBe(25)
    expect(lab.queries.filter((entry) => entry.collection === 'orders')).toHaveLength(3)
    expect(lab.queries[0]?.limit).toBe(10)
  })

  it('stops at maxOrders and says so', async () => {
    const lab = createLab()

    lab.seed('orders', Array.from({ length: 25 }, () => order({})))

    const report = await salesReport({
      config: resolveConfig({ maxOrders: 12, pageSize: 10 }),
      req: lab.req,
    })

    expect(report.truncated).toBe(true)
    expect(report.orders).toBe(12)
  })

  it('limits grouped rows but never the periods', async () => {
    const lab = createLab()

    lab.seed(
      'orders',
      Array.from({ length: 6 }, (_, index) =>
        order({
          createdAt: `2026-0${index + 1}-01T10:00:00.000Z`,
          customer: String(index),
          items: [{ product: `p${index}`, quantity: index + 1 }],
        }),
      ),
    )

    const report = await salesReport({ config, limit: 2, req: lab.req })

    expect(report.byPeriod).toHaveLength(6)
    expect(report.byProduct).toHaveLength(2)
    expect(report.byCustomer).toHaveLength(2)
  })

  it('returns every row when the limit is zero', async () => {
    const lab = createLab()

    lab.seed(
      'orders',
      Array.from({ length: 6 }, (_, index) =>
        order({ items: [{ product: `p${index}`, quantity: 1 }] }),
      ),
    )

    expect((await salesReport({ config, limit: 0, req: lab.req })).byProduct).toHaveLength(6)
  })

  it('reports an empty store without failing', async () => {
    const lab = createLab()
    const report = await salesReport({ config, req: lab.req })

    expect(report).toMatchObject({
      byCustomer: [],
      byPeriod: [],
      byProduct: [],
      currencies: [],
      orders: 0,
      truncated: false,
    })
  })

  it('states the statuses, the grouping and the zone it used', async () => {
    const lab = createLab()
    const report = await salesReport({ config, req: lab.req })

    expect(report).toMatchObject({
      period: 'month',
      statuses: ['processing', 'completed'],
      timeZone: 'UTC',
    })
  })

  it('keeps an order with no createdAt out of the periods but inside the totals', async () => {
    const lab = createLab()

    lab.seed('orders', [order({ createdAt: undefined })])

    const report = await salesReport({ config, req: lab.req })

    expect(report.orders).toBe(1)
    expect(report.byPeriod).toEqual([])
  })
})
