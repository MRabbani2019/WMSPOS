# Combosoft POS System — Full Scaffold Document

> **Date:** 2026-03-19
> **Scope:** Desktop POS frontend (Electron + React) + Backend API extensions
> **Core Advantage:** WMS-native backend — only ERPLY among the top 10 competitors offers this

---

## Table of Contents

1. [Existing Backend Inventory](#1-existing-backend-inventory)
2. [Gap Analysis: What Exists vs What's Needed](#2-gap-analysis)
3. [New Backend APIs to Build](#3-new-backend-apis-to-build)
4. [New Database Models Required](#4-new-database-models-required)
5. [Desktop App Architecture](#5-desktop-app-architecture)
6. [Desktop App Module Breakdown](#6-desktop-app-module-breakdown)
7. [Hardware Integration Layer](#7-hardware-integration-layer)
8. [Offline-First Strategy](#8-offline-first-strategy)
9. [Build Sequence (Phased Delivery)](#9-build-sequence)
10. [API Contract Drafts](#10-api-contract-drafts)

---

## 1. Existing Backend Inventory

### 1.1 Models We Already Have (94 total)

| Domain | Models | POS Relevant? |
|--------|--------|---------------|
| **Auth & Users** | Client, User, UserRole, Roles, Permission, RolePermission, RoleAction, RoleActionValue, Module, ModulePermission, SubModule, ClientModule, ClientSubModule, Section, Action | ✅ YES — staff login, permissions |
| **Products** | Catalogue, Variation, BundleSku, Attribute, AttributeTerms, CatalogueChannel, CatalogueSpecificationTerm, DropShippingCatalogue | ✅ YES — product lookup, bundles |
| **Categorization** | Categorization, CategorizationData, ItemSpecification, ItemSpecificationTerm, ItemSpecificationTermValue, CategoryItemSpecification, ItemSpecificationProfile, ItemSpecificationProfileTerm, SpecificationMapping | ✅ YES — product filtering |
| **Inventory** | WareHouse, Shelf, ShelfProduct, ReshelfProduct, ShelfQuantityChangeLog, StockActivityLog | ✅ YES — stock levels, adjustments |
| **Stock Transfers** | StockTransfer, StockTransferItem | ✅ YES — inter-store transfers |
| **Orders** | Order, OrderProduct, OrderActivity, OrderShipping, OrderDropshipping | ⚠️ PARTIAL — online orders only, no POS sale concept |
| **Customers** | Customer, CustomerAccount, CustomerServiceToken | ✅ YES — customer lookup, B2B accounts |
| **Returns** | ReturnRequest, ReturnReason, CancelledReason | ✅ YES — returns/exchanges |
| **Suppliers** | Supplier, PurchaseOrder, PurchaseOrderItem, Invoice, InvoiceProduct | ✅ YES — PO management |
| **Shipping** | ShippingService, ShippingProfile, ShippingRule, ShippingPostcode, ShippingRulesPostcodes, ChannelShippingCarrier, PackageType, PackageProfile, DpdAccount, MiscDispatch | ⚠️ PARTIAL — ship-from-store possible |
| **Pricing** | PriceTier, PriceTierProduct | ✅ YES — B2B/wholesale pricing |
| **Defects** | DefectedProduct, DefectedProductReason, DefectedProductAction | ✅ YES — damaged stock |
| **Customer Service** | Conversation, Message, CSModuleSetting, EmailTemplate, ZohoAutoReply, CircleLoopSetting, CallLog | ❌ NOT NEEDED for POS |
| **Notifications** | ClientNotification | ✅ YES — alerts |
| **Printing** | PrintJob | ✅ YES — label printing |
| **Channels** | Channel, AllAccount | ⚠️ PARTIAL — need "POS" as a channel |
| **Config** | WmsSetting, Country, BatchNumber, BusinessSetting, DatabaseBackup | ✅ YES — settings |
| **Subscription** | Subscription, SubscriptionPackage | ❌ NOT for POS (SaaS billing) |
| **Dropship** | Dropship | ❌ NOT for POS |
| **Content** | Blog, KnowledgeHub, ContactUs | ❌ NOT for POS |

### 1.2 API Endpoints We Already Have (500+)

#### Directly Usable by POS (No Changes Needed)

| API Group | Key Endpoints | POS Use Case |
|-----------|--------------|--------------|
| **Auth** | `POST /client/login`, `POST /client/verify-token` | Staff login to POS terminal |
| **Product Search** | `GET /client/catalogue/`, `GET /client/variation/` | Product lookup at checkout |
| **Product by SKU/Barcode** | `POST /api/mobile-app/get-product-details-by-sku-ean-id` | Barcode scan → product details |
| **Stock Levels** | `GET /client/shelf-product/`, `GET /client/variation/:id` | Real-time stock check |
| **Stock Adjustment** | `POST /client/shelf-quantity-change-log/create` | Manual stock corrections |
| **Stock Reduction** | `POST /api/mobile-app/stock-reduction` | Quick stock reduction |
| **Customer Search** | `POST /api/mobile-app/search-customers` | Find customer at checkout |
| **Customer Accounts** | `GET /client/customer-account/index` | B2B account lookup, credit limits |
| **Address Lookup** | `POST /api/mobile-app/lookup-address` | Postcode lookup for new customers |
| **Categories** | `GET /api/mobile-app/categories` | Product category browsing |
| **Price Tiers** | `GET /client/price-tier/index`, `GET /client/price-tier/:id` | B2B/wholesale pricing |
| **Purchase Orders** | Full CRUD at `/client/purchase-order/*` | Receive stock at store |
| **Stock Transfers** | Full CRUD at `/client/stock-transfer/*` | Inter-store transfer management |
| **Suppliers** | Full CRUD at `/client/supplier/*` | Supplier management |
| **Warehouses** | `GET /client/ware-house/index`, CRUD | Store/location management |
| **Shelves** | Full CRUD at `/client/shelf/*` | Storage location management |
| **Defects** | `POST /client/defected-product/create` | Mark damaged stock |
| **Printing** | `POST /client/printer/queue/create`, `GET /client/printer/queue/pending` | Receipt & label printing |
| **Print SKU Label** | `POST /api/mobile-app/print-sku-label` | Barcode label printing |
| **Roles & Permissions** | `GET /client/role/*`, `GET /client/permission/` | Staff access control |
| **Settings** | `GET /client/wms-setting/get` | POS configuration |
| **Notifications** | `GET /client/notification/unread` | Real-time alerts |
| **Countries** | `GET /client/country/all` | Address forms |
| **Dashboard KPIs** | `GET /client/dashboard/kpi-summary`, `GET /client/dashboard/top-products` | Sales overview |
| **Reports** | `GET /client/reports/profitability/*`, `GET /client/reports/stock-aging` | End-of-day analytics |
| **Attributes** | `GET /client/attribute/`, `GET /client/attribute/:id/terms` | Product variants |
| **Categorization Data** | `GET /client/categorization-data/` | Brand, department, category |

#### Need Modification / Extension

| API Group | Current State | What Needs Changing |
|-----------|--------------|-------------------|
| **Orders** | Designed for online/channel orders with `createdVia` channel mapping | Need to support `createdVia: 'pos'` with POS-specific fields (terminal, staff, payment split) |
| **Order Creation** | Created via channel sync (eBay, WooCommerce, manual) | Need a dedicated POS sale creation endpoint (faster, handles payment + stock in one transaction) |
| **Customer Creation** | Basic customer record tied to orders | Need quick in-line customer creation during POS sale (minimal fields) |
| **Warehouse** | Generic warehouse model | Need to distinguish "retail store" vs "warehouse" (add `type` field) |
| **Returns** | Customer self-service portal flow (token-based) | Need staff-initiated return/exchange flow at POS counter |
| **Shipping** | Designed for dispatch from warehouse | Need ship-from-store capability flagging |
| **Dashboard** | Generic KPIs for whole business | Need POS-specific dashboard (today's sales, hourly breakdown, per-terminal) |
| **Reports** | Business-level profitability/stock reports | Need POS-specific: X-report, Z-report, cash-up, per-staff sales |
| **Printing** | SKU labels + shipping labels | Need receipt template rendering (ESC/POS format) |

---

## 2. Gap Analysis

### 2.1 What Already Exists & Can Be Reused ✅

```
✅ Staff authentication (login, verify token, roles, permissions)
✅ Product catalogue (search, variants, bundles, images)
✅ Barcode/SKU lookup (mobile app API)
✅ Real-time stock levels per warehouse/shelf
✅ Stock adjustments & activity logging
✅ Stock transfers between locations
✅ Customer records & search
✅ Customer accounts (B2B, credit limits, payment terms)
✅ Price tiers (wholesale/trade pricing)
✅ Purchase orders (create → receive workflow)
✅ Supplier management
✅ Warehouse & shelf management
✅ Defect management
✅ Categorization (brands, departments, categories, conditions)
✅ Shipping services & carrier integration (Royal Mail, DPD)
✅ Print job queue (label printing)
✅ Notification system
✅ Dashboard KPIs & business reports
✅ Role-based access control (granular permissions)
✅ Multi-tenant architecture (clientId isolation)
✅ Return request handling (partial — needs POS adaptation)
```

### 2.2 What's Completely Missing ❌

```
❌ POS Transaction / Sale model (not the same as Order)
❌ POS Register / Terminal model
❌ Till / Cash drawer session tracking
❌ Payment processing (card terminal integration)
❌ Split payment handling
❌ Cash management (float, cash-in, cash-out)
❌ Gift card system (create, sell, redeem, balance check)
❌ Loyalty program (points, tiers, earn/redeem rules)
❌ Employee time clock (shift start/end, breaks)
❌ POS-specific receipts (format, template, reprint)
❌ Layaway / deposit tracking
❌ Park/hold transaction & recall
❌ End-of-day cash-up / till reconciliation
❌ X-Report and Z-Report generation
❌ Per-terminal sales tracking
❌ Click & Collect status workflow (Ordered → Ready → Collected)
❌ Customer-facing display content API
❌ Self-checkout kiosk mode
❌ Offline transaction sync & conflict resolution
❌ Store-specific promotions / discounts engine
❌ Sales commission rules & tracking
❌ Employee scheduling
❌ Smart fulfillment routing (online → nearest store)
❌ AI demand forecasting
❌ AI conversational insights
❌ Remote terminal management
❌ OTA update distribution
```

### 2.3 What Needs Extending ⚠️

```
⚠️ Order model → add POS-specific fields (terminalId, staffId, paymentDetails JSONB)
⚠️ Warehouse model → add `type` field (warehouse vs retail_store) + store address/phone
⚠️ Customer model → quick-create for walk-in (fewer required fields)
⚠️ Return flow → staff-initiated at POS counter (not customer self-service portal)
⚠️ Dashboard → POS-specific metrics (today, hourly, per-register)
⚠️ Reports → X-report, Z-report, till reconciliation, staff performance
⚠️ Print system → receipt templates (ESC/POS thermal format)
⚠️ Channel → add "POS" as a sales channel
⚠️ Notification → real-time WebSocket push to POS terminals
⚠️ Stock reduction → atomic decrement during sale (prevent oversell)
```

---

## 3. New Backend APIs to Build

### 3.1 POS Core — Sales & Transactions

```
POST   /client/pos/sale/create              → Create POS sale (atomic: payment + stock decrement + receipt)
GET    /client/pos/sale/:id                 → Get sale details
GET    /client/pos/sale/                    → List sales (filtered by terminal, date, staff)
POST   /client/pos/sale/:id/void           → Void entire sale
POST   /client/pos/sale/:id/refund         → Process refund (full or partial, to original payment method)
POST   /client/pos/sale/:id/exchange        → Process exchange (return + new sale in one transaction)
POST   /client/pos/sale/:id/receipt         → Regenerate/reprint receipt data
GET    /client/pos/sale/:id/receipt/data    → Get receipt template data (for thermal printer)

POST   /client/pos/hold/create              → Park/hold current cart
GET    /client/pos/hold/                    → List held transactions
GET    /client/pos/hold/:id                 → Recall held transaction
DELETE /client/pos/hold/:id                 → Delete held transaction

POST   /client/pos/layaway/create           → Create layaway (partial payment, hold item)
GET    /client/pos/layaway/                 → List layaways
GET    /client/pos/layaway/:id              → Get layaway details
POST   /client/pos/layaway/:id/payment      → Add payment to layaway
POST   /client/pos/layaway/:id/complete     → Complete layaway (final payment)
POST   /client/pos/layaway/:id/cancel       → Cancel layaway (trigger refund)
```

### 3.2 Register & Till Management

```
POST   /client/pos/register/open            → Open register (set float amount, start session)
POST   /client/pos/register/close           → Close register (cash-up, generate Z-report)
GET    /client/pos/register/active          → Get active register session for current terminal
GET    /client/pos/register/sessions        → List register sessions (history)
GET    /client/pos/register/session/:id     → Get session details with totals

POST   /client/pos/register/cash-in         → Record cash added to till (e.g. extra float)
POST   /client/pos/register/cash-out        → Record cash removed from till (e.g. bank run)
GET    /client/pos/register/cash-movements  → List cash-in/cash-out for session

GET    /client/pos/register/x-report        → X-Report (mid-day snapshot, does NOT close register)
GET    /client/pos/register/z-report/:sessionId → Z-Report (end-of-day final, tied to closed session)
```

### 3.3 Terminal Management

```
POST   /client/pos/terminal/register        → Register a new POS terminal (name, store, hardware ID)
GET    /client/pos/terminal/                → List terminals
GET    /client/pos/terminal/:id             → Get terminal details
PUT    /client/pos/terminal/:id             → Update terminal settings
DELETE /client/pos/terminal/:id             → Deactivate terminal
GET    /client/pos/terminal/:id/status      → Get terminal health/status (for remote monitoring)
POST   /client/pos/terminal/:id/command     → Send command to terminal (restart, update, message)
```

### 3.4 Payment Processing

```
POST   /client/pos/payment/process-card     → Initiate card payment via terminal SDK
POST   /client/pos/payment/process-cash     → Record cash payment + calculate change
POST   /client/pos/payment/split            → Split payment across methods (card + cash + gift card)
POST   /client/pos/payment/refund-card      → Refund to card via terminal SDK
GET    /client/pos/payment/methods          → List enabled payment methods for store

POST   /client/pos/payment/card-terminal/pair    → Pair card reader with POS terminal
GET    /client/pos/payment/card-terminal/status  → Card terminal connection status
```

### 3.5 Gift Cards

```
POST   /client/pos/gift-card/create         → Create & activate gift card (generate code, set value)
POST   /client/pos/gift-card/sell           → Sell gift card (included in POS sale)
GET    /client/pos/gift-card/balance/:code  → Check gift card balance
POST   /client/pos/gift-card/redeem         → Redeem gift card (partial or full)
POST   /client/pos/gift-card/top-up         → Add value to existing gift card
GET    /client/pos/gift-card/history/:code  → Transaction history for a gift card
GET    /client/pos/gift-card/               → List all gift cards (admin)
```

### 3.6 Loyalty Program

```
POST   /client/pos/loyalty/config           → Configure loyalty program (points per £, tiers, rules)
GET    /client/pos/loyalty/config            → Get loyalty configuration
GET    /client/pos/loyalty/customer/:customerId → Get customer loyalty status (points, tier)
POST   /client/pos/loyalty/earn             → Award points for a sale
POST   /client/pos/loyalty/redeem           → Redeem points as discount
GET    /client/pos/loyalty/history/:customerId → Points history
GET    /client/pos/loyalty/tiers            → List loyalty tiers
POST   /client/pos/loyalty/tiers            → Create/update tier
```

### 3.7 Click & Collect (BOPIS)

```
GET    /client/pos/collection/pending        → List orders ready for collection at this store
GET    /client/pos/collection/:orderId       → Get collection order details
POST   /client/pos/collection/:orderId/ready → Mark order as ready for collection (trigger notification)
POST   /client/pos/collection/:orderId/collect → Mark order as collected (customer picked up)
POST   /client/pos/collection/:orderId/partial → Partial collection (some items unavailable)
POST   /client/pos/collection/:orderId/cancel → Cancel collection (trigger refund/re-route)
GET    /client/pos/collection/stats          → Collection stats (avg wait time, completion rate)
```

### 3.8 Employee Time Clock

```
POST   /client/pos/time-clock/clock-in      → Staff clock in (PIN or fingerprint)
POST   /client/pos/time-clock/clock-out     → Staff clock out
POST   /client/pos/time-clock/break-start   → Start break
POST   /client/pos/time-clock/break-end     → End break
GET    /client/pos/time-clock/active         → Get active clock-ins for store
GET    /client/pos/time-clock/log            → Time clock history (per staff, per date range)
GET    /client/pos/time-clock/summary        → Hours summary (per staff, period)
```

### 3.9 Promotions & Discounts Engine

```
POST   /client/pos/promotion/create          → Create promotion rule
GET    /client/pos/promotion/                → List active promotions
GET    /client/pos/promotion/:id             → Get promotion details
PUT    /client/pos/promotion/:id             → Update promotion
DELETE /client/pos/promotion/:id             → Delete promotion
POST   /client/pos/promotion/evaluate-cart   → Evaluate cart against all active promotions (returns applicable discounts)
GET    /client/pos/promotion/store/:storeId  → Get store-specific promotions

Promotion types supported:
  - Percentage discount (10% off)
  - Fixed amount discount (£5 off)
  - Buy X get Y free (BOGOF)
  - Buy X get Y at Z% off
  - Bundle discount (buy set for £X)
  - Minimum spend threshold (spend £50 get 10% off)
  - Category/brand-level discount
  - Time-limited flash sale
  - Staff discount
  - Loyalty tier discount
```

### 3.10 Sales Commission

```
POST   /client/pos/commission/rule           → Create commission rule (per staff, per category, per tier)
GET    /client/pos/commission/rules          → List commission rules
PUT    /client/pos/commission/rule/:id       → Update rule
DELETE /client/pos/commission/rule/:id       → Delete rule
GET    /client/pos/commission/calculate/:saleId → Calculate commission for a sale
GET    /client/pos/commission/report         → Commission report (per staff, per period)
```

### 3.11 POS-Specific Reports

```
GET    /client/pos/reports/daily-summary     → Today's sales summary (total, count, avg, by method)
GET    /client/pos/reports/hourly-breakdown  → Sales by hour (for staffing decisions)
GET    /client/pos/reports/staff-performance → Sales per staff member
GET    /client/pos/reports/product-performance → Best/worst sellers for period
GET    /client/pos/reports/category-breakdown → Sales by category/brand/department
GET    /client/pos/reports/payment-methods   → Breakdown by payment method
GET    /client/pos/reports/returns-summary   → Return rate, reasons, value
GET    /client/pos/reports/store-comparison  → Compare stores side-by-side
GET    /client/pos/reports/customer-insights → New vs returning, avg basket, lifetime value
GET    /client/pos/reports/gift-card-liability → Outstanding gift card balance (financial liability)
GET    /client/pos/reports/loyalty-impact    → Loyalty member vs non-member spending
GET    /client/pos/reports/commission-summary → Commission payable per staff
GET    /client/pos/reports/collection-performance → Click & collect metrics
POST   /client/pos/reports/schedule          → Schedule automated report email
GET    /client/pos/reports/scheduled         → List scheduled reports
DELETE /client/pos/reports/scheduled/:id     → Delete scheduled report
```

### 3.12 Customer-Facing Display

```
GET    /client/pos/display/cart              → Real-time cart data for customer screen
GET    /client/pos/display/idle              → Idle screen content (promotions, branding)
PUT    /client/pos/display/settings          → Configure display settings (logo, colours, promo images)
GET    /client/pos/display/settings          → Get display settings
```

### 3.13 Offline Sync

```
POST   /client/pos/sync/push                → Push batch of offline transactions to server
GET    /client/pos/sync/pull/catalogue       → Pull latest product catalogue (delta sync, since timestamp)
GET    /client/pos/sync/pull/customers       → Pull customer data (delta sync)
GET    /client/pos/sync/pull/promotions      → Pull active promotions
GET    /client/pos/sync/pull/config          → Pull POS configuration
GET    /client/pos/sync/status               → Check sync health (last sync time, pending count)
POST   /client/pos/sync/resolve-conflict     → Manually resolve a sync conflict
GET    /client/pos/sync/conflicts            → List unresolved conflicts
```

### 3.14 Store Management (extend Warehouse)

```
PUT    /client/ware-house/:id/store-config   → Set store-specific config (tax, currency, opening hours)
GET    /client/ware-house/:id/store-config   → Get store config
PUT    /client/ware-house/:id/store-branding → Set store branding (receipt logo, display themes)
GET    /client/ware-house/:id/store-branding → Get store branding
```

---

## 4. New Database Models Required

### 4.1 POS Sale (POSSale)

```
Table: POSSales

id              BIGINT (PK, auto-increment)
clientId        INTEGER (FK → Clients)
orderId         BIGINT (FK → Orders, nullable — linked after sync)
terminalId      INTEGER (FK → POSTerminals)
registerId      INTEGER (FK → POSRegisterSessions)
staffId         INTEGER (FK → Users)
customerId      INTEGER (FK → Customers, nullable — walk-in = null)

saleNumber      STRING (unique per client, e.g. "POS-00001")
saleDate        DATE
saleTime        TIME
status          ENUM ('completed', 'voided', 'refunded', 'partial_refund', 'parked', 'layaway')

subtotal        DECIMAL(10,2)
discountTotal   DECIMAL(10,2)
taxTotal        DECIMAL(10,2)
grandTotal      DECIMAL(10,2)

paymentMethod   STRING ('cash', 'card', 'gift_card', 'split', 'account')
paymentDetails  JSONB ({
                  payments: [
                    { method: 'cash', amount: 20.00, tendered: 50.00, change: 30.00 },
                    { method: 'card', amount: 15.00, reference: 'TXN123', cardType: 'visa', lastFour: '4242' },
                    { method: 'gift_card', amount: 5.00, cardCode: 'GC-XXXX', remainingBalance: 10.00 }
                  ]
                })

loyaltyPointsEarned    INTEGER (default: 0)
loyaltyPointsRedeemed  INTEGER (default: 0)
loyaltyDiscountAmount  DECIMAL(10,2) (default: 0)

notes           TEXT (nullable)
receiptPrinted  BOOLEAN (default: false)
isOfflineSale   BOOLEAN (default: false)  — flag if created while offline
offlineSyncedAt DATETIME (nullable)       — when it was synced

promotionId     INTEGER (FK → POSPromotions, nullable)
promotionDetails JSONB (snapshot of applied promotions)

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.2 POS Sale Item (POSSaleItem)

```
Table: POSSaleItems

id              BIGINT (PK)
clientId        INTEGER (FK → Clients)
saleId          BIGINT (FK → POSSales)
variationId     BIGINT (FK → Variations)
shelfId         INTEGER (FK → Shelfs, nullable — which shelf stock was decremented from)

name            STRING (snapshot — product name at time of sale)
sku             STRING (snapshot)
quantity        INTEGER
unitPrice       DECIMAL(10,2) (snapshot — price before discount)
discount        DECIMAL(10,2) (line-level discount)
tax             DECIMAL(10,2)
lineTotal       DECIMAL(10,2)

isRefunded      BOOLEAN (default: false)
refundedQuantity INTEGER (default: 0)
refundReason    STRING (nullable)

serialNumber    STRING (nullable — for serialized items)

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.3 POS Terminal (POSTerminal)

```
Table: POSTerminals

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
warehouseId     INTEGER (FK → WareHouses — which store this terminal is in)

name            STRING ('Till 1', 'Self-Checkout 1')
hardwareId      STRING (unique machine identifier)
type            ENUM ('standard', 'self_checkout', 'mobile')
status          ENUM ('active', 'inactive', 'maintenance')

lastHeartbeat   DATETIME (nullable)
appVersion      STRING (nullable)
osVersion       STRING (nullable)
ipAddress       STRING (nullable)

settings        JSONB ({
                  receiptPrinter: { name: 'Epson TM-T88VI', ip: '192.168.1.100', port: 9100 },
                  cashDrawer: { connected: true, kickCommand: 'printer' },
                  cardTerminal: { provider: 'stripe', terminalId: 'tmr_xxx' },
                  customerDisplay: { enabled: true, type: 'dual_monitor' },
                  barcodeScanner: { type: 'usb_hid' },
                  labelPrinter: { name: 'Zebra ZD420', ip: '192.168.1.101' }
                })

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.4 POS Register Session (POSRegisterSession)

```
Table: POSRegisterSessions

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
terminalId      INTEGER (FK → POSTerminals)
openedBy        INTEGER (FK → Users)
closedBy        INTEGER (FK → Users, nullable)

openedAt        DATETIME
closedAt        DATETIME (nullable)
status          ENUM ('open', 'closed')

openingFloat    DECIMAL(10,2)   — cash in drawer at start
closingCash     DECIMAL(10,2)   — actual cash counted at close (nullable)
expectedCash    DECIMAL(10,2)   — system-calculated expected cash (nullable)
cashDifference  DECIMAL(10,2)   — closingCash - expectedCash (nullable)

totalSales      DECIMAL(10,2) (default: 0)
totalRefunds    DECIMAL(10,2) (default: 0)
totalCashIn     DECIMAL(10,2) (default: 0)   — extra cash added during shift
totalCashOut    DECIMAL(10,2) (default: 0)   — cash removed during shift
transactionCount INTEGER (default: 0)
refundCount     INTEGER (default: 0)

paymentBreakdown JSONB ({
                   cash: 450.00,
                   card_visa: 320.00,
                   card_mastercard: 180.00,
                   gift_card: 50.00,
                   account: 200.00
                 })

notes           TEXT (nullable)
zReportGenerated BOOLEAN (default: false)

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.5 Cash Movement (POSCashMovement)

```
Table: POSCashMovements

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
sessionId       INTEGER (FK → POSRegisterSessions)
userId          INTEGER (FK → Users)

type            ENUM ('cash_in', 'cash_out')
amount          DECIMAL(10,2)
reason          STRING
reference       STRING (nullable)

createdAt       DATETIME
updatedAt       DATETIME
```

### 4.6 Held Transaction (POSHeldTransaction)

```
Table: POSHeldTransactions

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
terminalId      INTEGER (FK → POSTerminals)
staffId         INTEGER (FK → Users)
customerId      INTEGER (FK → Customers, nullable)

cartData        JSONB ({
                  items: [{ variationId, name, sku, qty, unitPrice, discount }],
                  subtotal, discountTotal, taxTotal, grandTotal,
                  note: 'Customer coming back in 30 mins'
                })
status          ENUM ('held', 'recalled', 'expired')
expiresAt       DATETIME (auto-expire after configurable hours)

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.7 Layaway (POSLayaway)

```
Table: POSLayaways

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
terminalId      INTEGER (FK → POSTerminals)
staffId         INTEGER (FK → Users)
customerId      INTEGER (FK → Customers, required)

layawayNumber   STRING (unique per client)
status          ENUM ('active', 'completed', 'cancelled', 'expired')

items           JSONB (same structure as held transaction items — with stock reserved)
totalAmount     DECIMAL(10,2)
paidAmount      DECIMAL(10,2) (default: 0)
remainingAmount DECIMAL(10,2)
dueDate         DATE (nullable)

payments        JSONB ([
                  { date, amount, method, reference, staffId },
                  ...
                ])

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.8 Gift Card (POSGiftCard)

```
Table: POSGiftCards

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)

code            STRING (unique, generated — e.g. 'GC-XXXX-XXXX-XXXX')
barcode         STRING (unique, for physical card scanning)
type            ENUM ('physical', 'digital')
status          ENUM ('active', 'redeemed', 'expired', 'disabled')

initialValue    DECIMAL(10,2)
currentBalance  DECIMAL(10,2)
currency        STRING (default: 'GBP')

issuedBy        INTEGER (FK → Users, nullable)
issuedAt        DATETIME
expiresAt       DATETIME (nullable)

customerId      INTEGER (FK → Customers, nullable — if issued to specific customer)
recipientEmail  STRING (nullable — for digital gift cards)
recipientName   STRING (nullable)
message         STRING (nullable — personal message)

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.9 Gift Card Transaction (POSGiftCardTransaction)

```
Table: POSGiftCardTransactions

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
giftCardId      INTEGER (FK → POSGiftCards)
saleId          BIGINT (FK → POSSales, nullable)

type            ENUM ('activation', 'redemption', 'top_up', 'refund', 'expiry')
amount          DECIMAL(10,2)
balanceBefore   DECIMAL(10,2)
balanceAfter    DECIMAL(10,2)

processedBy     INTEGER (FK → Users)
terminalId      INTEGER (FK → POSTerminals, nullable)

createdAt       DATETIME
```

### 4.10 Loyalty Program (POSLoyaltyConfig)

```
Table: POSLoyaltyConfigs

id              INTEGER (PK)
clientId        INTEGER (FK → Clients, unique)

isEnabled       BOOLEAN (default: false)
programName     STRING (default: 'Rewards')
pointsPerPound  INTEGER (default: 1 — earn 1 point per £1 spent)
pointValue      DECIMAL(6,4) (default: 0.01 — each point worth £0.01)
minimumRedeem   INTEGER (default: 100 — minimum points to redeem)
roundingRule    ENUM ('floor', 'round', 'ceil') (default: 'floor')
earnOnDiscounted BOOLEAN (default: true — earn points on discounted items?)

excludedCategories JSONB ([] — category IDs that don't earn points)
bonusRules      JSONB ([
                  { type: 'double_points', dayOfWeek: 'tuesday' },
                  { type: 'bonus_points', categoryId: 5, multiplier: 2 },
                  { type: 'birthday_bonus', points: 500 }
                ])

createdAt       DATETIME
updatedAt       DATETIME
```

### 4.11 Loyalty Tier (POSLoyaltyTier)

```
Table: POSLoyaltyTiers

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
loyaltyConfigId INTEGER (FK → POSLoyaltyConfigs)

name            STRING ('Bronze', 'Silver', 'Gold', 'Platinum')
minimumPoints   INTEGER (lifetime points to reach tier)
discountPercent DECIMAL(4,2) (default: 0 — automatic discount for tier members)
pointsMultiplier DECIMAL(4,2) (default: 1.0 — e.g. 1.5 = earn 50% more points)
perks           JSONB (e.g. ['free_shipping', 'early_access', 'birthday_double'])
displayOrder    INTEGER

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.12 Customer Loyalty Account (POSCustomerLoyalty)

```
Table: POSCustomerLoyalties

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
customerId      INTEGER (FK → Customers, unique per client)
tierId          INTEGER (FK → POSLoyaltyTiers, nullable)

currentPoints   INTEGER (default: 0 — redeemable balance)
lifetimePoints  INTEGER (default: 0 — total ever earned, for tier calculation)
lifetimeSpend   DECIMAL(10,2) (default: 0)

memberSince     DATETIME
lastEarnedAt    DATETIME (nullable)
lastRedeemedAt  DATETIME (nullable)
dateOfBirth     DATE (nullable — for birthday bonuses)

createdAt       DATETIME
updatedAt       DATETIME
```

### 4.13 Loyalty Transaction (POSLoyaltyTransaction)

```
Table: POSLoyaltyTransactions

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
customerLoyaltyId INTEGER (FK → POSCustomerLoyalties)
saleId          BIGINT (FK → POSSales, nullable)

type            ENUM ('earn', 'redeem', 'bonus', 'adjustment', 'expire')
points          INTEGER (positive for earn, negative for redeem)
pointsBefore    INTEGER
pointsAfter     INTEGER
description     STRING ('Sale POS-00042', 'Birthday bonus', 'Manual adjustment')

processedBy     INTEGER (FK → Users, nullable)

createdAt       DATETIME
```

### 4.14 Employee Time Clock (POSTimeClock)

```
Table: POSTimeClocks

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
userId          INTEGER (FK → Users)
warehouseId     INTEGER (FK → WareHouses — which store)
terminalId      INTEGER (FK → POSTerminals, nullable)

clockInAt       DATETIME
clockOutAt      DATETIME (nullable)
breakStartAt    DATETIME (nullable)
breakEndAt      DATETIME (nullable)
totalBreakMins  INTEGER (default: 0)
totalWorkedMins INTEGER (nullable — calculated on clock out)

status          ENUM ('clocked_in', 'on_break', 'clocked_out')
notes           STRING (nullable)

createdAt       DATETIME
updatedAt       DATETIME
```

### 4.15 POS Promotion (POSPromotion)

```
Table: POSPromotions

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)

name            STRING
type            ENUM ('percentage', 'fixed_amount', 'bogof', 'buy_x_get_y',
                      'bundle_price', 'min_spend', 'category_discount',
                      'brand_discount', 'time_limited', 'staff_discount',
                      'loyalty_tier', 'quantity_break')
status          ENUM ('active', 'scheduled', 'expired', 'disabled')
priority        INTEGER (default: 0 — higher = applied first when stacking)

conditions      JSONB ({
                  minSpend: 50.00,           — minimum cart value
                  minQuantity: 3,            — minimum item quantity
                  categoryIds: [1, 5],       — applies to these categories only
                  brandIds: [12],            — applies to these brands only
                  variationIds: [101, 102],  — applies to specific products
                  customerType: 'loyalty',   — only for loyalty members
                  loyaltyTierId: 3,          — only for specific tier
                  dayOfWeek: ['saturday', 'sunday'], — weekend only
                  storeIds: [1, 3],          — store-specific
                })

reward          JSONB ({
                  discountPercent: 20,
                  discountAmount: 5.00,
                  freeItemVariationId: 55,
                  freeItemQuantity: 1,
                  bundlePrice: 29.99,
                })

stackable       BOOLEAN (default: false — can combine with other promotions?)
maxUsesTotal    INTEGER (nullable — total redemption limit)
maxUsesPerCustomer INTEGER (nullable)
currentUses     INTEGER (default: 0)

startsAt        DATETIME
endsAt          DATETIME (nullable — null = no end date)

createdBy       INTEGER (FK → Users)

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.16 Sales Commission Rule (POSCommissionRule)

```
Table: POSCommissionRules

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)

name            STRING
type            ENUM ('flat_rate', 'percentage', 'tiered')
scope           ENUM ('all_sales', 'category', 'brand', 'product')
scopeIds        JSONB ([] — category/brand/product IDs if scoped)

rate            DECIMAL(6,2) (flat amount or percentage)
tiers           JSONB ([
                  { minSales: 0, rate: 2 },
                  { minSales: 5000, rate: 3 },
                  { minSales: 10000, rate: 5 }
                ])

appliesTo       ENUM ('all_staff', 'specific_staff', 'specific_role')
staffIds        JSONB ([] — if specific_staff)
roleIds         JSONB ([] — if specific_role)

isActive        BOOLEAN (default: true)

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.17 Sales Commission Log (POSCommissionLog)

```
Table: POSCommissionLogs

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
userId          INTEGER (FK → Users)
saleId          BIGINT (FK → POSSales)
ruleId          INTEGER (FK → POSCommissionRules)

saleAmount      DECIMAL(10,2)
commissionAmount DECIMAL(10,2)
status          ENUM ('pending', 'approved', 'paid')

periodStart     DATE
periodEnd       DATE

createdAt       DATETIME
updatedAt       DATETIME
```

### 4.18 Offline Sync Queue (POSOfflineSyncQueue)

```
Table: POSOfflineSyncQueues

id              BIGINT (PK)
clientId        INTEGER (FK → Clients)
terminalId      INTEGER (FK → POSTerminals)

action          ENUM ('sale', 'refund', 'void', 'stock_adjustment', 'clock_in', 'clock_out')
payload         JSONB (full transaction data)
localId         STRING (UUID generated offline — for deduplication)

status          ENUM ('pending', 'syncing', 'synced', 'conflict', 'failed')
syncAttempts    INTEGER (default: 0)
lastError       TEXT (nullable)
syncedAt        DATETIME (nullable)
conflictDetails JSONB (nullable — what conflicted and why)
resolvedBy      INTEGER (FK → Users, nullable)
resolvedAt      DATETIME (nullable)

createdAt       DATETIME
updatedAt       DATETIME
```

### 4.19 Scheduled Report (POSScheduledReport)

```
Table: POSScheduledReports

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
createdBy       INTEGER (FK → Users)

reportType      STRING ('daily_summary', 'staff_performance', 'product_performance', etc.)
frequency       ENUM ('daily', 'weekly', 'monthly')
dayOfWeek       INTEGER (nullable — 0=Sun for weekly)
dayOfMonth      INTEGER (nullable — for monthly)
timeOfDay       TIME
recipients      JSONB (['email1@example.com', 'email2@example.com'])
filters         JSONB ({ storeId: 1, dateRange: 'last_7_days' })
isActive        BOOLEAN (default: true)

lastSentAt      DATETIME (nullable)

createdAt       DATETIME
updatedAt       DATETIME
deletedAt       DATETIME (paranoid)
```

### 4.20 Customer Display Setting (POSDisplaySetting)

```
Table: POSDisplaySettings

id              INTEGER (PK)
clientId        INTEGER (FK → Clients)
warehouseId     INTEGER (FK → WareHouses — per store)

idleMode        ENUM ('promotions', 'branding', 'slideshow')
logoUrl         STRING (nullable)
brandColour     STRING (default: '#000000')
idleImages      JSONB (['url1', 'url2'])
showItemisedCart BOOLEAN (default: true)
showLoyaltyPoints BOOLEAN (default: true)
thankYouMessage STRING (default: 'Thank you for shopping with us!')
footerText      STRING (nullable)

createdAt       DATETIME
updatedAt       DATETIME
```

---

## 5. Desktop App Architecture

### 5.1 Technology Stack

```
Runtime:        Electron 33+
Frontend:       React 19 + TypeScript
State:          Zustand (lightweight, POS-optimized)
Local DB:       better-sqlite3 (via Electron main process)
Styling:        Tailwind CSS (fast, utility-first)
Build:          Vite + electron-vite
Packaging:      electron-builder (Windows .exe / .msi installer)
Updates:        electron-updater (auto-update from S3/GitHub)
IPC:            Electron contextBridge (secure main↔renderer communication)
```

### 5.2 Process Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ELECTRON MAIN PROCESS (Node.js)                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  SQLite DB    │  │  Hardware    │  │  Sync Engine      │  │
│  │  Manager      │  │  Manager     │  │                   │  │
│  │              │  │              │  │  - Delta pull      │  │
│  │  - Products  │  │  - Printer   │  │  - Offline queue   │  │
│  │  - Offline   │  │  - Scanner   │  │  - Conflict detect │  │
│  │    sales     │  │  - Cash      │  │  - Auto retry      │  │
│  │  - Customers │  │    Drawer    │  │  - Health check    │  │
│  │  - Config    │  │  - Card      │  │                   │  │
│  │              │  │    Terminal  │  │                   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────────┘  │
│         │                 │                  │               │
│         └────────┬────────┴──────────────────┘               │
│                  │ IPC (contextBridge)                        │
├──────────────────┼───────────────────────────────────────────┤
│  RENDERER PROCESS (React)                                    │
│                  │                                           │
│  ┌───────────────▼──────────────────────────────────────┐    │
│  │              Zustand Store                           │    │
│  │  cartStore │ authStore │ catalogStore │ settingStore │    │
│  └───────────────┬──────────────────────────────────────┘    │
│                  │                                           │
│  ┌───────────────▼──────────────────────────────────────┐    │
│  │                    UI Layer                          │    │
│  │                                                      │    │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐  │    │
│  │  │  POS    │ │Collection│ │ Stock  │ │  Reports  │  │    │
│  │  │ Screen  │ │ Orders   │ │ Lookup │ │  & EOD    │  │    │
│  │  └─────────┘ └──────────┘ └────────┘ └───────────┘  │    │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐  │    │
│  │  │Customer │ │  Time    │ │Loyalty │ │  Admin    │  │    │
│  │  │ Mgmt    │ │  Clock   │ │& Gifts │ │ Settings  │  │    │
│  │  └─────────┘ └──────────┘ └────────┘ └───────────┘  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  SECOND WINDOW (Customer-Facing Display)                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Cart items │ Running total │ Promotions │ Branding  │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Project File Structure

```
pos-desktop/
├── electron/
│   ├── main.ts                      # Electron entry point
│   ├── preload.ts                   # Context bridge (secure IPC)
│   ├── windows/
│   │   ├── mainWindow.ts            # Primary POS window
│   │   └── customerDisplay.ts       # Customer-facing 2nd screen
│   ├── db/
│   │   ├── sqlite.ts                # SQLite connection manager
│   │   ├── migrations/              # Local DB schema versions
│   │   ├── repositories/
│   │   │   ├── productRepo.ts       # Local product queries
│   │   │   ├── saleRepo.ts          # Offline sale storage
│   │   │   ├── customerRepo.ts      # Cached customer data
│   │   │   └── configRepo.ts        # Local config store
│   │   └── seed.ts                  # Initial sync seed
│   ├── hardware/
│   │   ├── index.ts                 # Hardware manager (init, status)
│   │   ├── receiptPrinter.ts        # ESC/POS thermal printer
│   │   ├── cashDrawer.ts            # Cash drawer kick (via printer)
│   │   ├── cardTerminal.ts          # Stripe Terminal / SumUp SDK
│   │   ├── barcodeScanner.ts        # USB HID scanner events
│   │   ├── labelPrinter.ts          # ZPL label printing
│   │   └── customerDisplay.ts       # 2nd monitor content push
│   ├── sync/
│   │   ├── syncEngine.ts            # Master sync orchestrator
│   │   ├── catalogueSync.ts         # Pull products (delta)
│   │   ├── customerSync.ts          # Pull customers (delta)
│   │   ├── promotionSync.ts         # Pull active promotions
│   │   ├── configSync.ts            # Pull settings, tax, etc.
│   │   ├── transactionPush.ts       # Push offline sales
│   │   ├── conflictResolver.ts      # Detect + flag conflicts
│   │   └── heartbeat.ts             # Terminal health ping
│   ├── updater/
│   │   └── autoUpdater.ts           # OTA update manager
│   └── utils/
│       ├── logger.ts                # File-based logging
│       ├── receiptFormatter.ts      # Receipt template → ESC/POS
│       └── barcodeGenerator.ts      # Generate barcode images
│
├── src/                             # React renderer
│   ├── App.tsx                      # Root component + routing
│   ├── main.tsx                     # Renderer entry
│   ├── routes.tsx                   # React Router config
│   │
│   ├── pages/
│   │   ├── Login/
│   │   │   ├── LoginPage.tsx        # PIN pad + staff select
│   │   │   └── StoreSelect.tsx      # Store/terminal selection
│   │   │
│   │   ├── POS/                     # Main sales screen
│   │   │   ├── POSPage.tsx          # Full POS layout
│   │   │   ├── Cart.tsx             # Cart panel (right side)
│   │   │   ├── CartItem.tsx         # Individual cart line
│   │   │   ├── ProductGrid.tsx      # Product browse/search (left side)
│   │   │   ├── ProductSearch.tsx    # Search bar + barcode input
│   │   │   ├── CategoryFilter.tsx   # Category/brand/dept tabs
│   │   │   ├── CustomerPanel.tsx    # Attached customer info
│   │   │   ├── DiscountModal.tsx    # Apply line/cart discount
│   │   │   ├── PaymentModal.tsx     # Payment flow (cash/card/split/gift)
│   │   │   ├── CashPayment.tsx      # Cash tendered + change calc
│   │   │   ├── CardPayment.tsx      # Card terminal integration
│   │   │   ├── SplitPayment.tsx     # Multi-method payment
│   │   │   ├── GiftCardPayment.tsx  # Scan + redeem gift card
│   │   │   ├── AccountPayment.tsx   # Charge to customer account
│   │   │   ├── HeldTransactions.tsx # List of parked sales
│   │   │   └── ReceiptPreview.tsx   # Receipt before print
│   │   │
│   │   ├── Collections/            # Click & collect
│   │   │   ├── CollectionsPage.tsx  # Pending collections list
│   │   │   ├── CollectionDetail.tsx # Order details for pickup
│   │   │   └── CollectionScan.tsx   # Scan order ref barcode
│   │   │
│   │   ├── Returns/                # In-store returns
│   │   │   ├── ReturnsPage.tsx      # Return/exchange workflow
│   │   │   ├── OrderLookup.tsx      # Find original sale/order
│   │   │   ├── ReturnItems.tsx      # Select items to return
│   │   │   ├── RefundMethod.tsx     # Refund to original method
│   │   │   └── ExchangeFlow.tsx     # Return + new sale
│   │   │
│   │   ├── Stock/                  # Inventory
│   │   │   ├── StockLookup.tsx      # Search stock across stores
│   │   │   ├── StockAdjust.tsx      # Manual adjustment
│   │   │   ├── StockReceive.tsx     # Receive from PO/transfer
│   │   │   ├── StockTransfer.tsx    # Request inter-store transfer
│   │   │   └── StocktakeMode.tsx    # Full/partial stocktake
│   │   │
│   │   ├── Customers/              # Customer management
│   │   │   ├── CustomerSearch.tsx   # Find customer
│   │   │   ├── CustomerCreate.tsx   # Quick-add new customer
│   │   │   ├── CustomerProfile.tsx  # View profile, history, loyalty
│   │   │   └── CustomerAccounts.tsx # B2B account management
│   │   │
│   │   ├── Loyalty/                # Loyalty & gift cards
│   │   │   ├── LoyaltyDashboard.tsx # Program overview
│   │   │   ├── LoyaltyLookup.tsx    # Check customer points/tier
│   │   │   ├── GiftCardSell.tsx     # Sell new gift card
│   │   │   ├── GiftCardCheck.tsx    # Check balance
│   │   │   └── GiftCardTopUp.tsx    # Top up existing card
│   │   │
│   │   ├── TimeClock/              # Staff time tracking
│   │   │   ├── TimeClockPage.tsx    # Clock in/out interface
│   │   │   ├── ClockInPad.tsx       # PIN entry for clock in
│   │   │   └── ShiftSummary.tsx     # Current shift info
│   │   │
│   │   ├── Reports/                # Reporting
│   │   │   ├── ReportsPage.tsx      # Reports hub
│   │   │   ├── DailySummary.tsx     # Today's sales overview
│   │   │   ├── XReport.tsx          # Mid-day snapshot
│   │   │   ├── ZReport.tsx          # End-of-day final
│   │   │   ├── CashUpPage.tsx       # Till reconciliation
│   │   │   ├── StaffPerformance.tsx # Sales per employee
│   │   │   └── ProductReport.tsx    # Product sales analysis
│   │   │
│   │   ├── Admin/                  # Admin & settings
│   │   │   ├── TerminalSetup.tsx    # Configure this terminal
│   │   │   ├── HardwareTest.tsx     # Test printer, drawer, scanner
│   │   │   ├── PrinterSetup.tsx     # Configure receipt printer
│   │   │   ├── PromotionManager.tsx # Create/edit promotions
│   │   │   ├── CommissionSetup.tsx  # Commission rules
│   │   │   └── DisplaySettings.tsx  # Customer display config
│   │   │
│   │   └── SelfCheckout/           # Self-checkout kiosk mode
│   │       ├── KioskPage.tsx        # Simplified POS for customers
│   │       ├── KioskCart.tsx         # Large-button cart
│   │       ├── KioskPayment.tsx     # Card-only payment
│   │       └── KioskComplete.tsx    # Thank you + receipt option
│   │
│   ├── components/                 # Shared UI components
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── NumPad.tsx           # Numeric keypad for quantities/PIN
│   │   │   ├── Table.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── Spinner.tsx
│   │   ├── StatusBar.tsx            # Top bar: staff, store, online/offline, clock
│   │   ├── SideNav.tsx              # Left navigation
│   │   ├── NetworkIndicator.tsx     # Online/offline badge
│   │   ├── SyncStatus.tsx           # Sync progress indicator
│   │   ├── BarcodeInput.tsx         # Global barcode listener
│   │   └── KeyboardShortcuts.tsx    # Global hotkey handler
│   │
│   ├── hooks/
│   │   ├── useAuth.ts              # Auth state + PIN verify
│   │   ├── useCart.ts              # Cart operations
│   │   ├── useProducts.ts          # Product search (local + remote)
│   │   ├── useCustomer.ts          # Customer lookup
│   │   ├── useHardware.ts          # Printer, drawer, scanner
│   │   ├── useOffline.ts           # Offline detection + queue
│   │   ├── useSync.ts              # Sync status + trigger
│   │   ├── useBarcodeScanner.ts    # Global barcode scan listener
│   │   ├── useKeyboard.ts          # Keyboard shortcuts
│   │   └── useRegister.ts          # Register session state
│   │
│   ├── stores/                     # Zustand stores
│   │   ├── authStore.ts            # Current staff, permissions
│   │   ├── cartStore.ts            # Cart items, totals, discounts
│   │   ├── catalogueStore.ts       # Local product cache
│   │   ├── customerStore.ts        # Selected customer, history
│   │   ├── registerStore.ts        # Register session, float, totals
│   │   ├── settingStore.ts         # Terminal config, tax, store info
│   │   ├── syncStore.ts            # Sync state, last sync times
│   │   └── displayStore.ts         # Customer display content
│   │
│   ├── services/
│   │   ├── api.ts                  # Axios instance + interceptors (auth, retry)
│   │   ├── posApi.ts               # POS-specific API calls
│   │   ├── syncApi.ts              # Sync endpoints
│   │   └── offlineQueue.ts         # Queue management for offline ops
│   │
│   ├── utils/
│   │   ├── formatters.ts           # Currency, date, number formatting
│   │   ├── taxCalculator.ts        # Tax computation logic
│   │   ├── promotionEngine.ts      # Client-side promo evaluation (offline)
│   │   ├── receiptTemplate.ts      # Receipt HTML template
│   │   └── sounds.ts               # Beep for scan, error sound
│   │
│   └── types/
│       ├── pos.ts                  # Sale, SaleItem, Register types
│       ├── product.ts              # Product, Variation types
│       ├── customer.ts             # Customer types
│       ├── payment.ts              # Payment method types
│       ├── loyalty.ts              # Loyalty, GiftCard types
│       └── hardware.ts             # Printer, Scanner config types
│
├── customer-display/               # Separate entry for 2nd screen
│   ├── index.html
│   ├── DisplayApp.tsx              # Customer display React app
│   ├── CartView.tsx                # Live cart items + total
│   ├── IdleScreen.tsx              # Promotions slideshow
│   └── ThankYou.tsx                # Post-sale thank you
│
├── assets/
│   ├── sounds/
│   │   ├── scan-beep.wav
│   │   ├── error.wav
│   │   └── success.wav
│   └── images/
│       └── default-logo.png
│
├── electron-builder.yml            # Build/packaging config
├── vite.config.ts                  # Vite + electron-vite config
├── tsconfig.json
├── package.json
└── .env.example                    # API_URL, STORE_ID, etc.
```

---

## 6. Desktop App Module Breakdown

### 6.1 POS Screen (Main Sales Interface)

**Layout: Split screen — Product search (left 60%) | Cart (right 40%)**

```
┌────────────────────────────────────────┬──────────────────────────┐
│  🔍 Search / Scan barcode...           │  👤 Walk-in Customer  ▼  │
│                                        │                          │
│  [All] [Clothing] [Electronics] [...]  │  ┌──────────────────────┐│
│                                        │  │ Nike Air Max 90      ││
│  ┌─────────┐  ┌─────────┐  ┌────────┐ │  │ SKU: NKE-AM90-BK-42  ││
│  │ Product │  │ Product │  │Product │ │  │ 1 × £129.99   £129.99││
│  │  Image  │  │  Image  │  │ Image  │ │  ├──────────────────────┤│
│  │ £29.99  │  │ £49.99  │  │ £15.00 │ │  │ Levi's 501 Jeans     ││
│  │ Stock:12│  │ Stock:5 │  │Stock:30│ │  │ SKU: LEV-501-BL-32   ││
│  └─────────┘  └─────────┘  └────────┘ │  │ 2 × £89.99    £179.98││
│                                        │  └──────────────────────┘│
│  ┌─────────┐  ┌─────────┐  ┌────────┐ │                          │
│  │         │  │         │  │        │ │  Subtotal:       £309.97 │
│  │         │  │         │  │        │ │  Discount (10%): -£31.00 │
│  │         │  │         │  │        │ │  Tax (20%):       £55.79 │
│  └─────────┘  └─────────┘  └────────┘ │  ─────────────────────── │
│                                        │  TOTAL:          £334.76 │
│                                        │                          │
│                                        │  Loyalty: +334 pts ⭐    │
│                                        │                          │
│  [Hold Sale] [Recall] [Discount]       │  [PAY]  £334.76          │
└────────────────────────────────────────┴──────────────────────────┘
│  Staff: John D. │ Till 1 │ ● Online │ 14:32 │ Shift: 6h 12m     │
└──────────────────────────────────────────────────────────────────┘
```

**Keyboard shortcuts:**
- `F1` — Quick search focus
- `F2` — Hold/park sale
- `F3` — Recall held sale
- `F4` — Apply discount
- `F5` — Customer lookup
- `F8` — Open cash drawer
- `F9` — Reprint last receipt
- `F10` — void last item
- `F12` or `Enter` — Pay
- `Esc` — Cancel / back
- Barcode scan → auto-add to cart (global listener)

### 6.2 Payment Modal Flow

```
Step 1: Select payment method
┌──────────────────────────────────────┐
│         Total: £334.76               │
│                                      │
│  ┌──────┐  ┌──────┐  ┌──────────┐   │
│  │ CASH │  │ CARD │  │GIFT CARD │   │
│  └──────┘  └──────┘  └──────────┘   │
│  ┌──────┐  ┌──────┐                  │
│  │SPLIT │  │ACCT  │                  │
│  └──────┘  └──────┘                  │
│                                      │
│  [  Redeem Loyalty Points (334)  ]   │
└──────────────────────────────────────┘

Step 2a (Cash): Enter tendered amount
┌──────────────────────────────────────┐
│  Due: £334.76                        │
│                                      │
│  Tendered: [£350.00]                 │
│                                      │
│  [£335] [£340] [£350] [£400] [Exact] │
│                                      │
│  Change: £15.24                      │
│                                      │
│  [Complete Sale]                     │
└──────────────────────────────────────┘

Step 2b (Card): Terminal processing
┌──────────────────────────────────────┐
│  Processing £334.76 on card reader   │
│                                      │
│         ⏳ Waiting for tap/insert    │
│                                      │
│  [Cancel]                            │
└──────────────────────────────────────┘

Step 2c (Split): Multi-method
┌──────────────────────────────────────┐
│  Total: £334.76     Remaining: £134.76│
│                                      │
│  Payment 1: Cash      £150.00  ✅    │
│  Payment 2: Gift Card  £50.00  ✅    │
│  Payment 3: Card      £134.76  ⏳    │
│                                      │
│  [Add Payment Method]                │
└──────────────────────────────────────┘

Step 3: Sale complete
┌──────────────────────────────────────┐
│           ✅ Sale Complete            │
│                                      │
│  Sale #POS-00042                     │
│  Total: £334.76                      │
│  Change: £15.24                      │
│  Loyalty earned: +334 points         │
│                                      │
│  [Print Receipt] [Email Receipt]     │
│  [New Sale]                          │
└──────────────────────────────────────┘
```

### 6.3 Click & Collect Screen

```
┌──────────────────────────────────────────────────────────────────┐
│  📦 Collection Orders          🔍 Scan order ref...              │
│                                                                  │
│  [Pending: 12]  [Ready: 5]  [Today Collected: 23]              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ #ORD-4521  │ John Smith  │ 3 items │ Placed: 2h ago      │   │
│  │ Status: PENDING → [Mark Ready] [View Items]               │   │
│  ├───────────────────────────────────────────────────────────┤   │
│  │ #ORD-4518  │ Sarah Lee   │ 1 item  │ Ready since: 30m    │   │
│  │ Status: READY → [Mark Collected] [View Items]             │   │
│  ├───────────────────────────────────────────────────────────┤   │
│  │ #ORD-4515  │ Mike Brown  │ 5 items │ Ready since: 2h     │   │
│  │ Status: READY → [Mark Collected] [View Items] ⚠️ Waiting  │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 6.4 End-of-Day Cash-Up Screen

```
┌──────────────────────────────────────────────────────────────────┐
│  💰 Cash Up — Till 1 — 19 March 2026                            │
│                                                                  │
│  Session opened: 09:00 by John D.    Float: £150.00             │
│                                                                  │
│  SYSTEM EXPECTED:                     ACTUAL COUNT:              │
│  ─────────────────                    ──────────────             │
│  Cash sales:    £1,247.50             £50 notes: [__] × £50     │
│  Cash refunds:   -£89.00             £20 notes: [__] × £20     │
│  Cash in:        £200.00             £10 notes: [__] × £10     │
│  Cash out:      -£500.00             £5 notes:  [__] × £5      │
│  Opening float:  £150.00             £2 coins:  [__] × £2      │
│  ──────────────────────              £1 coins:  [__] × £1      │
│  Expected total: £1,008.50           50p coins: [__] × £0.50   │
│                                      20p coins: [__] × £0.20   │
│                                      Other:     [__________]    │
│                                      ──────────────             │
│                                      Counted:   £1,012.50       │
│                                                                  │
│  Difference: +£4.00 (OVER)                                      │
│                                                                  │
│  Card sales:   £2,156.30 (32 transactions)                      │
│  Gift card:      £125.00 (3 transactions)                       │
│  Account:        £450.00 (2 transactions)                       │
│                                                                  │
│  TOTAL SALES: £3,978.80 (58 transactions)                       │
│  TOTAL REFUNDS: £189.00 (3 transactions)                        │
│                                                                  │
│  Notes: [_________________________________]                      │
│                                                                  │
│  [Print Z-Report]  [Close Register & Sign Off]                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. Hardware Integration Layer

### 7.1 Receipt Printer (ESC/POS)

```typescript
// electron/hardware/receiptPrinter.ts
interface ReceiptPrinterConfig {
  type: 'usb' | 'network' | 'serial';
  vendorId?: number;   // USB
  productId?: number;  // USB
  ip?: string;         // Network
  port?: number;       // Network (default 9100)
  serialPort?: string; // Serial
  paperWidth: 58 | 80; // mm
}

// Receipt format output example:
// ================================
//        COMBOSOFT RETAIL
//      123 High Street, London
//        Tel: 020 1234 5678
// ================================
// Date: 19/03/2026     Time: 14:32
// Staff: John D.       Till: 1
// Sale: POS-00042
// --------------------------------
// Nike Air Max 90 BK/42
//   1 x £129.99           £129.99
// Levi's 501 Jeans BL/32
//   2 x £89.99            £179.98
// --------------------------------
// Subtotal:               £309.97
// Discount (10%):          -£31.00
// VAT (20%):               £55.79
// ================================
// TOTAL:                  £334.76
// ================================
// Cash:         £350.00
// Change:        £15.24
// --------------------------------
// Loyalty points earned: +334
// Your balance: 1,205 points
// --------------------------------
//    Thank you for shopping!
//       www.combosoft.com
// ================================
//        [BARCODE: POS-00042]
```

### 7.2 Cash Drawer

```typescript
// Kick via receipt printer (standard ESC/POS command)
// Pin 2 kick: \x1B\x70\x00\x19\x32
// Pin 5 kick: \x1B\x70\x01\x19\x32
// Triggered automatically on cash sale completion
// Manual trigger via F8 or admin button
```

### 7.3 Barcode Scanner

```typescript
// USB HID scanners act as keyboard input
// Listen for rapid keystrokes ending in Enter/newline
// Typical scan takes <100ms for all characters
// Detection: if >4 chars received within 50ms → barcode scan
// Process: look up in local SQLite first, then API fallback
```

### 7.4 Card Terminal

```typescript
// Stripe Terminal SDK (recommended)
// - Verifone P400 or BBPOS WisePOS E
// - Connection via local network (IP)
// - Handles chip, tap, swipe, PIN
// - Returns payment intent ID for reconciliation
//
// Alternative: SumUp SDK
// - SumUp Air card reader
// - Bluetooth connection
// - Simpler integration, fewer features
```

---

## 8. Offline-First Strategy

### 8.1 What's Stored Locally (SQLite)

```
LOCAL DATABASE (better-sqlite3)
├── products        — Full catalogue snapshot (id, name, sku, barcode, price, stock, image_url)
├── variations      — All SKU variants
├── customers       — Recent/frequent customers (id, name, email, phone, loyalty)
├── promotions      — Active promotion rules
├── config          — Store settings, tax rates, terminal config
├── offline_sales   — Sales created while offline (pending sync)
├── offline_queue   — Other offline actions (stock adjust, clock in/out)
├── sync_log        — Last sync timestamps per entity
└── receipt_cache   — Recent receipts for reprint
```

### 8.2 Sync Schedule

```
ON APP START:
  1. Full catalogue delta sync (products changed since last sync)
  2. Pull active promotions
  3. Pull config/settings
  4. Push any pending offline transactions
  5. Send terminal heartbeat

EVERY 5 MINUTES (background):
  1. Delta catalogue sync
  2. Push offline queue
  3. Terminal heartbeat

EVERY 15 MINUTES:
  1. Customer data refresh
  2. Promotion refresh
  3. Stock level refresh (all products in local DB)

ON DEMAND (manual):
  1. Force full sync button in admin
  2. Triggered after conflict resolution
```

### 8.3 Offline Capabilities

| Action | Offline? | Notes |
|--------|----------|-------|
| Barcode scan → product lookup | ✅ YES | From local SQLite |
| Add items to cart | ✅ YES | Local state |
| Apply discounts/promotions | ✅ YES | Rules cached locally |
| Cash payment | ✅ YES | Sale stored in offline queue |
| Card payment | ❌ NO | Requires network for terminal SDK |
| Gift card redeem | ⚠️ LIMITED | Balance checked locally if cached, risk of stale data |
| Print receipt | ✅ YES | Direct to printer, no network needed |
| Open cash drawer | ✅ YES | Hardware command, no network |
| Customer lookup | ⚠️ LIMITED | Only cached customers |
| Stock level check (other stores) | ❌ NO | Requires API |
| Collection orders | ❌ NO | Requires API for order data |
| Returns/refunds | ⚠️ LIMITED | Can process, synced later (risk of duplicate) |
| Clock in/out | ✅ YES | Stored locally, synced later |

### 8.4 Conflict Resolution

```
SCENARIO 1: Stock oversell
  - Offline sale sold 2 of SKU-001 (local stock showed 3)
  - While offline, online order also sold 2 → actual stock is now 1
  - On sync: flag conflict, allow manager to review
  - Options: honour sale (go to -1 stock), cancel sale, backorder

SCENARIO 2: Price changed
  - Product was £29.99 when sold offline
  - Price was updated to £24.99 while terminal was offline
  - On sync: sale recorded at £29.99 (price at time of sale is honoured)
  - Log discrepancy for audit

SCENARIO 3: Duplicate transaction
  - Terminal retries a push that already succeeded (network glitch)
  - Server checks localId (UUID) for deduplication
  - If localId already exists → return existing sale, don't create duplicate
```

---

## 9. Build Sequence (Phased Delivery)

### Phase 1: Foundation (Weeks 1-4)

**Backend:**
```
□ Add "POS" as a Channel in Channels table (seeder)
□ Add `type` field to WareHouse model (warehouse | retail_store)
□ Create POSTerminal model + CRUD endpoints
□ Create POSRegisterSession model + open/close endpoints
□ Create POSSale + POSSaleItem models
□ Build POST /client/pos/sale/create (atomic: create sale + decrement stock + create Order record)
□ Build GET /client/pos/sale/ (list sales with filters)
□ Build GET /client/pos/sale/:id (sale detail)
□ Build receipt data endpoint GET /client/pos/sale/:id/receipt/data
□ Build POSCashMovement model + cash-in/cash-out endpoints
□ Build X-Report + Z-Report endpoints
□ Extend order creation to support createdVia: 'pos'
```

**Desktop App:**
```
□ Scaffold Electron + React + Vite project
□ Implement main process + preload bridge
□ Build login page (PIN pad + staff select)
□ Build store/terminal selection
□ Build main POS layout (product search + cart split)
□ Implement barcode scanner listener (USB HID)
□ Build product search (local SQLite + API fallback)
□ Build cart management (add, remove, quantity, line discount)
□ Build cash payment flow (tendered, change calculation)
□ Implement receipt printer (ESC/POS over network/USB)
□ Implement cash drawer kick
□ Build register open/close flow
□ Build basic SQLite local database + catalogue sync
□ Build status bar (staff, store, online/offline, clock)
```

**Deliverable:** Staff can log in, scan products, accept cash, print receipt, open/close register.

---

### Phase 2: Payments & Returns (Weeks 5-8)

**Backend:**
```
□ Card payment integration API (Stripe Terminal or SumUp)
□ Split payment handling in sale creation
□ Refund endpoints (full + partial, to original method)
□ Exchange endpoint (return + new sale atomic)
□ Void sale endpoint
□ Staff-initiated return flow (different from customer portal)
□ Held transaction model + endpoints (park/recall)
□ Quick customer creation endpoint (minimal fields)
□ POS daily summary report endpoint
□ POS staff performance report endpoint
```

**Desktop App:**
```
□ Card payment modal (Stripe Terminal SDK integration)
□ Split payment UI (add multiple payment methods)
□ Return/refund workflow screens
□ Exchange flow (return items → add new items → pay difference)
□ Void sale confirmation
□ Hold/park sale functionality
□ Recall held sale list
□ Customer search + attach to sale
□ Quick-add customer inline
□ Cash-up / end-of-day screen
□ Print Z-report
```

**Deliverable:** Full payment processing (cash + card + split), returns/exchanges, hold/recall, customer attachment.

---

### Phase 3: Offline & Collections (Weeks 9-12)

**Backend:**
```
□ Sync endpoints (delta pull for catalogue, customers, promotions, config)
□ Offline transaction push endpoint (batch, deduplication by localId)
□ Conflict detection + resolution endpoints
□ Click & collect status workflow (pending → ready → collected)
□ Collection notification triggers (email/SMS)
□ Collection stats endpoint
□ Customer-facing display content API
□ WebSocket endpoint for real-time POS updates
```

**Desktop App:**
```
□ Full offline mode implementation
□ SQLite local database (products, customers, config, offline queue)
□ Sync engine (catalogue, customer, promotion, config sync)
□ Offline sale creation + queue
□ Sync status indicator + manual sync trigger
□ Conflict resolution UI (for managers)
□ Click & collect screen (list, scan, mark ready, mark collected)
□ Customer-facing display (second window on 2nd monitor)
□ Display: live cart, idle promotions, thank you screen
□ Network connectivity monitoring + graceful degradation
```

**Deliverable:** App works offline, click & collect management, customer-facing display.

---

### Phase 4: Loyalty & Gift Cards (Weeks 13-16)

**Backend:**
```
□ Gift card models (POSGiftCard + POSGiftCardTransaction)
□ Gift card endpoints (create, sell, redeem, top-up, balance check)
□ Loyalty config model + endpoints
□ Loyalty tier model + endpoints
□ Customer loyalty account model + endpoints
□ Loyalty transaction logging
□ Points earn/redeem during sale (integrated into sale creation)
□ Gift card liability report
□ Loyalty impact report (member vs non-member)
```

**Desktop App:**
```
□ Gift card sale flow (generate code, activate, print card receipt)
□ Gift card balance check (scan barcode)
□ Gift card payment method in checkout
□ Gift card top-up screen
□ Loyalty dashboard (program overview, tier breakdown)
□ Loyalty lookup at checkout (scan card, enter phone)
□ Points earn display during sale
□ Points redeem as discount option in payment
□ Customer profile: loyalty tab (points, tier, history)
□ Loyalty sign-up at POS (quick enroll)
```

**Deliverable:** Full gift card lifecycle, loyalty program with points, tiers, earn/redeem.

---

### Phase 5: Promotions & Staff Management (Weeks 17-20)

**Backend:**
```
□ POSPromotion model + CRUD endpoints
□ Cart evaluation endpoint (evaluate cart against all active promos)
□ Store-specific promotion support
□ Time-limited promotion scheduling
□ Employee time clock model + endpoints (clock in/out, breaks)
□ Commission rule model + endpoints
□ Commission calculation (per sale, per period)
□ Commission report endpoint
□ Employee scheduling foundation (if needed)
□ Staff performance detailed reports
```

**Desktop App:**
```
□ Promotion manager (create/edit promotion rules)
□ Auto-apply promotions to cart (real-time evaluation)
□ Promotion badge on products (sale, BOGOF, etc.)
□ Manual discount override (with manager approval)
□ Time clock page (clock in/out/break with PIN)
□ Shift summary display
□ Commission dashboard (per staff)
□ Layaway creation + management screens
□ Layaway payment + completion flow
□ Barcode label printing from POS
```

**Deliverable:** Smart promotions engine, employee time tracking, commission tracking, layaway.

---

### Phase 6: Advanced Features (Weeks 21-26)

**Backend:**
```
□ Scheduled report system (cron-based email delivery)
□ Store comparison report endpoint
□ Remote terminal management endpoints (status, commands)
□ Terminal heartbeat processing + alerting
□ OTA update distribution endpoint
□ Self-checkout configuration
□ Advanced analytics (hourly breakdown, category trends)
□ Inventory alerts (low stock push to POS terminals)
□ Ship-from-store fulfillment routing
□ AI demand forecasting (v1 — rule-based, not ML yet)
```

**Desktop App:**
```
□ Self-checkout kiosk mode (restricted UI, large buttons, card-only)
□ Scheduled reports configuration
□ Store comparison dashboard
□ Remote terminal monitoring (admin view)
□ Auto-update mechanism (electron-updater)
□ Advanced keyboard shortcuts + customisation
□ Multi-language support foundation
□ Performance optimisation (large catalogue handling)
□ Accessibility improvements (screen reader, high contrast)
□ Windows installer (MSI) for enterprise deployment
```

**Deliverable:** Self-checkout, auto-updates, scheduled reports, enterprise deployment ready.

---

## 10. API Contract Drafts

### 10.1 Create POS Sale

```
POST /client/pos/sale/create
Authorization: Bearer {token}

Request Body:
{
  "terminalId": 1,
  "customerId": 42,                    // nullable for walk-in
  "items": [
    {
      "variationId": 1001,
      "quantity": 2,
      "unitPrice": 89.99,
      "discount": 9.00,               // line-level discount
      "shelfId": 5                     // which shelf to decrement
    },
    {
      "variationId": 2005,
      "quantity": 1,
      "unitPrice": 129.99,
      "discount": 0,
      "shelfId": 5
    }
  ],
  "payments": [
    { "method": "cash", "amount": 200.00, "tendered": 200.00 },
    { "method": "card", "amount": 100.97, "reference": "pi_xxx", "cardType": "visa", "lastFour": "4242" }
  ],
  "discountTotal": 9.00,
  "taxTotal": 60.19,
  "grandTotal": 300.97,
  "loyaltyPointsRedeemed": 0,
  "loyaltyDiscountAmount": 0,
  "promotionId": null,
  "promotionDetails": null,
  "notes": "",
  "isOfflineSale": false,
  "offlineLocalId": null               // UUID if created offline (for dedup)
}

Response (201):
{
  "success": true,
  "data": {
    "id": 1,
    "saleNumber": "POS-00042",
    "status": "completed",
    "grandTotal": 300.97,
    "change": 99.03,
    "loyaltyPointsEarned": 300,
    "receiptData": { ... },            // Ready-to-print receipt object
    "orderId": 58421                   // Linked Order record
  }
}
```

### 10.2 Open Register

```
POST /client/pos/register/open
Authorization: Bearer {token}

Request Body:
{
  "terminalId": 1,
  "openingFloat": 150.00
}

Response (201):
{
  "success": true,
  "data": {
    "id": 1,
    "terminalId": 1,
    "openedBy": 12,
    "openedAt": "2026-03-19T09:00:00Z",
    "status": "open",
    "openingFloat": 150.00
  }
}
```

### 10.3 Close Register (Z-Report)

```
POST /client/pos/register/close
Authorization: Bearer {token}

Request Body:
{
  "sessionId": 1,
  "closingCash": 1012.50,
  "notes": "£4 over, likely mis-counted 50p coins"
}

Response (200):
{
  "success": true,
  "data": {
    "sessionId": 1,
    "closedAt": "2026-03-19T18:00:00Z",
    "openingFloat": 150.00,
    "closingCash": 1012.50,
    "expectedCash": 1008.50,
    "cashDifference": 4.00,
    "totalSales": 3978.80,
    "totalRefunds": 189.00,
    "transactionCount": 58,
    "refundCount": 3,
    "paymentBreakdown": {
      "cash": 1247.50,
      "card_visa": 1520.30,
      "card_mastercard": 636.00,
      "gift_card": 125.00,
      "account": 450.00
    },
    "zReportGenerated": true,
    "zReportUrl": "/client/pos/register/z-report/1"
  }
}
```

### 10.4 Delta Catalogue Sync

```
GET /client/pos/sync/pull/catalogue?since=2026-03-19T12:00:00Z&limit=500
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": {
    "updated": [
      {
        "variationId": 1001,
        "catalogueId": 500,
        "name": "Nike Air Max 90",
        "sku": "NKE-AM90-BK-42",
        "ean": "5060012345678",
        "imageUrl": "https://cdn.example.com/nke-am90.jpg",
        "regularPrice": 129.99,
        "salePrice": null,
        "costPrice": 65.00,
        "vat": 20,
        "stock": 8,
        "categoryId": 6,
        "brandId": 12,
        "attribute": { "Size": "42", "Colour": "Black" },
        "isBundle": false,
        "updatedAt": "2026-03-19T14:30:00Z"
      }
    ],
    "deleted": [2003, 2004],           // variationIds soft-deleted since last sync
    "totalUpdated": 12,
    "totalDeleted": 2,
    "hasMore": false,
    "syncTimestamp": "2026-03-19T15:00:00Z"  // Use as `since` for next sync
  }
}
```

### 10.5 Push Offline Transactions

```
POST /client/pos/sync/push
Authorization: Bearer {token}

Request Body:
{
  "transactions": [
    {
      "localId": "a1b2c3d4-uuid",     // For deduplication
      "type": "sale",
      "terminalId": 1,
      "createdAt": "2026-03-19T14:32:00Z",
      "data": { ... }                  // Same shape as /sale/create body
    },
    {
      "localId": "e5f6g7h8-uuid",
      "type": "clock_in",
      "terminalId": 1,
      "createdAt": "2026-03-19T09:00:00Z",
      "data": { "userId": 12 }
    }
  ]
}

Response (200):
{
  "success": true,
  "data": {
    "processed": 2,
    "results": [
      { "localId": "a1b2c3d4-uuid", "status": "synced", "serverId": 42, "saleNumber": "POS-00042" },
      { "localId": "e5f6g7h8-uuid", "status": "synced", "serverId": 15 }
    ],
    "conflicts": []
  }
}
```

---

## Summary: Numbers at a Glance

| Metric | Count |
|--------|-------|
| Existing API endpoints reusable as-is | ~120 |
| Existing API endpoints needing extension | ~15 |
| New API endpoints to build | ~95 |
| Existing database models reusable | 94 |
| New database models to create | 20 |
| Desktop app pages/screens | 35+ |
| Desktop app components | 50+ |
| Electron main-process modules | 15+ |
| Estimated total development phases | 6 |
