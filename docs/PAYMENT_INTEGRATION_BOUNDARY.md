# Payment Integration Boundary

Batch 73 defines a provider-neutral architecture for future payment work. It is planning and boundary documentation only. It does not add real payment processing, refunds, provider webhooks, checkout sessions, subscription charging, provider SDKs, schema changes, seed data, or production database writes.

## Provider-Neutral Architecture

Future payment work should keep payment orchestration behind internal application boundaries instead of coupling order, invoice, or tenant admin routes directly to a provider. The provider adapter should receive normalized application intent, return normalized provider references, and never expose provider secrets or raw provider payloads to UI code.

The intended layers are:

- Application intent: customer order payment, tenant subscription billing, invoice/manual payment reconciliation, or refunds.
- Tenant boundary: restaurantId, restaurantSlug, actor role, and feature enablement are resolved before any provider action.
- Provider adapter: maps normalized intent to the selected provider and hides provider-specific API details.
- Persistence boundary: records provider references, status changes, idempotency keys, audit events, and tenant ownership.
- Reconciliation boundary: compares provider-confirmed money movement with application records without changing tenant operational data unexpectedly.

Future provider candidates are placeholders only. No provider is selected or implemented in this batch.

## Supported Future Payment Areas

- customer online order payments: collect customer payment for public tenant orders after order validation and tenant scoping.
- tenant subscription billing: bill restaurants for platform subscription packages after billing/product rules are designed.
- invoice/manual payment reconciliation: reconcile manually recorded purchase invoice payments with bank/provider confirmations while preserving the existing manual recordkeeping workflow.
- refunds: request, approve, execute, and audit refunds through a dedicated workflow with provider confirmation.

## Manual Recording Versus Real Processing

Manual payment recording, including manual purchase invoice payment recording, is internal recordkeeping only. This manual payment recording tracks a tenant staff-entered payment note against a purchase invoice and does not contact a payment provider, move money, authorize cards, capture funds, create refunds, or reconcile bank statements.

Real payment processing is future work. It must use a provider adapter, explicit tenant scoping, idempotency, signature verification for provider callbacks, and audit logging before it can move money or update payment state from provider events.

## Required Future Audit Events

Future payment implementation should audit high-value payment actions with tenant-scoped metadata and no secrets:

- payment intent created
- payment authorization succeeded or failed
- payment capture succeeded or failed
- payment webhook accepted or rejected
- payment reconciliation matched or flagged
- refund requested
- refund approved or rejected
- refund submitted to provider
- refund confirmed or failed
- payment provider configuration changed

Audit metadata should include tenant identifiers already known to the app, application entity ids, provider reference ids, status transitions, actor information when user-triggered, and safe timestamps. Do not log provider secrets, card data, full provider payloads, session tokens, cookies, or private credentials.

## Required Webhook Safety

Future webhook endpoints must be designed before implementation and must include:

- signature verification before parsing provider events as trusted.
- idempotency for every event and every application state transition.
- tenant scoping derived from trusted application references, not from untrusted display values.
- no raw card data stored, logged, or returned to clients.
- no secrets in logs, audit metadata, error responses, or analytics.
- replay protection using provider event ids and application idempotency records.
- least-privilege handling for each event type.
- safe failure behavior that preserves evidence and avoids duplicate money movement.

No webhook route that processes payments is included in this batch.

## Environment Variable Names

Future provider configuration should use environment variable names only in code and documentation until a provider is selected. Values must live only in the hosting provider secret settings or approved secret manager.

- `PAYMENT_PROVIDER`
- `PAYMENT_MODE`
- `PAYMENT_PUBLIC_KEY`
- `PAYMENT_SECRET_KEY`
- `PAYMENT_WEBHOOK_SIGNING_SECRET`
- `PAYMENT_SUCCESS_URL`
- `PAYMENT_CANCEL_URL`

These names are placeholders only. No secret values or sample secret values are included here.

## Explicit Non-Goals For Batch 73

- No real payment processing.
- No checkout/session creation.
- No refunds.
- No provider API calls.
- No webhook processing.
- No billing or subscription charging.
- No provider SDK dependency.
- No migration.
- No production database access.
