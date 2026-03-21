# WMSPOS — Developer Primer

> Combosoft POS: Desktop point-of-sale system built on top of the existing WMS backend.

---

## What Is This?

A Windows desktop POS application for retail stores, built with **Electron + React + TypeScript**. It connects to Combosoft's existing WMS (Warehouse Management System) backend, reusing ~120 existing API endpoints and extending them with POS-specific functionality (sales, registers, payments, receipts, offline sync).

The core competitive advantage: **WMS-native backend** — inventory, stock transfers, purchase orders, customer accounts, and multi-location management are already built. The POS frontend plugs directly into that infrastructure.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop runtime | Electron | 33+ |
| Frontend framework | React | 19 |
| Language | TypeScript | 5.3 |
| State management | Zustand | 4.5 |
| Styling | Tailwind CSS | 4.0 |
| HTTP client | Axios | 1.6 |
| Icons | Lucide React | 0.454 |
| Routing | React Router (HashRouter) | 6.22 |
| Bundler | Vite + electron-vite | 5.0 / 2.0 |
| Packaging | electron-builder (NSIS) | 24.9 |

---

## Project Structure

```
WMSPOS/
├── src/
│   ├── main/                          # Electron main process (Node.js)
│   │   └── index.ts                   # Window creation, IPC handlers, config storage
│   │
│   ├── preload/                       # Secure IPC bridge
│   │   ├── index.ts                   # contextBridge exposing window.electronAPI
│   │   └── index.d.ts                 # Type definitions for the bridge
│   │
│   └── renderer/                      # React frontend
│       ├── index.html                 # HTML entry
│       ├── tsconfig.json              # Renderer-specific TS config
│       └── src/
│           ├── main.tsx               # React mount point (HashRouter)
│           ├── App.tsx                # Routes + ProtectedRoute guard
│           ├── env.d.ts               # Env var + ElectronAPI types
│           │
│           ├── assets/
│           │   └── index.css          # Tailwind v4 + custom theme + utility classes
│           │
│           ├── lib/
│           │   └── axios.ts           # Axios instance (auth interceptor, 401 redirect)
│           │
│           ├── stores/                # Zustand state
│           │   ├── authStore.ts       # Token, user, terminal config
│           │   ├── cartStore.ts       # Cart items, customer, discount, totals
│           │   └── registerStore.ts   # Register session (id, float, openedAt)
│           │
│           ├── pages/                 # Route components
│           │   ├── TerminalSetup.tsx   # Manager login + warehouse/terminal registration
│           │   ├── EmployeeLogin.tsx   # Employee ID login
│           │   ├── OpenRegister.tsx    # Enter opening float
│           │   ├── MainPOS.tsx         # Core POS screen (product grid + cart)
│           │   ├── HeldTransactions.tsx
│           │   ├── Returns.tsx
│           │   ├── ReturnProcess.tsx
│           │   ├── StockLookup.tsx
│           │   ├── SalesHistory.tsx
│           │   └── CloseRegister.tsx   # End-of-day cash-up
│           │
│           └── components/            # Shared UI
│               ├── TopBar.tsx         # Header nav (held, returns, stock, history, X report, close, logout)
│               ├── ProductGrid.tsx    # Search, categories, barcode scan, product cards
│               ├── Cart.tsx           # Cart panel with customer, discount, checkout
│               ├── PaymentModal.tsx   # Card / cash / split payment flow
│               ├── SaleComplete.tsx   # Post-sale confirmation
│               ├── CustomerSearch.tsx
│               ├── DiscountModal.tsx
│               ├── QuickCustomerCreate.tsx
│               └── XReportModal.tsx
│
├── electron.vite.config.ts            # Build config (main + preload + renderer)
├── electron-builder.yml               # Windows NSIS installer config
├── tsconfig.json                      # TS config for main/preload
├── tsconfig.node.json                 # TS config for vite config file
├── package.json
└── POS-SYSTEM-SCAFFOLD.md            # Full technical specification (~2000 lines)
```

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│  ELECTRON MAIN PROCESS (Node.js)                 │
│                                                  │
│  - BrowserWindow (1280x800)                      │
│  - IPC handlers: terminal config, auth tokens    │
│  - Config stored in userData/config.json          │
│                                                  │
│         contextBridge (preload.ts)                │
├──────────────────────────────────────────────────┤
│  RENDERER PROCESS (React)                        │
│                                                  │
│  Zustand Stores ←→ React Components ←→ Axios     │
│  (authStore)        (pages/components)   ↕        │
│  (cartStore)                          Backend API │
│  (registerStore)                                  │
└──────────────────────────────────────────────────┘
```

**Key architectural decisions:**

- **HashRouter** — Required for Electron file:// protocol compatibility
- **contextBridge isolation** — Renderer has no direct access to Node.js; all system calls go through `window.electronAPI`
- **Zustand over Redux** — Lightweight, minimal boilerplate, POS-optimized
- **No local database yet** — Phase 1 uses API calls directly; SQLite (better-sqlite3) is planned for Phase 3 offline support

---

## Application Flow

```
1. Terminal Setup  →  Manager logs in (email/password)
   /setup              Selects warehouse + registers terminal
                       Config saved locally via Electron IPC

2. Employee Login  →  Employee enters their ID
   /login              Token stored via Electron IPC

