# Business Requirements Document: WMS POS System
## Phases 2-5 - Comprehensive Feature Specification

**Document Version:** 1.0
**Date:** 2026-04-22
**Author:** Business Manager / Product Owner
**Status:** Draft for Engineering Review

---

## TABLE OF CONTENTS

1. Executive Summary
2. Stakeholder Personas
3. Phase 2 Requirements
4. Phase 3 Requirements
5. Phase 4 Requirements
6. Phase 5 Requirements
7. Missing Features (Retailer Reality Check)
8. Compliance & Legal
9. Workflow Diagrams
10. KPIs & Success Metrics
11. Priority Matrix (MoSCoW)
12. Open Questions & Risks

---

## 1. EXECUTIVE SUMMARY

This document defines the full business requirements for POS phases 2 through 5, plus a set of features identified as critical gaps based on real retail operations experience. The system must serve multi-location retailers operating from a single WMS backbone, with the POS acting as the customer-facing transaction layer.

The guiding principle throughout is: **the cashier must never be blocked, and the manager must always have control.** Every failure mode must have a graceful fallback. Every permission boundary must be enforceable without stopping the queue.

---

## 2. STAKEHOLDER PERSONAS

### P1 - Cashier (Front Line)
- Processes 50-300 transactions per shift
- Needs speed above all else: every extra tap costs real money in queue time
- Not technical; UI must be self-explanatory under pressure
- Makes mistakes; the system must make corrections easy, not embarrassing
- Has limited permissions intentionally

### P2 - Store Manager
- Responsible for daily operations, EOD reconciliation, staff performance
- Needs override capability without being physically present at the till
- Reviews X/Z reports, handles customer escalations, approves high-value discounts
- Typically manages 2-8 tills simultaneously

### P3 - Regional / Area Manager
- Oversight across multiple stores
- Needs consolidated reporting, exception alerts, cross-store comparisons
- Never touches the till; operates entirely in back-office/analytics

### P4 - Customer
- Wants fast, accurate transactions
- Expects a receipt (print or email)
- Expects loyalty points to apply automatically
- Gets frustrated when POS failures become their problem

### P5 - IT Admin / System Integrator
- Manages terminal configuration, tax tables, integrations
- Needs audit logs, API access, system health visibility
- Responsible for PCI compliance, backups, updates

### P6 - New Staff Member (Training Context)
- Needs to practice without risk to live data
- Mistakes during training must be fully isolated

---

## 3. PHASE 2 REQUIREMENTS

---

### 3.1 RECEIPTS

#### User Stories

**US-2.1.1 - Cashier: Print Receipt**
As a cashier, after completing a sale, I want to offer the customer a printed receipt so that they have proof of purchase for returns and warranty claims.
- Acceptance: Receipt prints within 3 seconds of payment confirmation
- Acceptance: Receipt contains: store name, address, VAT number, terminal ID, cashier name, date/time, itemised list with SKU, description, qty, unit price, line total, subtotal, discount applied, tax breakdown by rate, total, payment method, change given, transaction ID
- Acceptance: If printer is offline, cashier is prompted with option to email instead; sale is NOT blocked

**US-2.1.2 - Cashier: Email Receipt**
As a cashier, I want to send a receipt to a customer's email address so that customers who prefer paperless options are served.
- Acceptance: If customer profile exists and has an email, it pre-populates; cashier can edit
- Acceptance: Email sends asynchronously; cashier is not blocked waiting for delivery confirmation
- Acceptance: Email receipt is identical in content to printed receipt plus a transaction reference link
- Acceptance: Customer can opt out of marketing at this point without blocking the email receipt

**US-2.1.3 - Customer: Duplicate Receipt**
As a customer returning to the store, I want to request a duplicate receipt so that I can process an insurance or expense claim.
- Acceptance: Manager can reprint any receipt from Sales History within the past 90 days
- Acceptance: Duplicate receipt is watermarked "DUPLICATE" or "REPRINT" with reprint timestamp

**US-2.1.4 - Store Manager: Fiscal Receipt Compliance**
As a store manager, I want all receipts to be sequentially numbered and tamper-evident so that we comply with fiscal reporting obligations.
- Acceptance: Receipt numbers are sequential, gapless, per terminal per business day
- Acceptance: Any void or refund receipt references the original receipt number
- Acceptance: Gap in sequence triggers alert to IT Admin

**Business Rules:**
- BR-2.1.1: Receipt must print or be offered within the same transaction session; cannot be deferred
- BR-2.1.2: Email receipts must be stored/queued locally if network is unavailable and sent on reconnection
- BR-2.1.3: Reprinting a receipt does not create a new financial record
- BR-2.1.4: Receipt numbering resets daily per terminal; format is `{TerminalID}-{YYYYMMDD}-{NNNNNN}`
- BR-2.1.5: VAT breakdown must be shown separately for each tax rate when a transaction contains mixed tax categories

