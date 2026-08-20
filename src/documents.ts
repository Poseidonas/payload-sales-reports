export type Doc = Record<string, unknown>

export const toId = (value: unknown): null | string => {
  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (value && typeof value === 'object') {
    return toId((value as Doc).id)
  }

  return null
}

export const amountOf = (doc: unknown): number => {
  const value = (doc as null | Doc)?.amount

  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0
}

export const currencyOf = (doc: unknown): string => {
  const value = (doc as null | Doc)?.currency

  return typeof value === 'string' && value.length > 0 ? value.toUpperCase() : 'UNKNOWN'
}

export const createdAtOf = (doc: unknown): Date | null => {
  const value = (doc as null | Doc)?.createdAt

  if (typeof value !== 'string' && !(value instanceof Date)) {
    return null
  }

  const date = new Date(value)

  return Number.isFinite(date.getTime()) ? date : null
}

/**
 * A logged in customer's order carries a customer and no email; a guest order
 * carries an email and no customer. Both are read, and the key falls back in
 * that order.
 */
export const buyerOf = (doc: unknown): { customer: null | string; email: null | string; key: string } => {
  const entry = (doc ?? {}) as Doc
  const customer = toId(entry.customer)
  const rawEmail = entry.customerEmail
  const email =
    typeof rawEmail === 'string' && rawEmail.length > 0 ? rawEmail.toLowerCase() : null

  return {
    customer,
    email,
    key: customer !== null ? `customer:${customer}` : email !== null ? `email:${email}` : 'unknown',
  }
}

export type OrderLine = {
  amount: null | number
  product: null | string
  quantity: number
  variant: null | string
}

export const linesOf = (doc: unknown): OrderLine[] => {
  const items = (doc as null | Doc)?.items

  if (!Array.isArray(items)) {
    return []
  }

  return items.map((item) => {
    const entry = (item ?? {}) as Doc
    const quantity = typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) ? entry.quantity : 1
    const amount = entry.amount

    return {
      amount: typeof amount === 'number' && Number.isFinite(amount) ? Math.trunc(amount) : null,
      product: toId(entry.product),
      quantity: Math.max(0, Math.trunc(quantity)),
      variant: toId(entry.variant),
    }
  })
}