3. Open Register   →  Employee enters opening float amount
   /open-register      Creates register session via API

4. Main POS        →  Product search/scan + cart + checkout
   /pos                Barcode scanning, category filtering
                       Payment (cash/card/split) → sale created

5. Close Register  →  Cash count, Z-report, close session
   /close-register
```

**Route protection:** `ProtectedRoute` in `App.tsx` enforces this sequence — no terminal config redirects to `/setup`, no token redirects to `/login`, no register session redirects to `/open-register`.

---

## Running the Project

```bash
# Install dependencies
npm install

# Development (hot-reload)
npm run dev

# Build for production
npm run build

# Package as Windows installer
npm run package
```

**Environment:** Set `VITE_API_URL` to point at the backend (defaults to `http://localhost:9000/api`).

---

## Backend API Integration

The Axios instance at `src/renderer/src/lib/axios.ts` handles:
- Auto-attaching the auth token from `authStore`
- Redirecting to `/login` on 401 responses

**Key endpoints the app calls:**

| Endpoint | Used By | Purpose |
|----------|---------|---------|
| `POST /client/login` | TerminalSetup | Manager authentication |
| `POST /client/login-with-id` | EmployeeLogin | Staff login |
| `GET /client/warehouse` | TerminalSetup | List store locations |
| `POST /client/pos/terminal/register` | TerminalSetup | Register this terminal |
| `POST /client/pos/register/open` | OpenRegister | Start register session |
| `GET /client/categorization-data` | ProductGrid | Product categories |
| `GET /client/catalogue/pos/data` | ProductGrid | Product search |
| `GET /client/pos/stock/:id/warehouses` | ProductGrid | Cross-store stock check |
| `POST /client/pos/sale/create` | PaymentModal | Complete a sale |
| `POST /client/pos/sale/hold` | Cart | Park a transaction |

The full list of planned endpoints (~95 new + ~15 extended) is documented in `POS-SYSTEM-SCAFFOLD.md`.

---

## State Management

### authStore
- `token` — JWT from login
- `user` — `{ id, clientId, firstName, lastName }`
- `terminalConfig` — `{ terminalId, terminalName, warehouseId, warehouseName, shelfId, shelfName }`
- Persisted to disk via Electron IPC (`userData/config.json`)

### cartStore
- `items[]` — Cart line items with variation data, quantity, pricing
- `customer` — Attached customer (nullable for walk-ins)
- `discount` — Cart-level discount (`{ type: 'percentage' | 'fixed', value }`)
- Computed: `getSubtotal()`, `getDiscountAmount()`, `getVAT()`, `getTotal()`
- VAT hardcoded at 20%

### registerStore
- `session` — `{ id, openFloat, openedAt }` (nullable until register opened)

---

## What's Built (Phase 1)

- Terminal registration and setup flow
- Employee login (ID-based)
- Register open/close with float
- Product search with category filtering
- Barcode scanning (USB HID keyboard emulation)
- Shopping cart (add, remove, quantity, line items)
- Customer search and quick-create
- Cart-level and line-level discounts
- Payment modal (cash with change calc, card, split)
- Sale completion and confirmation
- Hold/recall transactions
- Returns workflow
- Stock lookup across warehouses
- Sales history
- X Report generation
- End-of-day close register

---

## What's Planned (Phases 2-6)

See `POS-SYSTEM-SCAFFOLD.md` for full details. Summary:

| Phase | Scope | Key Deliverables |
|-------|-------|-----------------|
| 2 | Payments & Returns | Card terminal integration (Stripe/SumUp), split payments, refunds, exchanges |
| 3 | Offline & Collections | SQLite local DB, sync engine, offline sales queue, click & collect, customer display |
| 4 | Loyalty & Gift Cards | Gift card lifecycle, loyalty points/tiers, earn/redeem at checkout |
| 5 | Promotions & Staff | Promotions engine (BOGOF, % off, bundles), time clock, commission tracking, layaway |
| 6 | Advanced | Self-checkout kiosk, auto-updates, scheduled reports, multi-language, MSI deployment |

---

## New Database Models (20 total, all planned)

`POSSale`, `POSSaleItem`, `POSTerminal`, `POSRegisterSession`, `POSCashMovement`, `POSHeldTransaction`, `POSLayaway`, `POSGiftCard`, `POSGiftCardTransaction`, `POSLoyaltyConfig`, `POSLoyaltyTier`, `POSCustomerLoyalty`, `POSLoyaltyTransaction`, `POSTimeClock`, `POSPromotion`, `POSCommissionRule`, `POSCommissionLog`, `POSOfflineSyncQueue`, `POSScheduledReport`, `POSDisplaySetting`

---

## Conventions

- **File naming:** PascalCase for components/pages, camelCase for stores/utils/lib
- **Styling:** Tailwind utility classes inline; custom component classes defined in `index.css` (`.btn-primary`, `.input-field`, `.card`)
- **State:** Zustand stores with `create()` — no providers needed, import and use directly
- **API calls:** Use the shared Axios instance from `lib/axios.ts` — never create raw Axios instances
- **Routing:** HashRouter (`/#/path`) — required for Electron
- **IPC:** All Node.js access goes through `window.electronAPI` defined in preload
- **Icons:** Lucide React — import individual icons as needed
