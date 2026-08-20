import type { Access } from 'payload'

import type { ResolvedConfig, SalesReportsConfig } from './types.js'

import { isPeriod, isTimeZone } from './period.js'

const nonNegativeInteger = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  const rounded = Math.trunc(value)

  return rounded >= 0 ? rounded : fallback
}

const positiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  const rounded = Math.trunc(value)

  return rounded > 0 ? rounded : fallback
}

const name = (value: unknown, fallback: string): string =>
  (typeof value === 'string' ? value : fallback) || fallback

const path = (value: unknown, fallback: string): string => {
  const raw = name(value, fallback).trim()
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  const trimmed = withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash

  return trimmed || fallback
}

const statusList = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) {
    return fallback
  }

  const kept = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)

  return kept.length > 0 ? kept : fallback
}

const adminView = (value: unknown): ResolvedConfig['adminView'] => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const component = (value as { Component?: unknown }).Component

  if (typeof component !== 'string' || component.length === 0) {
    return null
  }

  return { Component: component, path: path((value as { path?: unknown }).path, '/sales-reports') }
}

export const defaultIsAdmin: Access = ({ req }) => {
  const roles = (req.user as null | { roles?: unknown })?.roles

  return Array.isArray(roles) && roles.includes('admin')
}

export const resolveConfig = (incoming: SalesReportsConfig = {}): ResolvedConfig => ({
  adminView: adminView(incoming.adminView),
  apiRoute: '/api',
  customersSlug: name(incoming.customersSlug, 'users'),
  disabled: incoming.disabled === true,
  endpointPath: path(incoming.endpointPath, '/sales-reports'),
  isAdmin: typeof incoming.isAdmin === 'function' ? incoming.isAdmin : defaultIsAdmin,
  limit: nonNegativeInteger(incoming.limit, 50),
  maxOrders: positiveInteger(incoming.maxOrders, 50000),
  ordersSlug: name(incoming.ordersSlug, 'orders'),
  pageSize: positiveInteger(incoming.pageSize, 500),
  period: isPeriod(incoming.period) ? incoming.period : 'month',
  productsSlug: name(incoming.productsSlug, 'products'),
  statuses: statusList(incoming.statuses, ['processing', 'completed']),
  timeZone:
    typeof incoming.timeZone === 'string' && isTimeZone(incoming.timeZone)
      ? incoming.timeZone
      : 'UTC',
  variantsSlug: name(incoming.variantsSlug, 'variants'),
})

export const withApiRoute = (config: ResolvedConfig, apiRoute: unknown): ResolvedConfig => ({
  ...config,
  apiRoute: path(apiRoute, '/api'),
})
