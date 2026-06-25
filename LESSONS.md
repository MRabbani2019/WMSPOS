# Lessons Learned — WMSPOS

A running log of insights, gotchas, and patterns discovered during development sessions.

---

## 2026-04-23 — Critical Bug Fixes (Blocks 1–3)

### Financial Integrity

- **Double-submit guard (PaymentModal):** A `useRef` flag (`isSubmitting`) is the correct tool for preventing re-entrant async submissions in React — `useState` would trigger a re-render and create a race window, whereas `useRef` mutates synchronously without re-rendering.

- **NaN cash guard:** Always validate `parseFloat` results before financial arithmetic. An empty or non-numeric cash field produces `NaN`, which propagates silently through comparisons — `NaN >= total` evaluates to `false`, so the guard `isNaN(tendered) || tendered < total` is the correct combined check.

- **Receipt persistence before clearCart:** `localStorage.setItem` must happen before `clearCart()`. If the write is placed after, a crash or synchronous error during `clearCart` can leave the cart cleared with no receipt record.

- **State mutation in cartStore.addItem:** Mutating `newItems[existingIndex].quantity` directly is a bug even when `newItems` is a shallow copy of the array — the array elements themselves are still the same object references. Always replace the element with a spread: `{ ...newItems[existingIndex], quantity: newQuantity }`.

- **Tax formula in getUniqueTaxRates:** For tax-inclusive prices, VAT must be extracted using `lineTotal - (lineTotal / (1 + taxRate))`, not `lineTotal * taxRate`. The latter computes tax-on-top (exclusive), producing an inflated figure for inclusive pricing.

- **Refund pro-rata discount:** Deriving the discount percentage from `1 - (orderTotal / orderSubtotal)` is fragile — any rounding in `totalPrice` corrupts the fraction. Using the explicit `totalDiscount` field and dividing by `orderSubtotal` is numerically stable and semantically correct.

- **expectedCash formula in CloseRegister:** The original formula omitted cash-in/cash-out movements (petty cash, safe drops). The corrected formula is: `openFloat + cashSalesTotal + cashIn - cashOut - cashRefunds`. Use `cashReturnsTotal` (cash-only refunds) when available, falling back to `returnsTotal` (all-method total) only as a last resort.

### Security

- **safeStorage for token encryption:** Electron's `safeStorage` API encrypts using the OS credential store (Keychain / libsecret / DPAPI). Tokens stored with it are unreadable by other OS users and survive app reinstalls. Store the encrypted buffer as base64 in config JSON; track `tokenEncrypted: boolean` to handle machines where encryption is unavailable.

- **sandbox: true in BrowserWindow:** Enabling the Chromium sandbox is the correct default for Electron apps that use a preload script with `contextIsolation: true`. The combination of sandbox + contextIsolation + no nodeIntegration is the recommended security posture per the Electron security checklist.

- **Discount ceiling enforcement:** The cashier discount ceiling (`cashierMaxPercent`) was only logged as a warning in `LineItemDiscountModal` and not enforced at all in `DiscountModal`. Both modals now hard-block over-limit discounts. For fixed-amount discounts, the effective percentage must be computed against the current subtotal to apply the same ceiling uniformly.

### Offline Sync

- **Module-level sync lock vs. Zustand state lock:** Using a Zustand state field (`syncInProgress`) as a re-entrancy guard is insufficient — between reading the state and setting it, other event-loop ticks can enter the function. A module-level boolean (`let _syncLock`) is set and checked synchronously before any `await`, making it a true mutex for the async function.

- **isOnline should default to false:** Defaulting to `true` means the UI briefly shows card payment as available before the first connectivity check completes. Defaulting to `false` is the safer pessimistic assumption — the connectivity monitor's initial `checkConnectivity()` call resolves it within one network round-trip.

- **clearSynced must update localStorage:** After filtering synced items from in-memory state, the localStorage queue must be updated to match. Without this, cleared items re-appear on the next page load when the queue is restored from storage.

- **Deferred sync on startup:** When the offline queue is restored from localStorage on startup, a `setTimeout(..., 2000)` deferred `syncAll()` is needed to give the connectivity monitor time to perform its initial ping and set `isOnline: true` before the sync attempt runs.
