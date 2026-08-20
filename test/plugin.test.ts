import type { CollectionConfig, Config } from 'payload'

import { describe, expect, it } from 'vitest'

import { salesReportsPlugin } from '../src/index.js'

const orders: CollectionConfig = { slug: 'orders', fields: [{ name: 'status', type: 'text' }] }
const products: CollectionConfig = { slug: 'products', fields: [{ name: 'title', type: 'text' }] }

const baseConfig = (collections: CollectionConfig[]): Config => ({ collections }) as Config

describe('salesReportsPlugin', () => {
  it('adds the three endpoints', () => {
    const result = salesReportsPlugin()(baseConfig([orders]))

    expect(result.endpoints?.map((entry) => `${entry.method} ${entry.path}`)).toEqual([
      'get /sales-reports/summary',
      'get /sales-reports/by-product',
      'get /sales-reports/by-customer',
    ])
  })

  it('keeps endpoints the host config already declared', () => {
    const input = {
      collections: [orders],
      endpoints: [{ handler: () => new Response(), method: 'get', path: '/health' }],
    } as unknown as Config
    const result = salesReportsPlugin()(input)

    expect(result.endpoints?.[0]?.path).toBe('/health')
    expect(result.endpoints).toHaveLength(4)
  })

  it('adds no collection and no field to the orders collection', () => {
    const result = salesReportsPlugin()(baseConfig([orders, products]))

    expect(result.collections).toHaveLength(2)
    expect(result.collections?.[0]?.fields).toHaveLength(1)
  })

  it('adds no hook to any collection', () => {
    const result = salesReportsPlugin()(baseConfig([orders]))

    expect(result.collections?.[0]?.hooks).toBeUndefined()
  })

  it('returns the config unchanged when the orders collection is absent', () => {
    const input = baseConfig([products])

    expect(salesReportsPlugin()(input)).toBe(input)
  })

  it('registers no admin view by default', () => {
    const result = salesReportsPlugin()(baseConfig([orders]))

    expect(result.admin).toBeUndefined()
  })

  it('leaves the admin config alone when the view has no component', () => {
    const result = salesReportsPlugin({ adminView: { Component: '' } })(baseConfig([orders]))

    expect(result.admin).toBeUndefined()
  })

  it('registers a view only when a component path is supplied', () => {
    const result = salesReportsPlugin({
      adminView: { Component: '/components/SalesReports#SalesReports' },
    })(baseConfig([orders]))

    expect(result.admin?.components?.views).toMatchObject({
      salesReports: {
        Component: '/components/SalesReports#SalesReports',
        path: '/sales-reports',
      },
    })
  })

  it('keeps views the host config already declared', () => {
    const input = {
      admin: { components: { views: { other: { Component: '/x#Y', path: '/other' } } } },
      collections: [orders],
    } as unknown as Config
    const result = salesReportsPlugin({ adminView: { Component: '/a#B' } })(input)

    expect(Object.keys(result.admin?.components?.views ?? {})).toEqual(['other', 'salesReports'])
  })

  it('takes a custom admin view path', () => {
    const result = salesReportsPlugin({
      adminView: { Component: '/a#B', path: '/reports' },
    })(baseConfig([orders]))

    expect(result.admin?.components?.views?.salesReports).toMatchObject({ path: '/reports' })
  })

  it('still adds the endpoints when disabled, so routes keep their shape', () => {
    const result = salesReportsPlugin({ disabled: true })(baseConfig([orders]))

    expect(result.endpoints).toHaveLength(3)
  })

  it('honours a custom endpoint path', () => {
    const result = salesReportsPlugin({ endpointPath: '/reports' })(baseConfig([orders]))

    expect(result.endpoints?.[0]?.path).toBe('/reports/summary')
  })

  it('honours a custom orders slug', () => {
    const result = salesReportsPlugin({ ordersSlug: 'sales' })(
      baseConfig([{ slug: 'sales', fields: [] }]),
    )

    expect(result.endpoints).toHaveLength(3)
  })
})
