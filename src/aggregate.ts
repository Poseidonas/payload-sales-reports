import type { PayloadRequest, Where } from 'payload'

import type { Doc } from './documents.js'
import type {
  CustomerRow,
  Period,
  PeriodRow,
  ProductRow,
  ResolvedConfig,
  SalesReport,
  SalesReportsConfig,
  TotalRow,
} from './types.js'

import { resolveConfig } from './config.js'
import { amountOf, buyerOf, createdAtOf, currencyOf, linesOf, toId } from './documents.js'
import { periodKey } from './period.js'

export type ReportQuery = {
  config?: ResolvedConfig | SalesReportsConfig
  currency?: string
  from?: Date | null | string
  limit?: number
  period?: Period
  req: PayloadRequest
  to?: Date | null | string
}

type Bucket = { orders: number; revenue: number; units: number }

const asConfig = (value: ReportQuery['config']): ResolvedConfig =>
  value && 'apiRoute' in value ? (value as ResolvedConfig) : resolveConfig(value)

const asDate = (value: Date | null | string | undefined): Date | null => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isFinite(date.getTime()) ? date : null
}

export const ordersWhere = (args: {
  config: ResolvedConfig
  currency: null | string
  from: Date | null
  to: Date | null
}): Where => {
  const { config, currency, from, to } = args
  const clauses: Where[] = [{ status: { in: config.statuses } }]

  if (from) {
    clauses.push({ createdAt: { greater_than_equal: from.toISOString() } })
  }

  if (to) {
    clauses.push({ createdAt: { less_than_equal: to.toISOString() } })
  }

  if (currency) {
    clauses.push({ currency: { equals: currency } })
  }

  return { and: clauses }
}

const bump = (
  map: Map<string, Bucket>,
  key: string,
  orders: number,
  revenue: number,
  units: number,
): void => {
  const current = map.get(key) ?? { orders: 0, revenue: 0, units: 0 }

  current.orders += orders
  current.revenue += revenue
  current.units += units
  map.set(key, current)
}

const productTitles = async (args: {
  config: ResolvedConfig
  req: PayloadRequest
  rows: ProductRow[]
}): Promise<ProductRow[]> => {
  const ids = [...new Set(args.rows.map((row) => row.product).filter((id) => id.length > 0))]

  if (ids.length === 0) {
    return args.rows
  }

  const titles = new Map<string, string>()

  try {
    const found = await args.req.payload.find({
      collection: args.config.productsSlug,
      depth: 0,
      limit: ids.length,
      overrideAccess: true,
      pagination: false,
      req: args.req,
      where: { id: { in: ids } },
    })

    for (const doc of found.docs as Doc[]) {
      const id = toId(doc.id)
      const title = doc.title ?? doc.name

      if (id !== null && typeof title === 'string') {
        titles.set(id, title)
      }
    }
  } catch {
    return args.rows
  }

  return args.rows.map((row) => ({ ...row, title: titles.get(row.product) ?? null }))
}

/**
 * Reads matching orders one page at a time and accumulates into maps. A page is
 * released before the next is read, so memory follows the number of distinct
 * groups rather than the number of orders.
 */
