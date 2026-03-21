# Lessons Learned — WMSPOS

> Notes captured during Phase 1 development. Reference these before building new features.

---

## Electron & Desktop

### 1. HashRouter is mandatory in Electron
React Router's `BrowserRouter` doesn't work with Electron's `file://` protocol. We use `HashRouter` so all routes are `/#/path`. Every new route must be added inside the `HashRouter` in `main.tsx` — don't accidentally nest a second router.

### 2. contextBridge is the only safe IPC path
The renderer has `nodeIntegration: false` and `contextIsolation: true`. All system calls go through `window.electronAPI` (defined in `preload/index.ts`). Never import Node modules (`fs`, `path`, `electron`) directly in renderer code — it will fail silently or crash.

### 3. Config storage uses a flat JSON file
Terminal config and auth tokens are stored in `userData/config.json` via IPC handlers in `main/index.ts`. This works for Phase 1 but has limitations:
- No encryption — tokens are stored in plaintext on disk
- No atomic writes — concurrent writes could corrupt the file
- Phase 3 will replace this with SQLite (`better-sqlite3`) for proper local storage

### 4. DevTools auto-open in development
`main/index.ts` calls `openDevTools()` when `NODE_ENV === 'development'`. This is useful but can obscure layout issues — the window size changes when DevTools dock. Test with DevTools closed before finalising layouts.

### 5. Window minimum size matters for POS
Set to 1024x768 minimum. The split layout (60% product grid / 40% cart) breaks below this. If adding new views, test at minimum dimensions.

---

## React & State

### 6. Zustand stores are accessed outside React in Axios interceptors
`lib/axios.ts` calls `useAuthStore.getState()` directly (not as a hook) to read the token in request interceptors. This pattern works because Zustand supports external access, but be careful:
- Don't call `set()` outside React without understanding re-render implications
- The 401 interceptor clears auth and does `window.location.href = '/login'` — this is a full page reload, not a React navigation

### 7. Cart quantity is capped by `maxStock`
`cartStore.ts` enforces `Math.min(quantity, maxStock)` when adding/updating items. The `maxStock` value comes from `shelfStock` at time of add — it's a snapshot, not live. If stock changes between adding to cart and checkout, the backend must reject oversells.

### 8. VAT is hardcoded at 20%
`cartStore.ts` has `const VAT_RATE = 0.2`. This needs to become configurable per-store before international rollout. The VAT calculation is `(subtotal - discount) * 0.2` — VAT is applied after discounts, which is correct for UK but may differ elsewhere.

### 9. Computed values in Zustand use `get()` chaining
`getTotal()` calls `getSubtotal()`, `getDiscountAmount()`, and `getVAT()` internally. This works but means each call recomputes from scratch. For Phase 5 (promotions engine), consider memoising these if cart recalculation becomes a performance bottleneck.

### 10. ProtectedRoute enforces a strict sequence
`App.tsx`'s `ProtectedRoute` checks: terminal config → token → register session. If any is missing, it redirects to the appropriate setup step. When adding new routes, always wrap them in `<ProtectedRoute>` unless they're explicitly public (like `/setup` and `/login`).

---

## Product Search & Barcode Scanning

### 11. Barcode detection heuristic: all digits = barcode
`ProductGrid.tsx` uses `/^\d+$/.test(term)` to detect barcodes. This works for EAN-13/UPC but will false-positive on numeric SKUs. The workaround: SKUs containing `_` or `.` are treated as SKU lookups instead. If customers start using pure-numeric SKUs, this heuristic needs rethinking.

### 12. Auto-add only fires on exact single match with stock
When a barcode scan returns exactly 1 product and `shelfStock > 0`, it auto-adds to cart and shows a green toast. Multiple results or zero stock fall through to the grid view. This prevents accidental double-adds from rapid scanning.

### 13. Search input auto-refocuses on every click
`ProductGrid.tsx` attaches a window-level click listener that refocuses the search input. This is intentional for POS workflows (cashier should always be able to scan) but conflicts with modals — the stock modal suppresses refocus via the `stockModal` state check. New modals must do the same.

### 14. Debounced search is 300ms
Text searches debounce at 300ms. Barcode scans bypass the debounce entirely (handled on `Enter` keypress). If the API is slow, users see results from stale queries arriving after new ones. Consider adding a request cancellation mechanism (AbortController) for Phase 2.

### 15. Categories filter by `categorizationId === 6` and `status === 1`
The category filter hardcodes `categorizationId: 6` as the product category type. This comes from the WMS backend's categorization system where different IDs represent different classification types (brand, department, category, etc.). If the backend changes this mapping, the filter breaks silently.

---

## Payments

### 16. Split payment only supports cash + card
`PaymentModal.tsx` implements split as a cash amount with the remainder going to card. Phase 4 needs to extend this for gift card, account, and loyalty points as additional split methods. The `payments` array in the API payload already supports multiple entries, so the backend is ready.

