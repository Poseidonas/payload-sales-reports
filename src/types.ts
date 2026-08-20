import type { Access } from 'payload'

export type Period = 'day' | 'month' | 'week' | 'year'

/**
 * Every figure is in the minor units the order carries, the same integers the
 * official plugin writes with Math.round(value * 10 ** currency.decimals).
 * Rows are never summed across currencies.
 */
export type PeriodRow = {
  currency: string
  orders: number
  period: string
  revenue: number
  units: number
}

export type ProductRow = {
  currency: string
  orders: number
  product: string
  revenue: null | number
  title: null | string
  units: number
  variant: null | string
}

export type CustomerRow = {
  currency: string
  customer: null | string
  email: null | string
  key: string
  orders: number
  revenue: number
  units: number
}

export type TotalRow = {
  currency: string
  orders: number
  revenue: number
  units: number
}

export type SalesReport = {
  byCustomer: CustomerRow[]
  byPeriod: PeriodRow[]
  byProduct: ProductRow[]
  currencies: string[]
  from: null | string
  orders: number
  period: Period
  revenueByProductAvailable: boolean
  statuses: string[]
  timeZone: string
  to: null | string
  totals: TotalRow[]
  truncated: boolean
}

export type SalesReportsConfig = {
  /**
   * Registers a custom admin view. Off by default, and the package works
   * without one. Component is a Payload component path such as
   * '/components/SalesReports#SalesReports'; no component ships with this
   * package and nothing here imports React.
   */
  adminView?: {
    Component: string
    path?: string
  }
  /**
   * Slug of the customers collection. Defaults to 'users'.
   */
  customersSlug?: string
  /**
   * Stops the endpoints answering while leaving everything else in place.
   */
  disabled?: boolean
  /**
   * Path the endpoints are mounted under, below the Payload API route.
   * Defaults to '/sales-reports'.
   */
  endpointPath?: string
  /**
   * Decides who may call the endpoints. Defaults to a check for 'admin' in
   * req.user.roles, which denies when there is no such field.
   */
  isAdmin?: Access
  /**
   * How many rows a grouped report returns. 0 returns all of them.
   * Defaults to 50.
   */
  limit?: number
  /**
   * How many orders one report reads in total before stopping and reporting
   * truncated. Defaults to 50000.
   */
  maxOrders?: number
  /**
   * Slug of the orders collection. Defaults to 'orders'.
   */
  ordersSlug?: string
  /**
   * How many orders one page reads. Defaults to 500.
   */
  pageSize?: number
  /**
   * Grouping used when a request does not ask for one. Defaults to 'month'.
   */
  period?: Period
  /**
   * Slug of the products collection. Defaults to 'products'.
   */
  productsSlug?: string
  /**
   * Order statuses that count as a sale. Defaults to ['processing', 'completed'].
   */
  statuses?: string[]
  /**
   * IANA time zone the period boundaries are cut on. Defaults to 'UTC'.
   */
  timeZone?: string
  /**
   * Slug of the variants collection. Defaults to 'variants'.
   */
  variantsSlug?: string
}

export type ResolvedConfig = {
  adminView: { Component: string; path: string } | null
  apiRoute: string
  customersSlug: string
  disabled: boolean
  endpointPath: string
  isAdmin: Access
  limit: number
  maxOrders: number
  ordersSlug: string
  pageSize: number
  period: Period
  productsSlug: string
  statuses: string[]
  timeZone: string
  variantsSlug: string
}
