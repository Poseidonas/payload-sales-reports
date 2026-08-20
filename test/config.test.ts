import { describe, expect, it } from 'vitest'

import { defaultIsAdmin, resolveConfig, withApiRoute } from '../src/config.js'

describe('resolveConfig', () => {
  it('fills in the documented defaults', () => {
    expect(resolveConfig()).toMatchObject({
      adminView: null,
      apiRoute: '/api',
      customersSlug: 'users',
      disabled: false,
      endpointPath: '/sales-reports',
      limit: 50,
      maxOrders: 50000,
      ordersSlug: 'orders',
      pageSize: 500,
      period: 'month',
      productsSlug: 'products',
      statuses: ['processing', 'completed'],
      timeZone: 'UTC',
      variantsSlug: 'variants',
    })
  })

  it('counts money taken and leaves out money returned', () => {
    const statuses = resolveConfig().statuses

    expect(statuses).toContain('processing')
    expect(statuses).toContain('completed')
    expect(statuses).not.toContain('cancelled')
    expect(statuses).not.toContain('refunded')
  })

  it('ships no admin view by default', () => {
    expect(resolveConfig().adminView).toBeNull()
  })

  it('registers an admin view only when a component path is given', () => {
    expect(resolveConfig({ adminView: { Component: '' } }).adminView).toBeNull()
    expect(resolveConfig({ adminView: { Component: '/x#Y' } }).adminView).toEqual({
      Component: '/x#Y',
      path: '/sales-reports',
    })
  })

  it('takes a custom admin view path', () => {
    expect(resolveConfig({ adminView: { Component: '/x#Y', path: 'reports' } }).adminView).toEqual({
      Component: '/x#Y',
      path: '/reports',
    })
  })

  it('refuses an empty status list rather than counting nothing', () => {
    expect(resolveConfig({ statuses: [] }).statuses).toEqual(['processing', 'completed'])
  })

  it('takes a narrower status list', () => {
    expect(resolveConfig({ statuses: ['completed'] }).statuses).toEqual(['completed'])
  })

  it('refuses an unknown grouping', () => {
    expect(resolveConfig({ period: 'quarter' as never }).period).toBe('month')
  })

  it('refuses a time zone the platform does not know', () => {
    expect(resolveConfig({ timeZone: 'Middle/Earth' }).timeZone).toBe('UTC')
  })

  it('accepts a real time zone', () => {
    expect(resolveConfig({ timeZone: 'Europe/Athens' }).timeZone).toBe('Europe/Athens')
  })

  it('accepts a limit of zero, meaning every row', () => {
    expect(resolveConfig({ limit: 0 }).limit).toBe(0)
  })

  it('rejects a negative limit rather than flipping its sign', () => {
    expect(resolveConfig({ limit: -10 }).limit).toBe(50)
  })

  it('rejects a zero page size', () => {
    expect(resolveConfig({ pageSize: 0 }).pageSize).toBe(500)
  })

  it('truncates fractional values instead of storing them', () => {
    expect(resolveConfig({ limit: 10.9, pageSize: 100.7 })).toMatchObject({
      limit: 10,
      pageSize: 100,
    })
  })

  it('adds a leading slash to the endpoint path', () => {
    expect(resolveConfig({ endpointPath: 'reports' }).endpointPath).toBe('/reports')
  })
})

describe('withApiRoute', () => {
  it('takes the api route from the host config', () => {
    expect(withApiRoute(resolveConfig(), '/payload-api').apiRoute).toBe('/payload-api')
  })
})

describe('defaultIsAdmin', () => {
  it('denies when there is no user or no roles field', () => {
    expect(defaultIsAdmin({ req: { user: null } } as never)).toBe(false)
    expect(defaultIsAdmin({ req: { user: { id: '1' } } } as never)).toBe(false)
  })

  it('allows a user carrying the admin role', () => {
    expect(defaultIsAdmin({ req: { user: { roles: ['admin'] } } } as never)).toBe(true)
  })
})