### 17. Card payment has no terminal integration yet
Selecting "Card" in the payment modal immediately submits the sale with `method: 'card'`. There's no actual card reader SDK call. Phase 2 must intercept this and route through Stripe Terminal or SumUp SDK before completing the sale.

### 18. Cash change calculation is client-side only
The change amount (`tendered - total`) is calculated in the frontend and sent to the API as `changeGiven`. The backend should validate this independently — never trust the client for financial calculations.

---

## API Integration

### 19. Warehouse endpoint response shape is uncertain
`TerminalSetup.tsx` tries three different response paths: `response.data.data`, `response.data.warehouses`, and `response.data` directly. This suggests the backend's warehouse endpoint response shape wasn't finalised during development. Pin down the contract and remove the fallback chain.

### 20. Login uses two different endpoints
- Manager login: `POST /client/login` (email + password) — used in terminal setup
- Employee login: `POST /client/login-with-id` (employee ID) — used daily

Both return tokens but with potentially different permission scopes. The system doesn't currently differentiate — a manager token from setup persists and could be used for regular sales, bypassing the employee login step on next app launch.

### 21. API base URL defaults to localhost:9000
If `VITE_API_URL` isn't set, Axios defaults to `http://localhost:9000/api`. This is fine for development but will silently fail in production builds. The packaging step should enforce this env var or use a runtime config file.

---

## UI & Styling

### 22. Tailwind v4 uses CSS-based config, not tailwind.config.js
The project uses Tailwind CSS v4 with the Vite plugin (`@tailwindcss/vite`). Custom colours and component classes are defined directly in `assets/index.css` using CSS custom properties and `@apply`. There is no `tailwind.config.js` file — don't create one, it's not how v4 works.

### 23. Custom colour scales follow a naming convention
Defined in `index.css`: `--color-primary-*`, `--color-success-*`, `--color-danger-*` with shades from 50 to 900. Use these semantic names rather than raw hex values. Example: `text-primary-600`, `bg-danger-50`, `border-success-200`.

### 24. Component classes are minimal
Only four custom component classes exist: `.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-danger`, `.input-field`, `.card`. Everything else uses Tailwind utilities directly. Don't create new component classes unless a pattern repeats 5+ times across files.

### 25. No global layout component
Each page manages its own full-screen layout. `MainPOS` is a flex column with TopBar + split grid. Other pages (Returns, StockLookup, etc.) repeat the `TopBar` import and layout structure. If adding more pages, consider extracting a shared layout wrapper to reduce duplication.

---

## Data & Business Logic

### 26. Products are mapped from catalogue → variations
The backend returns catalogues containing `Variations[]`. `ProductGrid.tsx`'s `mapCatalogueToProducts` flattens these into individual product cards. Each variation becomes a sellable item. Catalogues without variations get a fallback entry with `shelfStock: 0` — these can't be sold.

### 27. Prices come from `salePrice`, not `retailPrice`
`mapCatalogueToProducts` reads `v.salePrice || cat.salePrice || 0`. There's no check for a separate retail/RRP field. When implementing promotions (Phase 5), ensure the discount is applied against the correct base price — `salePrice` may already be a discounted price.

### 28. Stock data: `shelfStock` vs `actualQuantity`
- `shelfStock` = stock on the specific shelf at this terminal's warehouse (what's sellable right now)
- `actualQuantity` = total stock across all locations

The cart uses `shelfStock` for `maxStock` enforcement. Out-of-stock detection uses both: `shelfStock > 0` means in-store, `totalStock > 0` means available elsewhere.

### 29. Hold (park) saves full cart as JSON
When a sale is held, the entire cart state (items, customer, discount) is serialised to JSON and posted to the API. On recall, this JSON is deserialised back into the cart. Any schema changes to `CartItem` need backward compatibility with parked carts that were saved under the old schema.

### 30. Register close navigates to /login, not /setup
After closing the register, the app goes to `/login` (employee login), not `/setup`. This is correct — terminal config persists, so a new employee can log in without reconfiguring. Only a deliberate "reset terminal" action should go back to `/setup`.

---

## Known Technical Debt

| Item | Location | Priority | Notes |
|------|----------|----------|-------|
| Token stored as plaintext | `main/index.ts` | Medium | Use `safeStorage` from Electron |
| No request cancellation | `ProductGrid.tsx` | Low | Stale search results could flash briefly |
| VAT hardcoded 20% | `cartStore.ts` | Medium | Must be configurable before non-UK use |
| Category ID hardcoded (6) | `ProductGrid.tsx:54` | Medium | Should come from config/API |
| Warehouse response shape fragile | `TerminalSetup.tsx:54` | Low | Pin down API contract |
| No error boundaries | All pages | Medium | Uncaught errors crash the whole renderer |
| 401 handler does full page reload | `lib/axios.ts:31` | Low | Should use React Router navigation |
| `any` types throughout | Multiple files | Low | Add proper interfaces incrementally |
| No loading skeleton UI | ProductGrid, Cart | Low | Jumpy layout during fetches |
| Split payment limited to cash+card | `PaymentModal.tsx` | High (Phase 2) | Need gift card, account, loyalty |
