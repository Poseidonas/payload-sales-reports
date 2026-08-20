# payload-sales-reports

[![npm](https://img.shields.io/npm/v/payload-sales-reports?style=flat-square&color=0F766E)](https://www.npmjs.com/package/payload-sales-reports) ![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-6C757D?style=flat-square) ![payload](https://img.shields.io/badge/Payload-3.88+-0a0c0b?style=flat-square)

Totals what a Payload store actually sold, by period, by product and by customer, as functions and endpoints you can read from anywhere, with no admin component and no chart library.

- Works with `@payloadcms/plugin-ecommerce` and with any collection that holds orders
- No runtime dependencies, and **no React anywhere in the package**
- Adds no collection, no field and no hook. Three read only endpoints, nothing else
- Orders are read in pages; the whole order table is never held in memory

## Read this before you install

**This is the most fragile package of the family, and this is why.** Every other package here stays on Payload's stable surface: collections, fields, hooks, endpoints. Reporting is the one job that tempts a package into the admin panel, and admin components are exactly where third party Payload packages die. Of 28 third party Payload packages surveyed on 19 August 2026, 14 had not been published since February 2026, and the ones that broke first were the ones that rendered inside the admin. Payload ships a stable release every 6.8 days; a component that reaches into the admin UI is a standing bet against that.

So this package ships **no component at all**. It is data and endpoints. If you want a view in the admin, you write the component in your own project, where it lives next to the Payload version you actually run, and you point this plugin at it with one config line. When Payload changes its admin API, your component breaks in your repository where you can fix it in an afternoon, instead of in a dependency that has been unmaintained for four months.

The second fragility is not code, it is arithmetic: what counts as a sale. That is stated exactly below rather than assumed.

## Install

Requires **Payload 3.88 or newer** and **`@payloadcms/plugin-ecommerce` 3.88 or newer**. Verified against Payload 3.88.0 with the official plugin installed.

```bash
pnpm add payload-sales-reports
```

```ts
import { salesReportsPlugin } from 'payload-sales-reports'

export default buildConfig({
  plugins: [
    salesReportsPlugin({
      timeZone: 'Europe/Athens',
    }),
  ],
})
```

Endpoint access defaults to a check for `'admin'` in `req.user.roles`, and denies when there is no
such field. If your users collection names it differently, say so:

```ts
salesReportsPlugin({
  isAdmin: ({ req }) => (req.user as null | { role?: string })?.role === 'admin',
})
```

As data, with no HTTP and no UI:

```ts
import { salesReport } from 'payload-sales-reports'

const report = await salesReport({ from: '2026-01-01', period: 'month', req })
```

Or `GET /api/sales-reports/summary?period=month&from=2026-01-01`:

```json
{
  "byPeriod": [
    { "currency": "EUR", "orders": 41, "period": "2026-07", "revenue": 412300, "units": 63 },
    { "currency": "EUR", "orders": 55, "period": "2026-08", "revenue": 588150, "units": 91 }
  ],
  "currencies": ["EUR"],
  "orders": 96,
  "period": "month",
  "statuses": ["processing", "completed"],
  "timeZone": "Europe/Athens",
  "totals": [{ "currency": "EUR", "orders": 96, "revenue": 1000450, "units": 154 }],
  "truncated": false
}
```

## What was measured

### Which statuses count, and which do not

| Status | Counted | Why |
| --- | --- | --- |
| `processing` | **yes** | Read from `@payloadcms/plugin-ecommerce@3.88.0`: `confirmOrder` throws unless the payment intent reports `succeeded`, and only then writes the order. An order in `processing` is an order the customer paid for |
| `completed` | **yes** | The same money, after the shop marked the order done |
| `cancelled` | no | |
| `refunded` | no | The money went back |

Change it with `statuses: ['completed']` if your shop treats `processing` as unsettled. Every response repeats the list it used, so a figure can always be traced back to the rule that produced it.

This default is deliberately looser than the one in `payload-downloads`, which grants access only on `completed`. Handing over a file cannot be undone, so it waits for a deliberate act. A report is read only, so it counts the money that was actually taken.

### Amounts are integers, in minor units

Read from `fields/amountField.ts` and `currencies/index.ts`: an amount is written as `Math.round(value * 10 ** currency.decimals)`, and EUR, USD and GBP all declare `decimals: 2`. Every figure in every response is that same integer. Nothing here divides by 100, and nothing is stored as a float. Divide by `10 ** decimals` at the point where you display it.

### Currencies are never summed

Every row carries its own `currency` and `totals` is a list, one entry per currency. Two currencies in the same store produce two rows, never one wrong number. Pass `currency=EUR` to narrow it.

### Why a logged in buyer and a guest buyer are grouped differently

Read from `stripe/confirmOrder.ts`, the order is written with

```
...(req.user ? { customer: req.user.id } : { customerEmail })
```

A logged in customer's order carries a `customer` and no `customerEmail`; a guest order carries the email and no customer. `byCustomer` keys on `customer:<id>` when there is one and `email:<address>` otherwise, and reports both fields on every row so you can see which kind of buyer a row is.

### Why revenue per product is usually empty

Read from `fields/cartItemsField.ts`: an item gets an `amount` field only when the plugin is given `currenciesConfig` **and** `individualPrices`. `createOrdersCollection` calls it with neither. In a standard install an order line therefore carries `product`, `variant` and `quantity`, and **no price at all**.

So `byProduct` always reports `units` and `orders`, and reports `revenue` only when the lines carry an amount. When they do not, every `revenue` is `null` and the response says `revenueByProductAvailable: false`. Splitting the order total across its lines by quantity would produce a number that looks right and is wrong for any order with mixed prices, so it is not done.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `adminView` | none | `{ Component, path }` for a view you wrote. Off by default; the package works fully without one |
| `customersSlug` | `'users'` | Slug of the customers collection |
| `disabled` | `false` | The endpoints answer 404 and read nothing. Routes keep their shape |
| `endpointPath` | `'/sales-reports'` | Path below the Payload API route |
| `isAdmin` | `'admin'` in `req.user.roles` | Who may call the endpoints |
| `limit` | `50` | Rows returned by `byProduct` and `byCustomer`. `0` returns all |
| `maxOrders` | `50000` | Orders one report reads before stopping and reporting `truncated: true` |
| `ordersSlug` | `'orders'` | Slug of the orders collection |
| `pageSize` | `500` | Orders read per query |
| `period` | `'month'` | Grouping used when a request does not ask for one |
| `productsSlug` | `'products'` | Slug of the products collection, read only to name a product |
| `statuses` | `['processing', 'completed']` | Order statuses that count as a sale |
| `timeZone` | `'UTC'` | IANA zone the period boundaries are cut on |
| `variantsSlug` | `'variants'` | Slug of the variants collection |

A value that cannot be used is replaced by its default rather than being applied. A negative `limit` becomes `50`, an unknown `period` becomes `'month'`, a time zone the platform does not recognise becomes `'UTC'`, and an empty `statuses` list becomes the default rather than counting nothing.

Query parameters accepted by all three endpoints: `from`, `to`, `period`, `currency`, `limit`.

## What it adds to your database

Nothing. No collection, no field, no hook, no index. It only reads.

Three endpoints are added, all `GET` and all guarded by `isAdmin`:

| Endpoint | Returns |
| --- | --- |
| `/api/sales-reports/summary` | `totals`, `byPeriod`, `currencies`, `orders`, `statuses`, `timeZone`, `truncated` |
| `/api/sales-reports/by-product` | `byProduct`, `revenueByProductAvailable`, `orders`, `truncated` |
| `/api/sales-reports/by-customer` | `byCustomer`, `orders`, `truncated` |

Exported for server side use: `salesReportsPlugin`, `salesReport`, `salesByPeriod`, `salesByProduct`, `salesByCustomer`, `ordersWhere`, `periodKey`, `isoWeek`, `partsIn`, `isPeriod`, `resolveConfig`.

## Building your own admin view

The plugin will register a view you wrote, and it imports nothing from React to do it:

```ts
salesReportsPlugin({
  adminView: {
    Component: '/components/SalesReports#SalesReports',
    path: '/sales-reports',
  },
})
```

The component is yours, in your own project, and it can fetch `/api/sales-reports/summary` like any other client. If Payload changes how custom views are registered, remove that one option and every endpoint and every exported function keeps working exactly as before. That is the whole point of the flag.

## Honest limits

**Reports are computed by paging, not by a database aggregate.** Payload has no stable public API for a `GROUP BY` or a `$group` that works the same on the PostgreSQL and MongoDB adapters, and dropping to `payload.db` would tie this package to one of them. So orders are read `pageSize` at a time, accumulated into maps and released. Memory follows the number of distinct groups, not the number of orders; time follows the number of orders. The query count follows directly from the page size:

| Orders in range | Queries at the default page size of 500 |
| --- | --- |
| 500 | 1 |
| 5000 | 10 |
| 50000 | 100 |
| more than 50000 | 100, then it stops and reports `truncated: true` |

For a store past that size, run the report from a cron into a stored summary rather than on request, and raise `maxOrders` deliberately.

**A report is a request, and requests time out.** Nothing here is cached. A summary over five years of a busy store is a long request; narrow it with `from` and `to`, or precompute.

**Revenue per product is usually unavailable.** See above. `units` is always right; `revenue` is `null` unless your order lines carry an amount.

**The same human can appear twice in `byCustomer`.** Someone who bought once as a guest and once signed in produces two rows, because the two orders share no field. There is no reliable join, and guessing one would silently merge two different people who share an address.

**Periods are cut in one zone for the whole report.** `timeZone` applies to every row. A store selling across zones gets one consistent cut, not a local one per order.

**`truncated: true` means the figures are incomplete.** It is never a rounding warning. Treat any truncated report as a sample.

**Refunds are counted as absent, not as negative.** A refunded order leaves the totals entirely; it is not subtracted from the period it was placed in. Partial refunds are invisible, because the official schema has no record of one. That belongs in `payload-refunds`.

**Orders without a `createdAt` fall out of `byPeriod`.** They stay in `totals`, `byProduct` and `byCustomer`, so the sum of the periods can be smaller than the total.

## License

MIT. Copyright George Vasiliades, https://github.com/Poseidonas
