import type { Config } from 'payload'

import { resolveConfig, withApiRoute } from './config.js'
import { salesReportEndpoints } from './endpoints.js'
import type { SalesReportsConfig } from './types.js'

export { salesByCustomer, salesByPeriod, salesByProduct, salesReport, ordersWhere } from './aggregate.js'
export type { ReportQuery } from './aggregate.js'
export { resolveConfig } from './config.js'
export { isPeriod, isoWeek, partsIn, periodKey } from './period.js'
export type { DateParts } from './period.js'
export type {
  CustomerRow,
  Period,
  PeriodRow,
  ProductRow,
  ResolvedConfig,
  SalesReport,
  SalesReportsConfig,
  TotalRow,
} from './types.js'

export const salesReportsPlugin =
  (incoming: SalesReportsConfig = {}) =>
  (incomingConfig: Config): Config => {
    const config = withApiRoute(resolveConfig(incoming), incomingConfig.routes?.api)
    const collections = incomingConfig.collections ?? []

    if (!collections.some((collection) => collection.slug === config.ordersSlug)) {
      return incomingConfig
    }

    const withEndpoints: Config = {
      ...incomingConfig,
      endpoints: [...(incomingConfig.endpoints ?? []), ...salesReportEndpoints(config)],
    }

    if (!config.adminView) {
      return withEndpoints
    }

    const admin = withEndpoints.admin ?? {}
    const components = admin.components ?? {}

    return {
      ...withEndpoints,
      admin: {
        ...admin,
        components: {
          ...components,
          views: {
            ...(components.views ?? {}),
            salesReports: {
              Component: config.adminView.Component,
              path: config.adminView.path as `/${string}`,
            },
          },
        },
      },
    }
  }