export const salesReport = async (query: ReportQuery): Promise<SalesReport> => {
  const config = asConfig(query.config)
  const period = query.period ?? config.period
  const from = asDate(query.from)
  const to = asDate(query.to)
  const currency =
    typeof query.currency === 'string' && query.currency.length > 0
      ? query.currency.toUpperCase()
      : null
  const limit =
    typeof query.limit === 'number' && Number.isFinite(query.limit) && query.limit >= 0
      ? Math.trunc(query.limit)
      : config.limit

  const totals = new Map<string, Bucket>()
  const periods = new Map<string, Bucket>()
  const products = new Map<string, Bucket>()
  const customers = new Map<string, Bucket>()
  const buyers = new Map<string, { customer: null | string; email: null | string }>()

  let orders = 0
  let truncated = false
  let revenueByProductAvailable = true
  let page = 1

  for (;;) {
    const result = await query.req.payload.find({
      collection: config.ordersSlug,
      depth: 0,
      limit: config.pageSize,
      overrideAccess: true,
      page,
      req: query.req,
      sort: 'createdAt',
      where: ordersWhere({ config, currency, from, to }),
    })

    for (const doc of result.docs as Doc[]) {
      if (orders >= config.maxOrders) {
        truncated = true
        break
      }

      orders += 1

      const code = currencyOf(doc)
      const revenue = amountOf(doc)
      const lines = linesOf(doc)
      const units = lines.reduce((sum, line) => sum + line.quantity, 0)

      bump(totals, code, 1, revenue, units)

      const created = createdAtOf(doc)
      const key = created === null ? null : periodKey({ date: created, period, timeZone: config.timeZone })

      if (key !== null) {
        bump(periods, `${key} ${code}`, 1, revenue, units)
      }

      const buyer = buyerOf(doc)

      buyers.set(buyer.key, { customer: buyer.customer, email: buyer.email })
      bump(customers, `${buyer.key} ${code}`, 1, revenue, units)

      const counted = new Set<string>()

      for (const line of lines) {
        if (line.product === null && line.variant === null) {
          continue
        }

        if (line.amount === null) {
          revenueByProductAvailable = false
        }

        const productKey = `${line.product ?? ''} ${line.variant ?? ''} ${code}`
        const first = counted.has(productKey) ? 0 : 1

        counted.add(productKey)
        bump(
          products,
          productKey,
          first,
          line.amount === null ? 0 : line.amount * line.quantity,
          line.quantity,
        )
      }
    }

    if (truncated || result.hasNextPage !== true) {
      break
    }

    page += 1
  }

  const totalRows: TotalRow[] = [...totals.entries()]
    .map(([code, bucket]) => ({ currency: code, ...bucket }))
    .sort((a, b) => a.currency.localeCompare(b.currency))

  const periodRows: PeriodRow[] = [...periods.entries()]
    .map(([key, bucket]) => {
      const [name = '', code = ''] = key.split(' ')

      return { currency: code, period: name, ...bucket }
    })
    .sort((a, b) => a.period.localeCompare(b.period) || a.currency.localeCompare(b.currency))

  const productRows: ProductRow[] = [...products.entries()]
    .map(([key, bucket]) => {
      const [product = '', variant = '', code = ''] = key.split(' ')

      return {
        currency: code,
        orders: bucket.orders,
        product,
        revenue: revenueByProductAvailable ? bucket.revenue : null,
        title: null,
        units: bucket.units,
        variant: variant === '' ? null : variant,
      }
    })
    .sort((a, b) => b.units - a.units || a.product.localeCompare(b.product))

  const customerRows: CustomerRow[] = [...customers.entries()]
    .map(([key, bucket]) => {
      const [buyerKey = '', code = ''] = key.split(' ')
      const buyer = buyers.get(buyerKey) ?? { customer: null, email: null }

      return { currency: code, key: buyerKey, ...buyer, ...bucket }
    })
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)

  const cut = <T>(rows: T[]): T[] => (limit > 0 ? rows.slice(0, limit) : rows)

  return {
    byCustomer: cut(customerRows),
    byPeriod: periodRows,
    byProduct: await productTitles({ config, req: query.req, rows: cut(productRows) }),
    currencies: totalRows.map((row) => row.currency),
    from: from ? from.toISOString() : null,
    orders,
    period,
    revenueByProductAvailable,
    statuses: config.statuses,
    timeZone: config.timeZone,
    to: to ? to.toISOString() : null,
    totals: totalRows,
    truncated,
  }
}

export const salesByPeriod = async (query: ReportQuery): Promise<PeriodRow[]> =>
  (await salesReport(query)).byPeriod

export const salesByProduct = async (query: ReportQuery): Promise<ProductRow[]> =>
  (await salesReport(query)).byProduct

export const salesByCustomer = async (query: ReportQuery): Promise<CustomerRow[]> =>
  (await salesReport(query)).byCustomer
