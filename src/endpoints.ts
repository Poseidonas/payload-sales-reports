import type { Endpoint, PayloadHandler, PayloadRequest } from 'payload'

import type { Period, ResolvedConfig } from './types.js'

import { salesReport } from './aggregate.js'
import { isPeriod } from './period.js'

const json = (body: Record<string, unknown>, status: number): Response =>
  Response.json(body, { status })

const param = (req: PayloadRequest, key: string): undefined | string => {
  const fromUrl = req.searchParams?.get(key)

  if (typeof fromUrl === 'string' && fromUrl.length > 0) {
    return fromUrl
  }

  const fromQuery = req.query?.[key]

  return typeof fromQuery === 'string' && fromQuery.length > 0 ? fromQuery : undefined
}

const guard = async (
  config: ResolvedConfig,
  req: PayloadRequest,
): Promise<null | Response> => {
  if (config.disabled) {
    return json({ message: 'Sales reports are disabled.' }, 404)
  }

  const allowed = await config.isAdmin({ req } as Parameters<ResolvedConfig['isAdmin']>[0])

  if (allowed !== true) {
    return json({ message: 'Not allowed.' }, 403)
  }

  return null
}

const queryFrom = (
  config: ResolvedConfig,
  req: PayloadRequest,
): { currency?: string; from?: string; limit?: number; period?: Period; to?: string } => {
  const period = param(req, 'period')
  const limit = param(req, 'limit')
  const currency = param(req, 'currency')
  const from = param(req, 'from')
  const to = param(req, 'to')

  return {
    ...(currency ? { currency } : {}),
    ...(from ? { from } : {}),
    ...(limit !== undefined && Number.isFinite(Number(limit)) ? { limit: Number(limit) } : {}),
    ...(isPeriod(period) ? { period } : { period: config.period }),
    ...(to ? { to } : {}),
  }
}

export const summaryHandler =
  (config: ResolvedConfig): PayloadHandler =>
  async (req) => {
    const refusal = await guard(config, req)

    if (refusal) {
      return refusal
    }

    const report = await salesReport({ config, ...queryFrom(config, req), req })

    return json(
      {
        byPeriod: report.byPeriod,
        currencies: report.currencies,
        from: report.from,
        orders: report.orders,
        period: report.period,
        statuses: report.statuses,
        timeZone: report.timeZone,
        to: report.to,
        totals: report.totals,
        truncated: report.truncated,
      },
      200,
    )
  }

export const byProductHandler =
  (config: ResolvedConfig): PayloadHandler =>
  async (req) => {
    const refusal = await guard(config, req)

    if (refusal) {
      return refusal
    }

    const report = await salesReport({ config, ...queryFrom(config, req), req })

    return json(
      {
        byProduct: report.byProduct,
        orders: report.orders,
        revenueByProductAvailable: report.revenueByProductAvailable,
        statuses: report.statuses,
        truncated: report.truncated,
      },
      200,
    )
  }

export const byCustomerHandler =
  (config: ResolvedConfig): PayloadHandler =>
  async (req) => {
    const refusal = await guard(config, req)

    if (refusal) {
      return refusal
    }

    const report = await salesReport({ config, ...queryFrom(config, req), req })

    return json(
      {
        byCustomer: report.byCustomer,
        orders: report.orders,
        statuses: report.statuses,
        truncated: report.truncated,
      },
      200,
    )
  }

export const salesReportEndpoints = (config: ResolvedConfig): Endpoint[] => [
  {
    handler: summaryHandler(config),
    method: 'get',
    path: `${config.endpointPath}/summary`,
  },
  {
    handler: byProductHandler(config),
    method: 'get',
    path: `${config.endpointPath}/by-product`,
  },
  {
    handler: byCustomerHandler(config),
    method: 'get',
    path: `${config.endpointPath}/by-customer`,
  },
]
