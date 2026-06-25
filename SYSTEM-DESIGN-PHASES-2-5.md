# WMSPOS System Engineering Design Document
## Phases 2–5: Complete Blueprint

> **Authored:** 2026-04-22
> **Status:** Authoritative design reference for implementation
> **Scope:** Phases 2–5 — Receipt Printing through Webhook Integrations
> **Baseline:** Phase 1 is complete (product grid, cart, cash/card/split payments, hold/resume, returns, register open/close, X-Report, customer search/quick-create, sales history, multi-warehouse stock, employee login, terminal registration, Electron IPC config)

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Database Schema Changes](#2-database-schema-changes)
3. [API Endpoint Design](#3-api-endpoint-design)
4. [Offline Architecture](#4-offline-architecture)
5. [State Management](#5-state-management)
6. [Component Architecture](#6-component-architecture)
7. [Integration Patterns](#7-integration-patterns)
8. [Security Considerations](#8-security-considerations)
9. [Performance Considerations](#9-performance-considerations)
10. [Technical Risks and Mitigations](#10-technical-risks-and-mitigations)
11. [Dependency Map](#11-dependency-map)

---

## 1. System Architecture Overview

### 1.1 Layered Architecture

The system spans three physical tiers that must work together and degrade gracefully when the middle tier is unavailable:

```
TIER 1 — HARDWARE LAYER
  Receipt Printer (ESC/POS over USB or TCP 9100)
  Cash Drawer (GPIO via printer kick command)
  Barcode Scanner (USB HID keyboard emulation)
  Card Terminal (Stripe Terminal SDK / SumUp SDK over LAN or Bluetooth)
  Label Printer (ZPL over USB or TCP)
  Customer Display (Second monitor driven by a dedicated BrowserWindow)

TIER 2 — ELECTRON DESKTOP APP (this repo)
  Main Process (Node.js)
    ├── SQLite local database (better-sqlite3)
    ├── Hardware abstraction layer
    ├── Sync engine (background worker via setInterval + event-driven)
    ├── IPC bridge (contextBridge — strict allow-list, no nodeIntegration)
    └── Auto-updater (electron-updater)
  Renderer Process (React 19 + Zustand)
    ├── All UI screens
    ├── Zustand stores (in-memory state)
    └── axios API client (with offline intercept)
  Customer Display BrowserWindow (separate window)
    └── Subscribes to cart/sale events via IPC

TIER 3 — BACKEND API
  localhost:9000/api (existing WMS backend)
  Bearer token auth
  All persistent data lives here as source of truth
```

### 1.2 Data Flow: Online Sale

```
Cashier scans barcode
  → BarcodeInput component fires 'barcode' event
  → useProducts hook: check local SQLite first (< 2ms)
  → If not found locally: GET /api/mobile-app/get-product-details-by-sku-ean-id
  → Product added to cartStore
  → CartStore recalculates subtotal/tax/total
  → CartStore dispatches update to Customer Display via IPC

Cashier clicks PAY
  → PaymentModal opens, reads cartStore totals
  → Cash path: change calculated locally, no API needed
  → Card path: Electron main process calls Stripe Terminal SDK
              → Stripe processes payment, returns PaymentIntent ID
  → POST /client/pos/sale/create (all items + payments in one atomic call)
  → Server: creates POSSale + POSSaleItems, decrements shelf stock,
            creates linked Order record, awards loyalty points
  → Response includes saleId, saleNumber, receiptData, loyaltyEarned
  → Receipt formatted (ESC/POS commands) and sent to printer
  → Cash drawer kicked if payment includes cash
  → cartStore.clearCart()
  → SaleComplete screen shown
  → Customer Display shows ThankYou screen
```

### 1.3 Data Flow: Offline Sale

```
Network connectivity monitor detects no API reachability
  → syncStore.setOfflineMode(true)
  → NetworkIndicator shows amber "Offline" badge
  → Card payment option disabled (Stripe needs network)

Cashier completes cash sale
  → CartStore builds sale payload as normal
  → offlineQueue.enqueue({ localId: uuid(), type: 'sale', payload })
  → SQLite: INSERT INTO offline_queue (...)
  → Sale immediately shown as complete to cashier
  → Receipt printed directly from local data (no server round-trip)
  → syncStore.incrementPendingCount()

When connectivity restored
  → syncEngine detects API reachability
  → POST /client/pos/sync/push with pending batch
  → Server processes each, deduplicates by localId
  → SQLite: offline_queue items marked 'synced'
  → syncStore.setPendingCount(0)
  → Conflict items surfaced in ConflictResolutionUI
```

### 1.4 Phase Fit into Existing Architecture

| Phase | Primary Layer Changed | Nature of Change |
|-------|-----------------------|-----------------|
| Phase 2 — Receipts, Profiles, Partial Refunds, Line Discounts, Configurable Tax, Z-Report, Offline | Renderer + Main + API | Additive. New stores, new Electron hardware modules, new API endpoints. Existing cartStore extended. |
| Phase 3 — Omnichannel (BOPIS, Ship from Store, Inventory Sync, Transfers) | Renderer + API | New pages and stores. Ties existing StockTransfer API into POS UI. Real-time WebSocket layer added. |
| Phase 4 — Advanced (Permissions, Multi-Currency, Loyalty, Gift Cards, Bundles, Custom Sale, Layaway, Cash Management, Dashboard, Label Printing) | All three tiers | Largest phase. authStore gains permission checks. cartStore gains currency context. New loyalty/gift-card IPC handlers. |
| Phase 5 — Integration (Accounting, Email Marketing, Webhooks) | API + Main Process | Backend-heavy. Electron app gains webhook event emission. Accounting sync runs in Main process on a schedule. |

---

## 2. Database Schema Changes

### 2.1 Guiding Principles

- All new entities follow the existing pattern: `clientId` FK for multi-tenancy, `createdAt/updatedAt`, `deletedAt` for paranoid soft-delete where data must be preserved for audit.
- JSONB columns are used for snapshot data (product name at time of sale, payment details) and for flexible configuration that would otherwise require many nullable columns or separate config tables.
- Prices are stored as DECIMAL(10,2) — never floats. Tax and discount amounts are always stored as computed values alongside rates, so historical records are self-contained.

### 2.2 Phase 2 Schema

#### 2.2.1 receipt_templates

Stores the HTML/ESC-POS template per client. One row per client; contains the logo URL, footer text, show/hide toggles.

```
id              INTEGER PK
clientId        INTEGER FK → Clients
warehouseId     INTEGER FK → WareHouses (nullable — store-specific template override)
templateType    ENUM ('thermal_80mm', 'thermal_58mm', 'a4_pdf', 'email_html')
logoUrl         TEXT nullable
headerLine1     VARCHAR(64)   — company name
headerLine2     VARCHAR(64)   — address line 1
headerLine3     VARCHAR(64)   — address line 2
headerLine4     VARCHAR(64)   — phone / website
footerLine1     VARCHAR(64)
footerLine2     VARCHAR(64)
showBarcode     BOOLEAN default true
showLoyalty     BOOLEAN default true
showVatNumber   BOOLEAN default false
vatNumber       VARCHAR(32) nullable
customCss       TEXT nullable  — for email/PDF templates only
isDefault       BOOLEAN default false
createdAt, updatedAt
```

#### 2.2.2 tax_rates

Replaces the hardcoded 20% VAT in cartStore. Allows per-product and per-location rates.

```
id              INTEGER PK
clientId        INTEGER FK → Clients
name            VARCHAR(64)    — 'Standard Rate', 'Reduced Rate', 'Zero Rate'
rate            DECIMAL(6,4)   — 0.2000 = 20%, 0.0500 = 5%
isDefault       BOOLEAN default false
appliesTo       ENUM ('all', 'category', 'product')
categoryIds     JSONB []        — populated when appliesTo = 'category'
variationIds    JSONB []        — populated when appliesTo = 'product'
warehouseIds    JSONB []        — if empty, applies to all stores; otherwise store-scoped
country         VARCHAR(2) nullable  — ISO code for multi-country tax rules
isActive        BOOLEAN default true
createdAt, updatedAt, deletedAt
```

#### 2.2.3 customer_profiles (extends existing Customer)

Adds fields needed for full profile: purchase history (derived via FK), lifetime value (computed), notes, tags.

```
ALTER TABLE Customers ADD COLUMN:
  loyaltyEnrolledAt   DATETIME nullable
  notes               TEXT nullable
  tags                JSONB []   — ['vip', 'wholesale', 'staff']
  dateOfBirth         DATE nullable
  preferredContactMethod ENUM ('email', 'phone', 'sms', 'none') default 'email'
  marketingOptIn      BOOLEAN default false
  lifetimeSpend       DECIMAL(12,2) default 0  — denormalised, updated on each sale
  totalOrders         INTEGER default 0        — denormalised, updated on each sale
  averageOrderValue   DECIMAL(10,2) default 0  — recomputed on each sale
  lastPurchasedAt     DATETIME nullable
```

#### 2.2.4 pos_refunds

Tracks partial refunds at line-item level. A full void is still handled by updating POSSale.status; this table handles partial cases.

```
id              BIGINT PK
clientId        INTEGER FK → Clients
originalSaleId  BIGINT FK → POSSales
terminalId      INTEGER FK → POSTerminals
staffId         INTEGER FK → Users
customerId      INTEGER FK → Customers nullable

refundNumber    VARCHAR(32)   — 'REF-00012'
status          ENUM ('pending', 'completed', 'failed')
reason          VARCHAR(255)
type            ENUM ('refund', 'exchange')

items           JSONB [{
                  saleItemId, variationId, name, sku,
                  quantityReturned, unitPrice, refundAmount,
                  restoreToShelfId, conditionNote
                }]

subtotalRefunded    DECIMAL(10,2)
taxRefunded         DECIMAL(10,2)
totalRefunded       DECIMAL(10,2)

refundMethod        ENUM ('original', 'cash', 'gift_card', 'account_credit')
refundPaymentDetails JSONB  — mirrors POSSale.paymentDetails shape

exchangeSaleId  BIGINT FK → POSSales nullable  — the new sale created in an exchange

isOfflineRefund     BOOLEAN default false
offlineSyncedAt     DATETIME nullable

createdAt, updatedAt, deletedAt
```

#### 2.2.5 z_reports

Immutable record of each end-of-day close. Generated once per register session close; never updated.

```
id              INTEGER PK
clientId        INTEGER FK → Clients
sessionId       INTEGER FK → POSRegisterSessions UNIQUE
warehouseId     INTEGER FK → WareHouses
terminalId      INTEGER FK → POSTerminals
generatedBy     INTEGER FK → Users
generatedAt     DATETIME

reportData      JSONB {
                  openingFloat, closingCash, expectedCash, cashDifference,
                  totalSales, totalRefunds, transactionCount, refundCount,
                  paymentBreakdown: { cash, card_visa, card_mc, gift_card, account },
                  hourlyBreakdown: [{ hour, saleCount, saleTotal }],
                  topProducts: [{ variationId, name, qty, total }],
                  staffBreakdown: [{ staffId, name, saleCount, saleTotal }],
                  voidCount, voidTotal,
                  discountTotal, loyaltyPointsIssued, loyaltyPointsRedeemed
                }

reportPdfUrl    TEXT nullable   — S3/CDN URL of generated PDF
emailedTo       JSONB []        — list of emails this was sent to

createdAt
```

### 2.3 Phase 3 Schema

#### 2.3.1 bopis_orders (Click & Collect)

The underlying order already exists in the Orders table. This table adds the POS-specific lifecycle state.

```
id              INTEGER PK
clientId        INTEGER FK → Clients
orderId         BIGINT FK → Orders
warehouseId     INTEGER FK → WareHouses  — which store to collect from

status          ENUM ('received', 'picking', 'ready', 'partial_ready',
                      'collected', 'partial_collected', 'cancelled', 'expired')

pickedBy        INTEGER FK → Users nullable
readyAt         DATETIME nullable
collectedBy     INTEGER FK → Users nullable  — staff who processed collection
collectedAt     DATETIME nullable
customerNotifiedAt DATETIME nullable
expiresAt       DATETIME nullable  — auto-expire uncollected orders

items           JSONB [{
                  orderProductId, variationId, name, sku,
                  orderedQty, pickedQty, status
                }]

collectionCode  VARCHAR(16) UNIQUE  — printed on customer notification, scanned at counter
customerSignature TEXT nullable     — base64 if signature capture is used
notes           TEXT nullable

createdAt, updatedAt
```

#### 2.3.2 inventory_sync_log

Tracks the real-time inventory sync events between stores and online channels to detect inconsistencies.

```
id              BIGINT PK
clientId        INTEGER FK → Clients
variationId     BIGINT FK → Variations
warehouseId     INTEGER FK → WareHouses
channel         VARCHAR(32)  — 'pos', 'woocommerce', 'ebay', 'amazon', 'manual'

eventType       ENUM ('sale', 'refund', 'transfer_out', 'transfer_in',
                      'adjustment', 'receipt', 'stocktake')
quantityChange  INTEGER      — signed: negative for reductions
stockBefore     INTEGER
stockAfter      INTEGER

referenceId     BIGINT nullable   — FK to POSSales / Orders / StockTransfers
referenceType   VARCHAR(32) nullable

syncedAt        DATETIME nullable
conflictFlag    BOOLEAN default false

createdAt
```

### 2.4 Phase 4 Schema

The Phase 1 scaffold document already defines the following tables in full. They are referenced here without repeating the full field list:

- `POSGiftCards` and `POSGiftCardTransactions` — gift card lifecycle
- `POSLoyaltyConfigs`, `POSLoyaltyTiers`, `POSCustomerLoyalties`, `POSLoyaltyTransactions` — loyalty program
- `POSLayaways` — layaway/deposits
- `POSCashMovements` — cash management (safe drops, pay-ins, pay-outs)
- `POSPromotions` — promotions engine
- `POSCommissionRules` and `POSCommissionLogs` — staff commission

#### 2.4.1 pos_staff_permissions (extends existing Role/Permission system)

Rather than a new table, this extends the existing `RoleActionValue` model with POS-specific action constants. The backend already has the full RBAC system; we add a `pos_` prefix namespace for all POS actions.

POS action constants to register:

```
pos.sale.create            pos.sale.void              pos.sale.discount_cart
pos.sale.discount_line     pos.sale.discount_override_max
pos.refund.process         pos.refund.no_receipt
pos.register.open          pos.register.close
pos.cash.in                pos.cash.out               pos.cash.safe_drop
pos.customer.create        pos.customer.edit
pos.loyalty.adjust
pos.giftcard.create        pos.giftcard.topup
pos.layaway.create         pos.layaway.cancel
pos.report.xreport         pos.report.zreport         pos.report.sales
pos.stock.adjust           pos.stock.receive
pos.settings.terminal      pos.settings.promotions
pos.manager_pin_override   — required for actions needing a manager to tap their PIN
```

#### 2.4.2 currencies

```
id              INTEGER PK
clientId        INTEGER FK → Clients
code            VARCHAR(3)  — 'GBP', 'USD', 'EUR'
name            VARCHAR(64)
symbol          VARCHAR(8)
exchangeRate    DECIMAL(12,6)  — relative to base currency
isBase          BOOLEAN default false   — exactly one true per clientId
isActive        BOOLEAN default true
updatedAt       DATETIME  — exchange rates should be refreshed periodically
createdAt, updatedAt
```

#### 2.4.3 product_bundles (extends existing BundleSku)

The existing `BundleSku` model captures which variations are in a bundle. We need to extend it with POS-specific pricing:

```
ALTER TABLE BundleSkus ADD COLUMN:
  bundlePrice     DECIMAL(10,2) nullable  — fixed bundle price (overrides sum of parts)
  displayName     VARCHAR(255) nullable   — name shown at POS
  isActivePOS     BOOLEAN default true
```

### 2.5 Phase 5 Schema

#### 2.5.1 webhook_endpoints

```
id              INTEGER PK
clientId        INTEGER FK → Clients
url             TEXT
secret          VARCHAR(128)  — HMAC-SHA256 signing secret (stored encrypted)
isActive        BOOLEAN default true
events          JSONB []  — ['pos.sale.completed', 'pos.refund.processed', ...]
retryPolicy     JSONB { maxAttempts: 3, backoffSeconds: [30, 300, 3600] }
createdAt, updatedAt, deletedAt
```

#### 2.5.2 webhook_deliveries

```
id              BIGINT PK
clientId        INTEGER FK → Clients
endpointId      INTEGER FK → webhook_endpoints
event           VARCHAR(64)
payload         JSONB
attempt         INTEGER default 1
status          ENUM ('pending', 'delivered', 'failed', 'retrying')
responseCode    INTEGER nullable
responseBody    TEXT nullable
duration        INTEGER nullable  — milliseconds
nextRetryAt     DATETIME nullable
deliveredAt     DATETIME nullable
createdAt
```

#### 2.5.3 accounting_sync_log

```
id              INTEGER PK
clientId        INTEGER FK → Clients
provider        ENUM ('xero', 'quickbooks')
entityType      VARCHAR(64)  — 'pos_sale', 'pos_refund', 'z_report'
entityId        BIGINT
status          ENUM ('pending', 'synced', 'failed', 'skipped')
externalId      VARCHAR(128) nullable  — Xero invoice ID / QuickBooks transaction ID
errorMessage    TEXT nullable
syncedAt        DATETIME nullable
createdAt
```

---

## 3. API Endpoint Design

All endpoints follow the existing pattern: `Bearer {token}` auth, responses shape `{ success: boolean, data: {}, error?: string }`, pagination via `?page=1&limit=50`.

### 3.1 Phase 2 Endpoints

#### Receipt Printing / Email

```
GET    /client/pos/receipt/:saleId/data
  → Returns structured receipt data (all line items, payment lines, totals,
    store info, loyalty). Used by Electron to render ESC/POS commands.

Response:
{
  "saleNumber": "POS-00042",
  "saleDate": "2026-04-22T14:32:00Z",
  "store": { "name": "...", "address": "...", "phone": "...", "vatNumber": "..." },
  "staff": { "name": "John D." },
  "terminal": { "name": "Till 1" },
  "customer": { "name": "...", "email": "..." } | null,
  "items": [{ "name", "sku", "qty", "unitPrice", "discount", "lineTotal" }],
  "subtotal": 309.97,
  "discountTotal": 31.00,
  "taxLines": [{ "name": "VAT 20%", "rate": 0.20, "amount": 55.79 }],
  "grandTotal": 334.76,
  "payments": [{ "method": "cash", "amount": 334.76, "tendered": 350.00, "change": 15.24 }],
  "loyalty": { "pointsEarned": 334, "newBalance": 1205 } | null,
  "barcodeValue": "POS-00042",
  "template": { "logoUrl": "...", "headerLines": [], "footerLines": [], "showBarcode": true }
}

POST   /client/pos/receipt/:saleId/email
  Body: { "email": "customer@example.com" }
  → Triggers server-side email with HTML receipt. Returns { "sent": true }.

POST   /client/pos/receipt/:saleId/reprint
  → Queues a reprint job. Returns receipt data same as /data endpoint.
```

#### Full Customer Profiles

```
GET    /client/pos/customer/:id/profile
  → Combines Customer record + lifetime stats + loyalty summary + recent sales.
  Response includes:
    customer: { id, name, email, phone, tags, notes, dateOfBirth, ... },
    stats: { lifetimeSpend, totalOrders, averageOrderValue, lastPurchasedAt },
    loyalty: { currentPoints, lifetimePts, tier, memberSince } | null,
    recentSales: [{ saleNumber, date, total, itemCount }]  // last 10

PUT    /client/pos/customer/:id/notes
  Body: { "notes": "Prefers to be called on phone. Allergic to latex." }

PUT    /client/pos/customer/:id/tags
  Body: { "tags": ["vip", "wholesale"] }

GET    /client/pos/customer/:id/sales
  → Paginated list of all POS sales for this customer.
  Query: ?page=1&limit=20&dateFrom=&dateTo=
```

#### Partial Refunds and Exchanges

```
POST   /client/pos/refund/create
  Body:
  {
    "originalSaleId": 42,
    "terminalId": 1,
    "type": "refund",  // or "exchange"
    "reason": "Faulty item",
    "items": [
      { "saleItemId": 15, "quantityReturned": 1, "restoreToShelfId": 5, "conditionNote": "Faulty" }
    ],
    "refundMethod": "original",  // original | cash | gift_card | account_credit
    "exchangeItems": []  // populated if type = exchange — same shape as /sale/create items[]
  }

  Server behaviour:
    1. Validate original sale belongs to same clientId
    2. Validate quantities don't exceed original
    3. Restore stock to specified shelf
    4. If type = exchange: atomically create new POSSale for exchange items, apply
       credit from return as payment against new sale
    5. Update original POSSale.status to 'partial_refund' or 'refunded'
    6. Return refund record + receipt data

  Response:
  {
    "refund": { "id", "refundNumber", "totalRefunded", "status" },
    "exchangeSale": { "saleNumber", "grandTotal" } | null,
    "receiptData": { ... }
  }

GET    /client/pos/refund/:id
GET    /client/pos/refund/by-sale/:saleId  → All refunds for a sale
```

#### Line-item Discounts

Line-item discounts are accepted in the existing `POST /client/pos/sale/create` as a `discount` field per item. No new endpoint needed. However, we add a validation endpoint for manager-override discounts:

```
POST   /client/pos/discount/validate-override
  Body: { "discountPercent": 25, "managerPIN": "1234", "terminalId": 1 }
  → Checks if the PIN belongs to a user with pos.sale.discount_override_max permission.
  Response: { "approved": true, "approvedBy": "Manager Name" } | { "approved": false }
```

#### Configurable Tax Rates

```
GET    /client/pos/tax-rates
  → Returns all active tax rates for this client.
  Query: ?warehouseId=1  (optional, returns store-specific overrides)

POST   /client/pos/tax-rates
  Body: { "name", "rate", "appliesTo", "categoryIds", "variationIds", "warehouseIds" }

PUT    /client/pos/tax-rates/:id
DELETE /client/pos/tax-rates/:id  (soft delete)

POST   /client/pos/tax-rates/resolve
  Body: { "items": [{ "variationId": 1001, "categoryId": 6, "warehouseId": 1 }] }
  → Resolves the correct tax rate for each item. Used by POS during cart build.
  Response: { "1001": { "rateId": 2, "name": "Standard Rate", "rate": 0.20 } }
```

#### Z-Report

```
GET    /client/pos/register/z-report/:sessionId
  → Returns the full Z-report data structure (same as stored in z_reports.reportData).
  → If the session is still open, returns 400.
  → Generates and stores the report on first call if not already generated.

GET    /client/pos/z-reports
  → Paginated list of all Z-reports: { id, sessionId, generatedAt, warehouseId, totalSales }
  Query: ?warehouseId=1&dateFrom=&dateTo=&page=1&limit=30
```

#### Offline Mode (see Section 4 for full architecture)

```
POST   /client/pos/sync/push
  Body: { "transactions": [{ "localId", "type", "terminalId", "createdAt", "data" }] }
  → Batch endpoint. Each item processed independently.
  → Deduplication by localId: if already synced, returns existing record without error.
  → Returns per-item status: synced | conflict | failed

GET    /client/pos/sync/pull/catalogue?since=ISO8601&limit=500&warehouseId=1
GET    /client/pos/sync/pull/customers?since=ISO8601&limit=500
GET    /client/pos/sync/pull/promotions?warehouseId=1
GET    /client/pos/sync/pull/tax-rates?warehouseId=1
GET    /client/pos/sync/pull/config?terminalId=1

GET    /client/pos/sync/conflicts?terminalId=1  → List unresolved conflicts
POST   /client/pos/sync/conflicts/:id/resolve   → Manager resolves a conflict
  Body: { "resolution": "honour_sale" | "void_sale" | "backorder", "notes": "" }
```

### 3.2 Phase 3 Endpoints

#### BOPIS / Click & Collect

```
GET    /client/pos/collections?warehouseId=1&status=pending,ready
  Query: ?page=1&limit=50&search=order_ref_or_customer_name

GET    /client/pos/collections/:orderId

POST   /client/pos/collections/:orderId/start-picking
  → Assigns current staff to picking, changes status to 'picking'

POST   /client/pos/collections/:orderId/ready
  Body: { "items": [{ "orderProductId", "pickedQty" }], "notifyCustomer": true }
  → Marks as ready, triggers customer notification (email + SMS if configured)

POST   /client/pos/collections/:orderId/collect
  Body: { "collectionCode": "ABC123", "staffNotes": "" }
  → Validates collection code, marks as collected, adjusts stock

POST   /client/pos/collections/:orderId/cancel
  Body: { "reason": "Customer requested cancellation" }
  → Triggers refund workflow

GET    /client/pos/collections/stats?warehouseId=1&dateFrom=&dateTo=
```

#### Ship from Store

```
POST   /client/pos/ship-from-store/accept/:orderId
  → Store manager accepts an online order for fulfilment from this store's stock
  Body: { "warehouseId": 1, "staffId": 12 }

POST   /client/pos/ship-from-store/pick/:orderId
  Body: { "items": [{ "orderProductId", "pickedQty", "shelfId" }] }

POST   /client/pos/ship-from-store/dispatch/:orderId
  Body: { "carrier": "royal_mail", "trackingNumber": "AA123456789GB", "labelPrinted": true }

GET    /client/pos/ship-from-store/queue?warehouseId=1&status=pending
```

#### Transfer Orders

```
POST   /client/pos/transfers/request
  Body:
  {
    "fromWarehouseId": 2,
    "toWarehouseId": 1,
    "items": [{ "variationId", "requestedQty", "reason": "Low stock at destination" }],
    "priority": "normal"  // or "urgent"
  }

GET    /client/pos/transfers/incoming?warehouseId=1&status=pending
GET    /client/pos/transfers/outgoing?warehouseId=1&status=pending

POST   /client/pos/transfers/:id/approve   Body: { "approvedBy": userId }
POST   /client/pos/transfers/:id/dispatch  Body: { "items": [{ "variationId", "sentQty" }] }
POST   /client/pos/transfers/:id/receive   Body: { "items": [{ "variationId", "receivedQty", "shelfId" }] }
```

#### Real-time Inventory Sync

The server broadcasts stock change events over WebSocket. The Electron app subscribes on connect.

```
WS  /client/pos/ws?terminalId=1&token={bearer}

Server → Client events:
  { "event": "stock.changed", "data": { "variationId": 1001, "warehouseId": 1, "newStock": 5 } }
  { "event": "order.collection_ready", "data": { "orderId": 4521, "customerName": "John" } }
  { "event": "transfer.arrived", "data": { "transferId": 12, "itemCount": 3 } }
  { "event": "promotion.updated", "data": { "promotionId": 7 } }

Client → Server (heartbeat):
  { "event": "terminal.heartbeat", "data": { "terminalId": 1, "status": "active" } }
```

### 3.3 Phase 4 Endpoints

#### Staff Permissions

```
GET    /client/pos/permissions/my-permissions
  → Returns the current user's POS action permissions. Cached in authStore.
  Response: { "pos.sale.create": true, "pos.sale.discount_override_max": false, ... }

POST   /client/pos/permissions/verify-pin
  Body: { "pin": "1234", "requiredAction": "pos.manager_pin_override" }
  → Validates PIN + checks the user has the required action. Used for manager overrides.
  Response: { "approved": true, "user": { "id", "name" } }
```

#### Multi-Currency

```
GET    /client/pos/currencies
GET    /client/pos/currencies/rates?base=GBP
  → Returns current exchange rates. Client caches and refreshes hourly.

POST   /client/pos/sale/create with additional field:
  "currency": "USD",
  "exchangeRate": 1.2652,
  "baseCurrencyTotal": 264.00  — server stores both, reports in base currency
```

#### Loyalty and Gift Cards

Full endpoint list defined in the Phase 1 scaffold document (sections 3.5 and 3.6). Reproduced in brief:

```
POST/GET  /client/pos/loyalty/config
GET       /client/pos/loyalty/customer/:customerId
POST      /client/pos/loyalty/earn      (called as part of sale/create, also standalone)
POST      /client/pos/loyalty/redeem
GET       /client/pos/loyalty/history/:customerId

POST/GET  /client/pos/gift-card/create
POST      /client/pos/gift-card/sell
GET       /client/pos/gift-card/balance/:code
POST      /client/pos/gift-card/redeem
POST      /client/pos/gift-card/top-up
```

#### Product Bundles

```
GET    /client/pos/bundles?active=true
  → Lists bundles with POS price and component items for display in product grid.

GET    /client/pos/bundles/:bundleId
  → Full bundle detail: components, current stock per component, bundle price.

POST   /client/pos/sale/create
  → Bundle handled server-side: items[] can include { "bundleId": 5, "quantity": 1 }
    Server explodes bundle into constituent items for stock decrement.
```

#### Custom Sale (Ad-hoc Items)

```
No new table needed. A 'custom' line item in POSSaleItems uses:
  variationId = null
  name = (cashier-entered description)
  sku = 'CUSTOM'
  unitPrice = cashier-entered
  tax = resolved via default tax rate

/client/pos/sale/create accepts items where variationId is null but
name + unitPrice + taxRateId are present.
```

#### Layaway

Full CRUD defined in Phase 1 scaffold (section 3.1). Additional endpoint:

```
GET    /client/pos/layaway/:id/payment-schedule
  → Shows instalment breakdown and due dates if configured.
```

#### Cash Management

```
POST   /client/pos/register/safe-drop
  Body: { "sessionId": 1, "amount": 500.00, "notes": "Bank deposit run" }
  → Identical to cash-out but labelled separately for reporting.

POST   /client/pos/register/pay-in
  Body: { "sessionId": 1, "amount": 20.00, "reason": "Paid window cleaner" }

POST   /client/pos/register/pay-out
  Body: { "sessionId": 1, "amount": 200.00, "reason": "Petty cash for stationery" }

GET    /client/pos/register/cash-movements?sessionId=1
  → Returns all cash-in, cash-out, safe-drop, pay-in, pay-out events for a session.
```

#### Dashboard and Analytics

```
GET    /client/pos/dashboard?warehouseId=1&date=2026-04-22
  Response:
  {
    "today": { "totalSales", "transactionCount", "averageBasket", "refundTotal" },
    "hourly": [{ "hour": "09:00", "sales": 12, "total": 450.00 }],
    "comparedToYesterday": { "salesChange": +12.3, "countChange": +5 },
    "comparedToLastWeek": { "salesChange": -3.1, "countChange": -2 },
    "topProducts": [{ "name", "qty", "total" }],
    "paymentMethods": { "cash": 1247.50, "card": 2156.30, ... },
    "staffLeaderboard": [{ "name", "saleCount", "total" }]
  }

GET    /client/pos/dashboard/multi-store
  → Same shape but aggregated across all stores the user has access to.
```

#### Barcode Label Printing

```
POST   /client/pos/labels/print
  Body:
  {
    "items": [
      { "variationId": 1001, "qty": 10, "format": "ZPL_2x1" }
    ],
    "printerConfig": { "ip": "192.168.1.101", "port": 9100 }
  }
  → Server generates ZPL, Electron main process sends to label printer.
```

### 3.4 Phase 5 Endpoints

#### Accounting Integration

```
POST   /client/integrations/accounting/connect
  Body: { "provider": "xero", "authCode": "oauth_code", "redirectUri": "..." }

GET    /client/integrations/accounting/status
DELETE /client/integrations/accounting/disconnect

POST   /client/integrations/accounting/sync/manual
  Body: { "dateFrom": "2026-04-01", "dateTo": "2026-04-22" }
  → Pushes all POS Z-report totals as journal entries to Xero/QuickBooks.
  → Runs in background; returns a jobId.

GET    /client/integrations/accounting/sync/:jobId
GET    /client/integrations/accounting/sync/log?dateFrom=&dateTo=
```

#### Email Marketing

```
POST   /client/integrations/email-marketing/connect
  Body: { "provider": "mailchimp", "apiKey": "...", "listId": "..." }

GET    /client/integrations/email-marketing/status

POST   /client/integrations/email-marketing/sync-customers
  → Syncs opted-in customers with email list. Returns { "synced": 142, "skipped": 3 }.

POST   /client/integrations/email-marketing/segment
  Body: { "segmentName": "VIP Customers", "filter": { "tags": ["vip"], "minSpend": 500 } }
```

#### Webhooks

```
POST   /client/webhooks/endpoints
  Body: { "url", "secret", "events": ["pos.sale.completed", "pos.refund.processed"] }

GET    /client/webhooks/endpoints
PUT    /client/webhooks/endpoints/:id
DELETE /client/webhooks/endpoints/:id

POST   /client/webhooks/endpoints/:id/test
  → Sends a sample payload to the endpoint URL. Returns delivery result.

GET    /client/webhooks/deliveries?endpointId=&status=&dateFrom=
GET    /client/webhooks/deliveries/:id   → Full delivery log including request + response
POST   /client/webhooks/deliveries/:id/retry
```

Webhook event catalogue:

```
pos.sale.completed          pos.sale.voided
pos.refund.processed        pos.exchange.completed
pos.register.opened         pos.register.closed
pos.collection.ready        pos.collection.collected
pos.gift_card.sold          pos.gift_card.redeemed
pos.loyalty.points_earned   pos.loyalty.points_redeemed
pos.transfer.created        pos.transfer.completed
pos.stock.low_stock_alert   pos.customer.created
```

---

## 4. Offline Architecture

### 4.1 Local SQLite Database (Electron Main Process)

The local SQLite database is managed entirely in the Electron main process using `better-sqlite3`. The renderer process never accesses SQLite directly — it communicates via IPC. This boundary ensures database operations are synchronous and never block the UI thread.

**Package to add:** `better-sqlite3` (with `@types/better-sqlite3`)

**Database file location:** `app.getPath('userData')/pos-local.db` — persists across app restarts, backed up automatically if auto-update wipes the installation directory (electron-builder preserves userData).

#### Schema (local SQLite tables)

```sql
-- products: synced product catalogue
CREATE TABLE products (
  variationId   INTEGER PRIMARY KEY,
  catalogueId   INTEGER,
  name          TEXT NOT NULL,
  sku           TEXT,
  ean           TEXT,
  imageUrl      TEXT,
  regularPrice  REAL,
  salePrice     REAL,
  costPrice     REAL,
  vatRateId     INTEGER,
  vatRate       REAL,
  stock         INTEGER DEFAULT 0,
  categoryId    INTEGER,
  brandId       INTEGER,
  attributes    TEXT,  -- JSON string
  isBundle      INTEGER DEFAULT 0,
  updatedAt     TEXT,
  syncedAt      TEXT
);
CREATE INDEX idx_products_ean ON products(ean);
CREATE INDEX idx_products_sku ON products(sku);

-- customers: recent/cached customers
CREATE TABLE customers (
  id            INTEGER PRIMARY KEY,
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  loyaltyPoints INTEGER DEFAULT 0,
  loyaltyTier   TEXT,
  tags          TEXT,  -- JSON string
  updatedAt     TEXT,
  syncedAt      TEXT
);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

-- promotions: active promo rules
CREATE TABLE promotions (
  id            INTEGER PRIMARY KEY,
  clientId      INTEGER,
  name          TEXT,
  type          TEXT,
  conditions    TEXT,  -- JSON string
  reward        TEXT,  -- JSON string
  stackable     INTEGER DEFAULT 0,
  startsAt      TEXT,
  endsAt        TEXT,
  syncedAt      TEXT
);

-- tax_rates: resolved tax rates
CREATE TABLE tax_rates (
  id            INTEGER PRIMARY KEY,
  name          TEXT,
  rate          REAL,
  appliesTo     TEXT,
  categoryIds   TEXT,  -- JSON
  variationIds  TEXT,  -- JSON
  isDefault     INTEGER DEFAULT 0,
  syncedAt      TEXT
);

-- config: key/value settings
CREATE TABLE config (
  key           TEXT PRIMARY KEY,
  value         TEXT,  -- JSON string for complex values
  updatedAt     TEXT
);

-- offline_queue: pending transactions to sync
CREATE TABLE offline_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  localId       TEXT UNIQUE NOT NULL,  -- UUID v4
  type          TEXT NOT NULL,         -- 'sale', 'refund', 'clock_in', etc.
  terminalId    INTEGER,
  createdAt     TEXT NOT NULL,
  payload       TEXT NOT NULL,         -- JSON string
  status        TEXT DEFAULT 'pending',  -- pending | syncing | synced | failed | conflict
  attempts      INTEGER DEFAULT 0,
  lastError     TEXT,
  syncedAt      TEXT,
  serverRecordId INTEGER   -- assigned after successful sync
);
CREATE INDEX idx_offline_queue_status ON offline_queue(status);

-- receipt_cache: recent receipts for reprint
CREATE TABLE receipt_cache (
  saleId        INTEGER PRIMARY KEY,
  saleNumber    TEXT,
  receiptJson   TEXT,  -- full receipt data JSON
  printedAt     TEXT,
  cachedAt      TEXT
);

-- sync_log: last sync timestamps per entity
CREATE TABLE sync_log (
  entity        TEXT PRIMARY KEY,   -- 'products', 'customers', 'promotions', 'config'
  lastSyncAt    TEXT,
  recordCount   INTEGER DEFAULT 0
);
```

### 4.2 Sync Engine (Electron Main Process)

The sync engine lives in `src/main/sync/syncEngine.ts`. It runs as a background task using `setInterval` and also responds to explicit trigger calls from the renderer via IPC.

#### Sync Schedule

```
On app start (after login):
  1. configSync.pull()          → fetch terminal config, tax rates, store settings
  2. promotionSync.pull()       → fetch active promotions
  3. catalogueSync.pull()       → delta pull (since last sync timestamp)
  4. customerSync.pull()        → delta pull top 2,000 by recent activity
  5. transactionPush.flush()    → push any pending offline_queue items
  6. heartbeat.send()           → tell server this terminal is online

Every 5 minutes:
  catalogueSync.pull()
  transactionPush.flush()
  heartbeat.send()

Every 15 minutes:
  customerSync.pull()
  promotionSync.pull()

Every 60 minutes:
  configSync.pull()

On demand (IPC call 'sync:force'):
  All of the above in sequence
```

#### Delta Pull Protocol

Each sync pull passes `since=ISO8601` derived from `sync_log` table. The server returns only records changed after that timestamp, plus a list of soft-deleted IDs. The `syncTimestamp` in the response becomes the next `since` value.

```typescript
// Pseudocode: catalogueSync.pull()
async function pullCatalogue(warehouseId: number) {
  const lastSync = db.prepare('SELECT lastSyncAt FROM sync_log WHERE entity = ?')
                    .get('products')?.lastSyncAt ?? '1970-01-01T00:00:00Z';

  let hasMore = true;
  let syncTimestamp = lastSync;

  while (hasMore) {
    const response = await api.get('/client/pos/sync/pull/catalogue', {
      params: { since: syncTimestamp, limit: 500, warehouseId }
    });

    const { updated, deleted, syncTimestamp: newTs, hasMore: more } = response.data.data;

    // Upsert updated records
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO products (variationId, catalogueId, name, sku, ean,
        imageUrl, regularPrice, salePrice, vatRate, stock, categoryId, brandId,
        attributes, isBundle, updatedAt, syncedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of updated) {
      upsert.run(p.variationId, p.catalogueId, p.name, p.sku, p.ean,
        p.imageUrl, p.regularPrice, p.salePrice, p.vatRate, p.stock,
        p.categoryId, p.brandId, JSON.stringify(p.attributes), p.isBundle ? 1 : 0,
        p.updatedAt, new Date().toISOString());
    }

    // Remove deleted records
    if (deleted.length > 0) {
      db.prepare(`DELETE FROM products WHERE variationId IN (${deleted.map(() => '?').join(',')})`)
        .run(...deleted);
    }

    syncTimestamp = newTs;
    hasMore = more;
  }

  db.prepare('INSERT OR REPLACE INTO sync_log (entity, lastSyncAt) VALUES (?, ?)')
    .run('products', syncTimestamp);
}
```

### 4.3 Offline Queue and Transaction Push

When the API is unreachable, all sale-creating operations write to `offline_queue` instead of calling the API directly.

```typescript
// Pseudocode: offlineQueue.ts (renderer-side service)
export async function processSale(payload: SalePayload): Promise<SaleResult> {
  if (navigator.onLine && await apiHealthCheck()) {
    return await api.post('/client/pos/sale/create', payload);
  }

  // Offline path
  const localId = crypto.randomUUID();
  await window.api.ipc('offline:enqueue', {
    localId,
    type: 'sale',
    terminalId: payload.terminalId,
    createdAt: new Date().toISOString(),
    payload
  });

  // Return a synthetic result so the UI can proceed
  return {
    success: true,
    data: {
      saleNumber: `OFFLINE-${localId.slice(0, 8).toUpperCase()}`,
      status: 'offline_pending',
      grandTotal: payload.grandTotal,
      loyaltyPointsEarned: 0,
      receiptData: buildLocalReceiptData(payload)
    }
  };
}
```

#### Flush (push to server when back online)

```typescript
// Pseudocode: transactionPush.flush()
async function flush() {
  const pending = db.prepare(
    'SELECT * FROM offline_queue WHERE status = ? ORDER BY createdAt ASC LIMIT 50'
  ).all('pending');

  if (pending.length === 0) return;

  // Mark as 'syncing' to prevent double-submission
  db.prepare('UPDATE offline_queue SET status = ? WHERE id IN (...)')
    .run('syncing', ...pending.map(p => p.id));

  const response = await api.post('/client/pos/sync/push', {
    transactions: pending.map(p => ({
      localId: p.localId,
      type: p.type,
      terminalId: p.terminalId,
      createdAt: p.createdAt,
      data: JSON.parse(p.payload)
    }))
  });

  for (const result of response.data.data.results) {
    if (result.status === 'synced') {
      db.prepare('UPDATE offline_queue SET status = ?, syncedAt = ?, serverRecordId = ? WHERE localId = ?')
        .run('synced', new Date().toISOString(), result.serverId, result.localId);
    } else if (result.status === 'conflict') {
      db.prepare('UPDATE offline_queue SET status = ? WHERE localId = ?')
        .run('conflict', result.localId);
      // Notify renderer to show conflict resolution UI
      mainWindow.webContents.send('sync:conflict', result);
    }
  }
}
```

### 4.4 Conflict Resolution

Three conflict scenarios and their resolution flows:

**Scenario A — Stock oversell**
Server detects that when the offline sale was processed, actual stock was insufficient.
- Server response: `{ status: 'conflict', conflictType: 'stock_insufficient', variationId, available, requested }`
- Renderer shows `ConflictResolutionModal` to manager
- Manager chooses: (1) Honour sale and go to negative stock, (2) Void the line item and partial-refund customer, (3) Place on backorder

**Scenario B — Price mismatch**
Server detects offline sale price differs from current price.
- Configured threshold: if difference > 10%, flag as conflict; otherwise, auto-accept offline price (price at time of sale is authoritative).
- This protects against a price rollback causing unintended discounts.

**Scenario C — Duplicate submission**
Server always checks `localId` uniqueness. If a `localId` already exists in POSSales (from a previous sync attempt), the server returns the existing sale record with `status: 'already_synced'`. The Electron app marks the queue item as `synced`.

---

## 5. State Management

### 5.1 Existing Stores (Phase 1)

```
cartStore.ts      — items[], customer, discount, subtotal/VAT/total computations
registerStore.ts  — current register session (id, openFloat, openedAt)
```

### 5.2 New Stores — Phase 2

#### authStore.ts

```typescript
interface AuthState {
  user: { id: number; name: string; role: string; pin?: string } | null;
  permissions: Record<string, boolean>;  // 'pos.sale.create': true, etc.
  terminalId: number | null;
  warehouseId: number | null;
  token: string | null;

  login: (employeeId: string, pin: string) => Promise<void>;
  logout: () => void;
  hasPermission: (action: string) => boolean;
  requireManagerOverride: (action: string) => Promise<boolean>;
  setTerminal: (terminalId: number, warehouseId: number) => void;
  refreshPermissions: () => Promise<void>;
}
```

`requireManagerOverride` opens a PIN pad modal requesting a manager PIN. Returns true if a manager approves, false if cancelled.

#### settingStore.ts

```typescript
interface SettingState {
  taxRates: TaxRate[];
  defaultTaxRate: TaxRate | null;
  receiptTemplate: ReceiptTemplate | null;
  currency: Currency;
  storeInfo: StoreInfo;
  loyaltyConfig: LoyaltyConfig | null;
  hardwareConfig: HardwareConfig;

  resolveTaxForItem: (variationId: number, categoryId: number) => TaxRate;
  refreshSettings: () => Promise<void>;
}
```

#### syncStore.ts

```typescript
interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncAt: Record<string, string>;  // entity → ISO timestamp
  syncErrors: SyncError[];

  setOnline: (online: boolean) => void;
  setPendingCount: (n: number) => void;
  triggerSync: () => Promise<void>;
  dismissError: (id: string) => void;
}
```

### 5.3 New Stores — Phase 2 (cartStore extension)

The existing `cartStore` must be extended. Rather than breaking the existing interface, additions are appended:

```typescript
// Additions to CartItem interface
interface CartItem {
  // existing fields...
  lineDiscount: Discount | null;   // per-line discount
  taxRateId: number;
  taxRate: number;
  taxAmount: number;               // computed
  lineTotalExTax: number;          // computed
  lineTotalIncTax: number;         // computed
  isCustomItem: boolean;           // ad-hoc item with no variationId
  bundleId: number | null;
  serialNumber: string | null;
}

// Additions to CartState
interface CartState {
  // existing fields...
  currency: string;
  exchangeRate: number;
  loyaltyPointsToRedeem: number;
  loyaltyDiscountAmount: number;
  promotionId: number | null;
  promotionDetails: AppliedPromotion[] | null;

  setLineDiscount: (variationId: number, discount: Discount | null) => void;
  addCustomItem: (item: Omit<CartItem, 'variationId' | 'catalogueId'>) => void;
  setLoyaltyRedemption: (points: number, discountAmount: number) => void;
  applyPromotion: (promotion: AppliedPromotion) => void;
  removePromotion: () => void;
  getTaxBreakdown: () => TaxLine[];
}
```

### 5.4 New Stores — Phase 3

#### collectionsStore.ts

```typescript
interface CollectionsState {
  pendingOrders: BopisOrder[];
  readyOrders: BopisOrder[];
  selectedOrder: BopisOrder | null;
  isLoading: boolean;

  loadOrders: (warehouseId: number) => Promise<void>;
  markReady: (orderId: number, items: PickedItem[]) => Promise<void>;
  markCollected: (orderId: number, code: string) => Promise<void>;
  selectOrder: (order: BopisOrder) => void;
}
```

### 5.5 New Stores — Phase 4

#### loyaltyStore.ts

```typescript
interface LoyaltyState {
  config: LoyaltyConfig | null;
  tiers: LoyaltyTier[];
  customerLoyalty: CustomerLoyalty | null;  // for the currently attached customer

  loadConfig: () => Promise<void>;
  loadCustomerLoyalty: (customerId: number) => Promise<void>;
  calculateEarnable: (saleTotal: number) => number;
  calculateRedeemable: (points: number) => number;  // returns £ value
  clearCustomerLoyalty: () => void;
}
```

#### giftCardStore.ts

```typescript
interface GiftCardState {
  checkedCard: { code: string; balance: number } | null;
  isChecking: boolean;

  checkBalance: (code: string) => Promise<void>;
  clearCard: () => void;
}
```

#### displayStore.ts

```typescript
interface DisplayState {
  cartItems: DisplayCartItem[];
  cartTotal: number;
  customerName: string | null;
  loyaltyPoints: number | null;
  mode: 'cart' | 'idle' | 'payment' | 'thankyou';
  idleContent: IdleContent;

  updateCart: (items: DisplayCartItem[], total: number) => void;
  setMode: (mode: DisplayState['mode']) => void;
  setIdleContent: (content: IdleContent) => void;
}
```

`displayStore` is also subscribed to by the Electron main process, which forwards state changes to the Customer Display BrowserWindow via `webContents.send`.

---

## 6. Component Architecture

### 6.1 Phase 2 Components

#### Receipt and Email

```
src/renderer/src/components/receipt/
  ReceiptPrintButton.tsx
    Props: saleId, variant ('print' | 'email' | 'reprint')
    Behaviour: calls window.api.ipc('hardware:print-receipt', receiptData)
               for print; calls POST /receipt/:saleId/email for email.

  ReceiptPreviewModal.tsx
    Props: receiptData, onPrint, onEmail, onClose
    Renders receipt as formatted HTML (mirrors thermal output) in a modal.
    Useful before sale completes (optional preview) or for reprints.

  EmailReceiptForm.tsx
    Props: defaultEmail (from attached customer), onSubmit
    Simple email input with Send button. Validates email format.
```

#### Full Customer Profile

```
src/renderer/src/pages/Customers/
  CustomerProfilePage.tsx
    Full page layout. Tabs: Overview | Purchase History | Loyalty | Notes & Tags.

  CustomerProfile/
    ProfileOverview.tsx     — Name, contact, stats (lifetime spend, visits, avg basket)
    PurchaseHistory.tsx     — Paginated table: date, sale#, items, total, refunded
    LoyaltyTab.tsx          — Points balance, tier badge, points history table
    NotesEditor.tsx         — Free-text notes with save/cancel
    TagsEditor.tsx          — Tag chip editor (add/remove tags from preset list)

  CustomerQuickPanel.tsx  (side panel in main POS — replaces current inline display)
    Shows attached customer name, loyalty tier badge, points balance.
    Quick links: View Profile | Detach | Lookup Loyalty.
```

#### Line-item Discounts

```
src/renderer/src/components/cart/
  CartItem.tsx  (extend existing)
    Add: discount badge, right-click or swipe action → opens LineDiscountModal

  LineDiscountModal.tsx
    Props: item, maxDiscountPercent (from permissions), onApply, onClose
    Type selector: Percentage | Fixed Amount
    Value input with numpad
    If value exceeds maxDiscountPercent: prompt for manager PIN override
    Shows resulting line total before confirmation
```

#### Configurable Tax Display

```
src/renderer/src/components/cart/
  TaxBreakdown.tsx
    Replaces single "VAT (20%)" line in cart summary.
    Shows all tax lines: [{ name: "VAT 20%", amount: £55.79 }, { name: "Reduced 5%", amount: £1.50 }]
    Collapses to single "Tax: £57.29" if only one line.
```

#### Z-Report

```
src/renderer/src/pages/Reports/
  ZReportPage.tsx
    Loads by sessionId (passed as route param or selected from session history).
    Sections: Session Info | Sales Summary | Payment Method Breakdown |
              Cash Reconciliation | Hourly Breakdown | Top Products | Staff Breakdown
    Print button: formats as thermal receipt and sends to printer.
    Export button: downloads as PDF (rendered via html-to-pdf in main process).
```

#### Offline Mode UI

```
src/renderer/src/components/
  NetworkIndicator.tsx  (extend existing)
    States: Online (green) | Offline (amber) | Syncing (blue spinner)
    Offline state: shows tooltip "X sales pending sync"
    Click → opens SyncStatusModal

  SyncStatusModal.tsx
    Shows: Last sync times per entity, Pending count, Failed count, Conflict count.
    Buttons: Force Sync Now | View Conflicts

  ConflictResolutionPage.tsx  (accessible from admin nav)
    Table of unresolved conflicts with details.
    Manager action per row: Honour | Void | Backorder
    Requires manager PIN to submit.
```

### 6.2 Phase 3 Components

```
src/renderer/src/pages/Collections/
  CollectionsPage.tsx
    Tab strip: Pending | Ready | Completed Today
    Search bar: order ref or customer name
    CollectionCard per order: order number, customer name, item count, age

  CollectionDetailModal.tsx
    Shows all items in order: name, qty, picked status
    Action buttons contextual to status:
      Pending → "Start Picking" → "Mark Ready (X items)"
      Ready   → "Mark Collected" (prompts for collection code entry)
    Partial collection: allow individual item qty overrides
    Notes textarea

  CollectionScanBar.tsx
    Floating input at top of CollectionsPage.
    Listens for barcode that matches a collection code.
    Auto-opens CollectionDetailModal for that order.
```

### 6.3 Phase 4 Components

#### Permissions

```
src/renderer/src/components/auth/
  ManagerPINModal.tsx
    Triggered by requireManagerOverride(action) in authStore.
    Full-screen overlay NumPad for manager PIN entry.
    Shows: "Manager PIN required for: [action description]"
    Timeout: auto-dismiss after 30 seconds of inactivity.

  PermissionGate.tsx
    Wrapper component:
    <PermissionGate action="pos.sale.discount_line">
      <LineDiscountButton />
    </PermissionGate>
    If user lacks permission: renders null or a disabled placeholder (controlled by prop).
```

#### Loyalty

```
src/renderer/src/components/loyalty/
  LoyaltyBadge.tsx
    Small badge in cart header showing tier icon + points balance for attached customer.

  LoyaltyRedeemOption.tsx
    Option in PaymentModal: "Redeem X points = £Y discount"
    Slider or input to select how many points to redeem (multiples of 100).
    Shows: Points balance → Points to redeem → Discount applied → Remaining points.

  LoyaltyEnrolModal.tsx
    Quick enrol during checkout. Captures: name, email, phone, DOB (optional).
    Submits customer create + loyalty enrol in one call.
```

#### Gift Cards

```
src/renderer/src/components/gift-cards/
  GiftCardPaymentPanel.tsx
    Sub-panel inside PaymentModal.
    Barcode scan input or manual code entry.
    Shows: Card found / balance / amount to apply.

  GiftCardSellModal.tsx
    Triggered from "Sell Gift Card" action in main nav or as a product.
    Inputs: value (preset amounts + custom), physical/digital, recipient name/email.
    Generates code server-side, prints gift card receipt.

  GiftCardBalanceChecker.tsx
    Simple standalone panel: scan/enter code → shows balance.
    Available from main nav without requiring a sale.
```

#### Customer Display (Second Window)

```
src/customer-display/
  DisplayApp.tsx           — Root component for second BrowserWindow
  CartView.tsx             — Live itemised cart + running total
  IdleScreen.tsx           — Promotions carousel, brand logo, store info
  PaymentScreen.tsx        — "Processing payment..." overlay
  ThankYouScreen.tsx       — Post-sale: total, change, loyalty points earned
  DisplayBridge.ts         — Listens to IPC events from main process, updates React state
```

The Customer Display window is opened by the main process as a `BrowserWindow` positioned on the second monitor (if detected). It loads a separate entry point (`customer-display/index.html`). State is pushed from the main process via `webContents.send` whenever cartStore changes, triggered by subscriptions in the main process that listen to renderer IPC events.

### 6.4 Phase 5 Components

```
src/renderer/src/pages/Admin/
  WebhooksPage.tsx
    Table of registered endpoints. Status indicators (last delivery, success rate).
    Add Endpoint form: URL, events (multi-select), secret generation.
    Test Endpoint button with response preview.

  AccountingIntegrationPage.tsx
    Connect/disconnect Xero or QuickBooks (OAuth flow via system browser).
    Last sync timestamp, records synced count.
    Manual sync trigger with date range picker.
    Sync log table: date, records, status, errors.

  EmailMarketingPage.tsx
    Connect Mailchimp/Klaviyo/etc.
    Customer sync status.
    Audience segment builder: filter by tags, lifetime spend, last purchase date.
```

---

## 7. Integration Patterns

### 7.1 Card Terminal Integration (Stripe Terminal)

The Stripe Terminal SDK runs in the Electron main process (it requires Node.js). The renderer calls it via IPC.

**Flow:**
1. On terminal setup: `POST /client/pos/payment/card-terminal/pair` → server stores pairing
2. On app start: main process calls `StripeTerminal.create()`, discovers the reader on LAN
3. When cashier selects Card payment:
   - Renderer sends `ipc('hardware:card-payment', { amount, currency })` to main
   - Main calls `StripeTerminal.collectPaymentMethod(paymentIntentClientSecret)`
   - Customer taps/inserts card on reader
   - Main calls `StripeTerminal.processPayment()`
   - On success: main sends `ipc('hardware:card-payment-result', { success: true, paymentIntentId })`
   - Renderer includes `paymentIntentId` in the sale creation request

**Offline card:** Card payments are blocked entirely when offline. The PaymentModal disables the Card option and shows a tooltip: "Card payments require a network connection."

**Error recovery:** If card payment succeeds on the terminal but the sale creation API call fails (network drop in the 200ms window), the renderer queues the sale to offline_queue with the `paymentIntentId` in the payload. On sync, the server validates the PaymentIntent exists in Stripe before processing the sale.

### 7.2 Receipt Printer (ESC/POS)

The receipt printer is controlled entirely in the Electron main process via a TCP socket to IP:9100 (network printer) or via USB using `node-usb` / `node-escpos`.

**Recommended package:** `escpos` (npm) + `escpos-network` or `escpos-usb` adapters.

**Flow:**
1. `ReceiptPrintButton` calls `ipc('hardware:print-receipt', receiptData)`
2. Main process receives `receiptData` (the structured JSON from `/receipt/:saleId/data`)
3. `receiptFormatter.ts` converts to ESC/POS command buffer
4. Main process opens TCP socket to printer IP:9100, writes buffer, closes socket
5. Cash drawer is kicked immediately after print if payment includes cash: sends `\x1B\x70\x00\x19\x32`

**ESC/POS command generation (key commands):**
```
ESC @ — Initialize printer
ESC ! — Font selection (emphasize for headers)
GS V — Cut paper
ESC p — Open cash drawer
GS k — Print barcode
ESC a — Alignment (center/left/right)
```

### 7.3 Customer Display Window

The second BrowserWindow is opened by main on startup if a second monitor is detected (`screen.getAllDisplays().length > 1`). It is positioned on the secondary display's bounds.

**State propagation:**
1. Renderer's cartStore and saleCompleteStore use Zustand's `subscribe` to listen for state changes
2. On change, renderer sends `ipc('display:update-cart', cartSnapshot)` to main
3. Main receives and forwards via `customerDisplayWindow.webContents.send('display:cart', data)`
4. `DisplayBridge.ts` in the customer display window subscribes to these events and updates its React state

### 7.4 WebSocket for Real-time Events

The Electron app connects to the server's WebSocket endpoint on startup. The connection is managed in the main process and proxied to the renderer via IPC.

```
Main process:
  - Maintains a single WebSocket connection per app instance
  - Reconnects with exponential backoff (max 30s) on disconnect
  - Authenticates via token in query string

Events routed to renderer via IPC:
  stock.changed → productRepo.updateStock(variationId, newStock) + send to renderer
  order.collection_ready → collectionsStore.addReadyOrder(order)
  promotion.updated → pull latest promotions and update local SQLite

Events routed to Customer Display:
  (handled internally — cartStore changes trigger display updates)
```

### 7.5 Accounting Integration (Xero)

The integration runs server-side and is scheduled to run nightly, pushing the previous day's Z-report as a journal entry.

**Data mapping (POS → Xero):**
```
Z-Report.totalSales       → Sales Revenue account (GL code configured by user)
Z-Report.taxTotal         → VAT Control account
Z-Report.totalRefunds     → Sales Returns account
Z-Report.giftCardSold     → Gift Card Liability account
Z-Report.giftCardRedeemed → Gift Card Liability account (debit)
```

Each Z-report becomes a single Xero Manual Journal. The `external_id` (Xero Journal ID) is stored in `accounting_sync_log` for idempotency. If re-synced, the existing Xero record is voided and re-created, not duplicated.

OAuth2 tokens (Xero access + refresh tokens) are stored server-side in an encrypted column, never in the Electron app.

### 7.6 Webhook Delivery

Webhooks are fired server-side. When a POS event occurs (e.g., sale completed), the server:
1. Looks up all active webhook_endpoints for this clientId that subscribe to the event
2. Creates a `webhook_deliveries` row with status `pending`
3. Queues delivery via a background job (Redis queue / in-process queue depending on server stack)
4. Background worker sends HTTP POST to the endpoint URL with:
   - `Content-Type: application/json`
   - `X-Combosoft-Event: pos.sale.completed`
   - `X-Combosoft-Signature: sha256=HMAC(payload, secret)`
   - `X-Combosoft-Delivery: delivery-uuid`
5. On 2xx response: marks delivered
6. On failure: schedules retry per `retryPolicy` (3 attempts: 30s, 5min, 1h)

---

## 8. Security Considerations

### 8.1 Role-Based Access Control

The existing backend RBAC system (`Role` → `RolePermission` → `Permission` → `RoleAction`) is used directly. The POS app does not bypass this system.

**Key implementation rules:**
- On login, the app fetches and caches the user's permission set in `authStore.permissions`
- UI elements guarded by `<PermissionGate>` are hidden (not just disabled) when access is denied — prevents information leakage
- Permission cache is refreshed every 15 minutes and on explicit re-login
- Manager PIN override: the PIN is sent to the server for validation; the client never evaluates PINs locally
- Sensitive actions (void sale, large discount, refund without receipt) require manager PIN regardless of the logged-in user's role

### 8.2 Payment Data Handling

**PAN and card data:** The POS app never handles raw card numbers. All card processing flows through Stripe Terminal SDK. The only card data stored is `cardType` (Visa/MC) and `lastFour` — never the full PAN.

**Cash drawer access:** The cash drawer can only be opened programmatically after a cash payment, or manually by a user with `pos.cash.in` permission. There is no way to open it via the customer-facing UI.

**Gift card codes:** Codes are generated server-side with cryptographically random values (minimum 128 bits of entropy). They are transmitted only over HTTPS. The local SQLite cache stores gift card balances for offline use but the balance is always re-validated server-side before redemption.

### 8.3 Offline Token Management

The Bearer token must remain valid for offline operation. However, the server cannot validate JWTs when the POS is offline.

**Strategy:**
1. Use a long-lived refresh token stored in Electron's `safeStorage` (encrypted by OS keychain, not `localStorage`)
2. Short-lived access token (1 hour) stored in memory only (not persisted to disk)
3. When access token expires while offline: the app continues to function with `offlineMode = true`
4. On reconnect: use the stored refresh token to obtain a new access token before pushing the offline queue
5. If the refresh token is revoked (staff dismissal): the offline queue is held until a manager can authenticate and use their token to push the queue, or the conflicted items can be cleared

**Token storage:**
```typescript
// In Electron main process:
import { safeStorage } from 'electron';

// Store refresh token (encrypted by OS)
safeStorage.encryptString(refreshToken) → stored in config.json in userData

// Never store in:
// - localStorage (accessible to any JS in the renderer)
// - Plain SQLite column
// - Environment variables in the packaged app
```

### 8.4 Local Database Security

The SQLite file contains cached customer data and offline sales. It must be protected:
- Store the file in `app.getPath('userData')` — OS-level user isolation applies
- For environments with multiple Windows user accounts sharing one machine: warn during setup and recommend per-user OS logins
- Sensitive fields in SQLite (customer email, phone) are acceptable at rest without encryption for the standard threat model (lost/stolen hardware is the main risk; full-disk encryption via BitLocker is the mitigation recommended in setup documentation)
- The offline queue payload contains sale details including payment method, but never card PANs

### 8.5 API Communication Security

- All API calls use HTTPS (enforced in the axios instance by rejecting http:// URLs)
- The Bearer token is attached only to requests to the configured API host; the axios instance checks the URL base before adding the Authorization header to prevent token leakage to third-party URLs (e.g., CDN image requests)
- Certificate pinning: not implemented at this stage (adds significant maintenance overhead); rely on OS certificate store validation

### 8.6 Electron Renderer Security

```typescript
// electron/main.ts — BrowserWindow configuration
new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,           // CRITICAL: never enable
    contextIsolation: true,           // CRITICAL: must be true
    sandbox: true,                    // Recommended
    allowRunningInsecureContent: false,
    preload: path.join(__dirname, 'preload.js')
  }
});
```

The preload script exposes only specific IPC channels via `contextBridge.exposeInMainWorld`. The allow-list must be maintained — never expose `ipcRenderer.on` or `shell.openExternal` directly to the renderer.

---

## 9. Performance Considerations

### 9.1 Product Catalogue Performance

With potentially 50,000+ product variations in a large retailer, product search must remain under 100ms.

**Strategy:**
- SQLite FTS5 (Full-Text Search) extension for product name search:
  ```sql
  CREATE VIRTUAL TABLE products_fts USING fts5(
    name, sku, ean,
    content='products', content_rowid='variationId'
  );
  ```
- EAN/barcode lookup: indexed column, O(log n) lookup, < 1ms for 100k records
- All product queries run in the main process (synchronous better-sqlite3), returned to renderer via IPC — no async overhead for local queries
- Product images: displayed via CDN URL (`<img>` tag); do not cache images locally. Use `loading="lazy"` and a placeholder SVG while loading.
- Category filtering: add `categoryId` to the SQLite index for fast pre-filter before FTS

### 9.2 Cart Computation Performance

The cart total/tax/discount recalculation runs on every cart change. With potentially 50 line items and multiple tax rates, this must stay synchronous and fast.

- Tax resolution is cached in `settingStore` at startup — no API call during sale
- Promotion evaluation uses the `promotionEngine.ts` utility (pure function, no I/O)
- Zustand's `getState()` for derived computations avoids re-render on intermediate updates
- All monetary computations use integer arithmetic (pence/cents) internally, displayed as decimal — avoids floating-point rounding errors

### 9.3 Sync Performance

- Delta sync (not full replacement): only changed records are transferred
- Batch upserts via `better-sqlite3` transactions: 500 records insert in < 50ms
- Sync runs in the main process background — never blocks the renderer
- Sync is paused during active payment processing (to avoid I/O contention)
- `hasMore` pagination on sync pull endpoints prevents memory spikes from large datasets

### 9.4 Customer Display Performance

The second BrowserWindow is a separate renderer process. Passing large cart state frequently could cause lag.

- Only pass a serialized snapshot of the display-relevant cart fields, not the full cartStore state
- Throttle display updates to maximum once per 150ms using a debounce in the IPC handler
- The idle promotion carousel pre-loads images at startup; no lazy loading needed for idle content

### 9.5 Offline Queue Flushing

- Flush is batched (50 items per HTTP request) to avoid timeout issues
- Flush runs in main process background, not blocking the renderer
- Failed items are not immediately retried — exponential backoff: 30s, 2min, 10min, 30min
- Maximum 5 retry attempts before an item is marked `failed` and requires manual manager action

### 9.6 Large Z-Report Generation

Z-reports can require aggregating hundreds of transactions.

- Server-side: computed by SQL aggregate queries on POSSales + POSSaleItems, not row-by-row in application code
- Cacheable: once a session is closed, the Z-report data never changes; cache in `z_reports.reportData` JSONB on first generation
- PDF generation: done server-side (or in Electron's main process using `html-to-pdf`), not in the renderer

### 9.7 Memory Management

Electron apps can accumulate memory from large datasets in Zustand stores.

- `catalogueStore` only holds the current search results (max 100 products at a time), not the full catalogue — the full catalogue lives in SQLite
- `collectionsStore` paginates: loads 50 items, loads more on scroll
- Completed sale records are cleared from memory after the SaleComplete screen is dismissed
- The Z-report page renders on-demand from the API/SQLite; the full dataset is not kept in Zustand

---

## 10. Technical Risks and Mitigations

### Risk 1: Offline Sale Stock Conflicts (HIGH)

**Risk:** A product is sold offline at the same time it is sold online or at another terminal. When the offline sale syncs, stock may go negative.

**Mitigations:**
1. Server-side conflict detection on every sync push: if resolved stock would go below 0, flag as conflict instead of auto-processing
2. POS displays the last-synced stock count (not a real-time figure) during offline mode; UI shows a warning banner: "Showing stock as of [last sync time]. Actual availability may differ."
3. Manager review workflow: conflicts surface in a dedicated UI, not silently rejected
4. Configuration option: `allow_negative_stock` per product category — some retailers (fashion, electronics) want to honour the sale and handle the shortfall manually

### Risk 2: Receipt Printer Hardware Compatibility (MEDIUM)

**Risk:** ESC/POS is a de facto standard, not a strict specification. Different printer models interpret some commands differently (character encoding, logo printing, barcode formats vary).

**Mitigations:**
1. Test matrix: maintain a list of tested printers (Epson TM-T88VI, Star TSP143, Citizen CT-S310II)
2. `receiptFormatter.ts` has a `printerProfile` parameter to select known-compatible command sets
3. Network (TCP 9100) connection is preferred over USB — more consistent cross-vendor
4. Admin screen: "Test Print" button that prints a test pattern, allowing staff to verify settings without processing a sale
5. Fall back to plain text receipt (no graphics, no barcodes) if the configured printer type fails

### Risk 3: Stripe Terminal Network Dependency (HIGH)

**Risk:** Stripe Terminal requires a network connection for all card payments. A network outage means card payments are unavailable, potentially losing sales.

**Mitigations:**
1. UI clearly communicates: "Card payment unavailable — no network connection"
2. Offer cash-only mode automatically when offline
3. Consider SumUp as a secondary provider (SumUp Air has a local mode that stores transactions on the reader for later submission — validate this capability in the SumUp SDK)
4. Physical fallback: document the manual imprinter / "floor limit" process in staff training materials

### Risk 4: Electron Auto-Update Corrupting Local Data (MEDIUM)

**Risk:** An auto-update that changes the local SQLite schema without a migration could corrupt the local database, breaking the app until reinstalled.

**Mitigations:**
1. All SQLite schema changes are implemented as versioned migrations (numbered SQL files, applied in order)
2. Migration system checks `PRAGMA user_version` and applies only outstanding migrations at startup
3. Before applying migrations, create a backup copy of the database (`pos-local-backup-[timestamp].db`)
4. Auto-update uses a staged rollout (10% → 50% → 100%) so corruption issues are detected before full deployment
5. Recovery mechanism: if startup migration fails, the app rolls back to the backup and alerts the user

### Risk 5: JWT Refresh Token Expiry During Extended Offline (MEDIUM)

**Risk:** If a terminal is offline for longer than the refresh token lifetime, the token expires. On reconnect, the offline queue cannot be synced without re-authentication.

**Mitigations:**
1. Set refresh token lifetime to 30 days (configurable per client)
2. The offline mode warning banner includes: "You have been offline for X days. Reconnect and re-login to sync your transactions."
3. The sync engine checks token validity on reconnect; if expired, prompts for manager re-authentication before pushing the queue (does not clear the queue)
4. For terminals that are legitimately offline for extended periods (remote locations with daily sync), consider a dedicated long-lived "terminal token" that is scoped to sync operations only

### Risk 6: Duplicate Sale Creation on Network Retry (HIGH)

**Risk:** A sale POST request times out, the app retries, and two sales are created.

**Mitigation (already designed):**
- Every sale creation request (online and offline) includes a `offlineLocalId` (UUID v4)
- Server checks `UNIQUE` constraint on `offline_local_id` in POSSales table before inserting
- On duplicate UUID detection: server returns the existing sale record with HTTP 200 (not 409) so the client does not re-queue
- The UUID is generated the moment the cashier presses PAY, not on retry — so retries carry the same UUID

### Risk 7: Loyalty Points Double-Earning on Sync (MEDIUM)

**Risk:** An offline sale earns loyalty points locally (shown to customer), then on sync the server also awards points, resulting in double award.

**Mitigation:**
- Loyalty points are NOT awarded locally during offline mode
- The receipt shows: "Loyalty points earned: pending sync" instead of a specific number
- The server awards points as part of processing the synced sale
- The customer's displayed balance at next visit will reflect the correct post-sync total
- This is the same approach used by airline miles programs for offline check-in

### Risk 8: Multi-Currency Exchange Rate Staleness (LOW-MEDIUM)

**Risk:** Exchange rates cached in the app become stale, leading to incorrect prices in secondary currencies.

**Mitigations:**
1. Exchange rates are included in the `configSync.pull()` that runs every 60 minutes
2. If the rate is more than 2 hours old, the Currency Selector in the cart shows a warning badge
3. Exchange rate changes do not retroactively affect completed sales — the rate at time of sale is stored in POSSales
4. Configurable: clients can disable multi-currency at the warehouse level if not needed

### Risk 9: Gift Card Offline Redemption Race Condition (MEDIUM)

**Risk:** Two terminals both redeem the same gift card while offline. Combined redemption exceeds card balance.

**Mitigation:**
- Gift card redemptions are **not** queued to the offline queue — they are blocked when offline
- The PaymentModal shows: "Gift card payment requires a network connection"
- This is an acceptable UX trade-off given the financial risk of double redemption
- Future enhancement: implement a local gift card balance lock with a TTL, similar to a distributed lock, using the SQLite `config` table

### Risk 10: Electron App Window Management on Multi-Monitor Setup (LOW)

**Risk:** When a second monitor is disconnected or changes resolution, the customer display window may end up off-screen or crash.

**Mitigations:**
1. On display connection/disconnection events (`screen.on('display-added')`, `screen.on('display-removed')`), move or close the customer display window gracefully
2. On startup, validate that saved monitor configuration matches current display topology
3. Admin screen: "Customer Display" toggle — allows staff to disable it if using single monitor

---

## 11. Dependency Map

This section defines the implementation order and which features must exist before others can be built. Features are annotated with their phase.

### 11.1 Foundation Dependencies (must exist for everything else)

```
authStore (Phase 2)
  ↑ required by: ALL features that check permissions or use token

settingStore / tax_rates (Phase 2)
  ↑ required by: cartStore tax calculation, sale creation, Z-report

offline SQLite + syncEngine (Phase 2)
  ↑ required by: offline sale, offline customer lookup, promotion caching

WebSocket connection (Phase 3)
  ↑ required by: real-time inventory, collection notifications
```

### 11.2 Feature Dependency Graph

```
Phase 2 — Internal Dependencies:

  Configurable Tax Rates
    └─ must exist before: Line-item Discounts (discount applied to taxable amount)
    └─ must exist before: Z-Report (tax breakdown by rate)
    └─ must exist before: Partial Refunds (refund tax correctly)

  Receipt Templates
    └─ must exist before: Email Receipts (needs template to render)
    └─ must exist before: Z-Report PDF output

  Partial Refunds
    └─ requires: POSSales records with line-item detail
    └─ requires: Shelf assignment per sale item (for stock restore)

  Z-Report
    └─ requires: POSRegisterSession close endpoint
    └─ requires: All payment methods implemented (to show payment breakdown)

  Offline Mode
    └─ requires: SQLite local database
    └─ requires: Delta sync endpoints on server
    └─ requires: Sale creation endpoint (offline queue targets this)


Phase 3 — Dependencies on Phase 2:

  BOPIS / Click & Collect
    └─ requires: WebSocket (for collection ready notifications)
    └─ requires: Existing Orders model on server

  Ship from Store
    └─ requires: Existing ShippingService models
    └─ requires: BOPIS collection workflow (shares picking UI)

  Transfer Orders
    └─ requires: Existing StockTransfer models
    └─ can be built independently of BOPIS

  Real-time Inventory Sync
    └─ requires: WebSocket
    └─ requires: Offline SQLite stock columns (to update them on ws events)


Phase 4 — Dependencies on Phase 2 and 3:

  Staff Permissions (RBAC in POS)
    └─ requires: authStore (Phase 2)
    └─ must be built BEFORE: Manager PIN Override, Discount Override, Gift Card
       (those features check permissions)

  Loyalty Program
    └─ requires: Customer Profiles (Phase 2)
    └─ requires: Configurable Tax (to calculate earn on discounted amounts)
    └─ must exist before: Loyalty Redemption in Payment Modal

  Gift Cards
    └─ requires: Staff Permissions (create/sell permissions)
    └─ can be built in parallel with Loyalty

  Multi-Currency
    └─ requires: Configurable Tax (tax rate may vary by currency/country)
    └─ can be built independently of Loyalty/Gift Cards

  Product Bundles
    └─ requires: existing BundleSku model
    └─ requires: Sale creation endpoint (must handle bundle explosion)

  Custom Sale (Ad-hoc Items)
    └─ requires: sale creation endpoint that accepts null variationId
    └─ requires: Configurable Tax (to apply default tax rate)

  Layaway
    └─ requires: Customer Profiles (layaway requires a customer)
    └─ requires: Stock reservation mechanism (server-side)

  Cash Management (safe drops, pay-ins/outs)
    └─ requires: POSRegisterSession (Phase 1 — already built)
    └─ requires: POSCashMovements table (Phase 1 scaffold — may be partially built)

  Dashboard and Analytics
    └─ requires: Z-Report data structure (Phase 2)
    └─ requires: POSSales with staffId, paymentBreakdown (Phase 1)
    └─ can display partial data if Loyalty/Gift Cards not yet built

  Barcode Label Printing
    └─ requires: Existing PrintJob model on server
    └─ can be built independently


Phase 5 — Dependencies on Phase 4:

  Accounting Integration
    └─ requires: Z-Report (Phase 2) — accounting sync is based on Z-report totals
    └─ requires: Gift Card Liability data (Phase 4)
    └─ requires: Multi-Currency amounts (Phase 4, if used)

  Email Marketing Integration
    └─ requires: Customer Profiles with marketingOptIn flag (Phase 2)
    └─ requires: Loyalty tiers for segmentation (Phase 4)
    └─ can be built independently of Accounting

  Webhook Events
    └─ requires: all event-generating features to exist:
        pos.sale.completed → Phase 1 sale creation
        pos.refund.processed → Phase 2 refunds
        pos.collection.ready → Phase 3 BOPIS
        pos.gift_card.sold → Phase 4 Gift Cards
    └─ the webhook infrastructure (endpoint CRUD + delivery) can be built in Phase 4
       even though not all events exist yet; new event types are added as features ship
```

### 11.3 Recommended Build Order (within each phase)

**Phase 2 (sprint order):**
1. Configurable Tax Rates (unblocks everything else)
2. Line-item Discounts (cartStore extension + UI)
3. Partial Refunds and Exchanges
4. Receipt Printing (ESC/POS) + Email Receipts
5. Full Customer Profiles
6. Z-Report
7. Offline Mode (SQLite + Sync Engine + Queue)

**Phase 3 (sprint order):**
1. WebSocket connection (main process)
2. Real-time Inventory Sync
3. Transfer Orders (uses existing stock transfer API)
4. BOPIS / Click & Collect
5. Ship from Store

**Phase 4 (sprint order):**
1. Staff Permissions (RBAC) + Manager PIN Override
2. Custom Sale / Ad-hoc Items
3. Product Bundles
4. Cash Management (safe drops, pay-ins/outs)
5. Gift Cards
6. Loyalty Program
7. Layaway / Deposits
8. Multi-Currency
9. Dashboard and Analytics
10. Barcode Label Printing
11. Customer Display (second window)

**Phase 5 (sprint order):**
1. Webhook Infrastructure (endpoint CRUD + delivery engine)
2. Wire webhook events to all Phase 1–4 features
3. Accounting Integration (Xero first, QuickBooks second)
4. Email Marketing Integration

---

## Appendix A: New npm Packages Required

| Package | Purpose | Process |
|---------|---------|---------|
| `better-sqlite3` | Local SQLite database | Main |
| `@types/better-sqlite3` | TypeScript types | Dev |
| `escpos` | ESC/POS receipt printer | Main |
| `escpos-network` | Network printer adapter | Main |
| `escpos-usb` | USB printer adapter | Main |
| `@stripe/terminal-js` | Stripe Terminal SDK | Main |
| `ws` | WebSocket client | Main |
| `@types/ws` | TypeScript types | Dev |
| `html-pdf-node` or `puppeteer` | PDF generation for Z-reports | Main |
| `uuid` or built-in `crypto.randomUUID` | UUID for offline localId | Renderer |
| `react-router-dom` | Already installed | Renderer |
| `date-fns` | Date formatting, no heavy moment.js | Renderer |
| `recharts` | Dashboard charts (lightweight) | Renderer |

**Do not add:**
- `lodash` — use native ES2024 equivalents
- `moment` — use `date-fns`
- Any jQuery or DOM manipulation library
- `electron-store` for the local DB — use `better-sqlite3` directly for structured data; use `safeStorage` for secrets

---

## Appendix B: Environment Configuration

Add to `.env` (and update `.env.example`):

```
# API
VITE_API_URL=https://api.combosoft.io
VITE_WS_URL=wss://api.combosoft.io

# Stripe Terminal
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Feature flags (set to 'false' to disable a feature without removing code)
VITE_FEATURE_LOYALTY=true
VITE_FEATURE_GIFT_CARDS=true
VITE_FEATURE_MULTI_CURRENCY=false
VITE_FEATURE_CUSTOMER_DISPLAY=true
VITE_FEATURE_OFFLINE_MODE=true
```

---

*Document version: 1.0 — 2026-04-22*
*Next review: when Phase 2 implementation begins — validate API contracts against actual backend implementation*