**Edge Cases:**
- EC-2.1.1: Printer paper runs out mid-print - system must detect partial print, alert cashier, offer email alternative without re-processing payment
- EC-2.1.2: Customer gives wrong email address - system must provide a "resend receipt" function accessible from Sales History for 90 days
- EC-2.1.3: Customer claims they never received their receipt but printer shows success - Sales History must show print-attempted timestamp separately from delivery confirmation
- EC-2.1.4: Transaction is completed but power cut occurs before receipt prints - on power restore, system must show last-transaction-unprinted flag and offer reprint
- EC-2.1.5: Email domain is blacklisted (spam trap) - system must show soft warning but allow cashier to override and attempt send

---

### 3.2 CUSTOMER PROFILES (ENHANCED)

#### User Stories

**US-2.2.1 - Cashier: Attach Customer to Transaction**
- Search by name, phone, email, loyalty card number, or barcode scan
- Search results within 1 second; maximum 10 results
- Quick-create (name + phone minimum) without leaving the sale

**US-2.2.2 - Customer: View Purchase History**
- Manager/cashier can look up customer transactions by profile
- Customer consent for data storage captured at profile creation

**US-2.2.3 - Store Manager: Merge Duplicate Profiles**
- Merge requires manager-level permission
- All transactions, points, and store credit combined
- Audited and reversible within 24 hours

**US-2.2.4 - IT Admin: GDPR Compliance**
- Deletion anonymises personal data but retains financial records with pseudonymous ID
- Irreversible; requires admin confirmation with password re-entry
- Logged with timestamp and requesting user

**Business Rules:**
- BR-2.2.1: Explicit consent required for marketing; receipts do not require marketing consent
- BR-2.2.2: Multiple emails allowed but only one primary
- BR-2.2.3: Phone number is preferred deduplication key; warn on duplicates
- BR-2.2.4: Profiles sync to WMS CRM within 60 seconds

**Edge Cases:**
- EC-2.2.1: Same name and phone (family sharing) - allow both; flag for review
- EC-2.2.2: Customer refuses data but wants loyalty - transact without profile; loyalty requires profile
- EC-2.2.3: GDPR-deleted profile referenced in history - show "Customer data deleted on [date]"
- EC-2.2.4: Wrong customer attached to completed sale - Manager can reassign with audit trail

---

### 3.3 PARTIAL REFUNDS & EXCHANGES

#### User Stories

**US-2.3.1 - Cashier: Process Partial Refund**
- Select original transaction, choose line items and quantities to refund
- Pro-rata discount reversal calculated automatically
- Refund to original payment, store credit, or cash (permission-dependent)
- Inventory updated on confirmation

**US-2.3.2 - Cashier: Process Exchange**
- Return + new purchase in one transaction with cross-references
- Price difference handled (customer pays more or gets credit)
- Single workflow; no separate return and sale

**US-2.3.3 - Store Manager: Refund Without Receipt**
- Requires manager override and reason code
- Store credit by default; cash requires additional approval
- Maximum value configurable per store

**Business Rules:**
- BR-2.3.1: Refund cannot exceed original line item value after discounts
- BR-2.3.2: Pro-rata formula: `Refund = Line Price - (Cart Discount % x Line Price)`
- BR-2.3.3: Cash refund for card payment NOT permitted without manager override
- BR-2.3.4: Item can only be refunded once; tracked per line item
- BR-2.3.5: Return window configurable per category (electronics: 14 days, clothing: 30 days, food: not returnable)
- BR-2.3.6: Damaged items routed to damaged-goods location, not sellable stock
- BR-2.3.7: Tax reversed and shown on refund receipt

**Edge Cases:**
- EC-2.3.1: Cross-store return - configurable policy; lookup across all terminals
- EC-2.3.2: Split payment refund - split proportionally or offer store credit
- EC-2.3.3: Discontinued item exchange - allow exchange to any product
- EC-2.3.4: Expired return window - block by default, manager override with reason
- EC-2.3.5: Loyalty points used on returned item - reverse proportional points
- EC-2.3.6: Network drops mid-refund - journal locally; sync on reconnect
- EC-2.3.7: Gift return - store credit to buyer or anonymous voucher

---

### 3.4 LINE-ITEM DISCOUNTS

**Business Rules:**
- Cashier ceiling: configurable per role (default 10%)
- Manager ceiling: configurable (default 25%)
- Above manager ceiling: Regional Manager approval
- Stacks with cart discount; combined ceiling enforced
- Reason codes required; cannot bring below cost without Regional override

---

### 3.5 CONFIGURABLE TAX

