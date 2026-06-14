# Payment Provider Readiness Checklist

Batch 73 records readiness criteria for a future payment provider integration. It does not select a provider and does not implement real payment processing.

## Provider Account Setup Checklist

This provider account setup checklist must be completed before any provider-specific implementation starts.

- Choose the first payment area to implement: customer online order payments, tenant subscription billing, invoice/manual payment reconciliation, or refunds.
- Select the provider only after legal, settlement, currency, payout, and operational requirements are reviewed.
- Confirm supported countries, currencies, settlement timing, fees, and dispute handling.
- Confirm the provider supports webhook signature verification and idempotency.
- Confirm provider dashboard roles and least-privilege access.
- Confirm how provider references map to tenant-scoped application records.

## Test/Live Mode Separation

This test/live mode separation keeps provider testing isolated from production money movement.

- Keep test and live provider accounts or modes separate.
- Keep test and live keys separate in hosting provider secret settings.
- Never reuse live keys in local development.
- Verify UI copy and operational reports distinguish test activity from live activity before launch.
- Plan a live-mode smoke test that uses a reviewed, reversible, low-risk flow.

## Webhook Endpoint Planning

This webhook endpoint planning section defines the minimum safety requirements for any future provider callback route.

- Define accepted event types before creating any route.
- Require signature verification before trusting event data.
- Require idempotency for repeated provider events.
- Store provider event ids or equivalent replay guards.
- Resolve tenant scoping from trusted application references.
- Reject events that cannot be scoped to a tenant.
- Avoid logging full webhook payloads.
- Document retry behavior and manual recovery steps.

## Secret Rotation Rules

These secret rotation rules apply to future provider credentials and webhook signing secrets.

- Store provider secrets only in the hosting provider secret settings or approved secret manager.
- Rotate `PAYMENT_SECRET_KEY` and `PAYMENT_WEBHOOK_SIGNING_SECRET` after suspected exposure.
- Update `PAYMENT_PUBLIC_KEY` only through the same reviewed deploy path.
- Deploy or restart after changing provider secrets.
- Verify the app uses the new keys before revoking old keys.
- Never paste provider secrets into chat, tickets, PRs, screenshots, logs, or documentation.

## PCI/Card-Data Boundary

This PCI/card-data boundary keeps raw card data out of the application.

- Use provider-hosted or provider-tokenized card entry when real card collection is implemented.
- Do not store raw card data.
- Do not send raw card data through application API routes.
- Do not log card numbers, CVC values, magnetic stripe data, or provider secrets.
- Keep payment method display values limited to safe summaries returned by the provider.

## Audit/Logging Expectations

These audit/logging expectations apply to future payment and refund lifecycle events.

- Audit logging must record payment lifecycle status transitions and refund approval actions.
- Logs and audit metadata must include tenant-scoped application ids and safe provider references only.
- Logs must not include secrets, raw card data, cookies, sessions, or full provider payloads.
- Failed provider calls should return safe client messages and preserve enough internal context for support review without leaking provider internals.

## Tenant-Scoped Reconciliation Requirements

These tenant-scoped reconciliation requirements prevent cross-tenant payment matching.

- Every provider transaction must map to a restaurantId before changing application state.
- Reconciliation must distinguish customer order payments, tenant subscription billing, invoice/manual payment reconciliation, and refunds.
- Manual purchase invoice payment records must remain separate from real provider payments unless a future reviewed reconciliation model links them.
- Reports must not combine currencies unless explicitly grouped by currency.
- Cross-tenant provider references must be rejected.

## Launch Checklist

This launch checklist must pass before production payment provider activation.

- Provider contract and account are approved.
- Test-mode flow passes with signature verification and idempotency.
- Live secrets are installed through approved secret management.
- Webhook endpoint is deployed with replay protection.
- Audit events are visible to authorized tenant staff.
- Refund approval policy is documented.
- Operator runbook includes rollback and provider-dashboard verification.
- No raw card data touches application servers.
- Production smoke checks pass after launch.
