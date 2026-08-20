import type { PayloadRequest } from 'payload'

export type Row = Record<string, unknown>

type Where = Record<string, unknown>

const idOf = (value: unknown): unknown => {
  if (value && typeof value === 'object' && 'id' in (value as Row)) {
    return (value as Row).id
  }

  return value
}

const matches = (row: Row, where: Where): boolean => {
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'and') {
      if (!(condition as Where[]).every((entry) => matches(row, entry))) {
        return false
      }

      continue
    }

    if (key === 'or') {
      if (!(condition as Where[]).some((entry) => matches(row, entry))) {
        return false
      }

      continue
    }

    const test = condition as Record<string, unknown>
    const value = idOf(row[key])

    if ('equals' in test && value !== idOf(test.equals)) {
      return false
    }

    if ('in' in test) {
      const list = (test.in as unknown[]).map((entry) => idOf(entry))

      if (!list.map(String).includes(String(value))) {
        return false
      }
    }

    if ('greater_than_equal' in test && String(value) < String(test.greater_than_equal)) {
      return false
    }

    if ('less_than_equal' in test && String(value) > String(test.less_than_equal)) {
      return false
    }
  }

  return true
}

export type Lab = {
  queries: { collection: string; limit?: number; page?: number; where?: undefined | Where }[]
  req: PayloadRequest
  seed: (collection: string, docs: Row[]) => void
}

export const createLab = (options: { user?: Row } = {}): Lab => {
  const store = new Map<string, Row[]>()
  const queries: Lab['queries'] = []

  const table = (collection: string): Row[] => {
    if (!store.has(collection)) {
      store.set(collection, [])
    }

    return store.get(collection) as Row[]
  }

  const payload = {
    find: async ({
      collection,
      limit = 10,
      page = 1,
      pagination,
      where,
    }: {
      collection: string
      limit?: number
      page?: number
      pagination?: boolean
      where?: Where
    }) => {
      queries.push({ collection, limit, page, where })

      const all = table(collection).filter((row) => (where ? matches(row, where) : true))

      if (pagination === false) {
        return { docs: all, hasNextPage: false, totalDocs: all.length }
      }

      const start = (page - 1) * limit
      const docs = all.slice(start, start + limit)

      return { docs, hasNextPage: start + limit < all.length, totalDocs: all.length }
    },
    logger: { error: () => undefined, warn: () => undefined },
  }

  const req = { payload, user: options.user ?? null } as unknown as PayloadRequest

  return {
    queries,
    req,
    seed: (collection, docs) => {
      table(collection).push(...docs)
    },
  }
}

export const order = (values: Row): Row => ({
  amount: 1000,
  createdAt: '2026-08-19T10:00:00.000Z',
  currency: 'EUR',
  items: [{ product: 'p1', quantity: 1 }],
  status: 'completed',
  ...values,
})