**Business Rules:**
- Multiple named rates (Standard 20%, Reduced 5%, Zero 0%, Exempt)
- Assignable at category, product, or customer level (B2B exempt)
- Tax-inclusive and tax-exclusive modes per store
- Discounts applied before tax; rate changes effective-dated

---

### 3.6 Z-REPORT

**Business Rules:**
- Once per terminal per business day; immutable once generated
- Cannot run with active transactions; blocks shutdown without Z-Report
- Configurable business day boundary (e.g., ends at 3am for late-night retail)
- Cash variance captured with mandatory reason codes

---

### 3.7 OFFLINE MODE

**Business Rules:**
- Auto-detect within 10 seconds; local SQLite encrypted storage
- Cash only by default; configurable card floor limit at merchant risk
- UUID per transaction for deduplication; idempotent sync
- Max 4-hour offline window (configurable); catalogue snapshot validity

---

## 4. PHASE 3 - OMNICHANNEL

### 4.1 BOPIS
- BOPIS queue on POS home screen; search by order/name/PIN
- 7-day collection window; auto-cancel with refund at expiry
- Partial collection supported; identity verification required

### 4.2 Ship from Store
- Dedicated queue; pick list with locations; shipping label generation
- 2-hour accept/reject SLA; rejection routes to next store

### 4.3 Real-time Inventory Sync
- "Available to sell" (on-hand minus reserved); configurable sync interval
- Optimistic locking for last-unit scenarios

### 4.4 Transfer Orders
- Request from POS; link customer for "call when arrives" notification
- Status tracking: Requested > Approved > Shipped > Received

---

## 5. PHASE 4 - ADVANCED

### 5.1 Staff Roles & Permissions (RBAC)
### 5.2 Multi-Currency
### 5.3 Loyalty Programme
### 5.4 Gift Cards
### 5.5 Product Bundles
### 5.6 Layaway
### 5.7 Cash Management (Safe Drop, Petty Cash)

---

## 6. PHASE 5 - INTEGRATION

### 6.1 Accounting Integration (Xero, QuickBooks, Sage)
### 6.2 Webhooks (HMAC-SHA256 signed, idempotent)

---

## 7. MISSING FEATURES (RETAILER REALITY CHECK)

### 7.1 Price Override & Price Matching
### 7.2 Age-Restricted Products (Challenge 25)
### 7.3 Weighable / Variable-Weight Products
### 7.4 Training Mode
### 7.5 Customer Pole Display
### 7.6 Multi-Buy Promotions (3 for 2, BOGOF)
### 7.7 Employee Discounts (P11D tracked)
### 7.8 Cash Rounding
### 7.9 Void vs Cancel vs Return (Distinct Workflows)
### 7.10 Till Reconciliation Discrepancy Management
### 7.11 Rain Checks & Backorders
### 7.12 Store Credit

---

## 8. COMPLIANCE & LEGAL

- **PCI-DSS**: Never store PAN/CVV; tokenisation mandatory; TLS 1.2+
- **GDPR**: Right to erasure (anonymise, retain financials 7 years); explicit marketing consent
- **Fiscal**: UK MTD compatibility; EU fiscal printer requirements vary by country
- **Employment**: P11D reporting for staff discounts; Challenge 25 compliance logging

---

## 9. PRIORITY MATRIX (MoSCoW)

### MUST HAVE (Launch Blockers)
| Feature | Rationale |
|---|---|
| Receipts (Print + Email) | Legal requirement |
| Z-Report | Financial close mandatory |
| Configurable Tax | Legal for mixed-category |
| Partial Refunds | Void-only inadequate |
| Line-Item Discounts | Price matching/clearance |
| Offline Mode | Network can't shut store down |
| Age-Restricted Checks | Criminal liability |
| Void/Cancel/Return separation | Audit integrity |
| Training Mode | Required for rollout |
| Cash Rounding | Market-specific requirement |

### SHOULD HAVE (High Business Value)
Customer Profiles, BOPIS, Real-time Inventory, Exchanges, Multi-buy Promotions, Employee Discounts, Store Credit, Cash Management, Till Reconciliation, Ship from Store

### COULD HAVE (Deferrable)
Loyalty, Gift Cards, Multi-Currency, Bundles, Layaway, Pole Display, Weighable Products, Rain Checks

### WON'T HAVE (v1)
Email Marketing, Full Accounting Integration, Multi-language UI, Self-checkout, AI Upsell

---

## 10. OPEN QUESTIONS

1. Primary target market? (Fashion, electronics, grocery, multi-category)
2. Markets outside UK? (EU fiscal compliance varies significantly)
3. Card payment processor? (Determines offline card strategy)
4. White-labelled or single operation? (Multi-tenancy implications)
5. Accounting system for Phase 5? (Journal format design should start now)
6. Existing loyalty programme to migrate from?
