# Refund Workflow Plan

Batch 73 documents refund workflow boundaries only. No refund implementation is included in this batch. No provider API calls are included in this batch.

## Refund States

These refund states are planning labels only until a reviewed refund model exists.

Future refund records should use explicit refund states so money movement and tenant support actions are reviewable:

- `REQUESTED`: a refund was requested by staff or a future customer support workflow.
- `UNDER_REVIEW`: an authorized staff member is reviewing eligibility, order state, and policy.
- `APPROVED`: a permitted staff member approved the refund before provider submission.
- `REJECTED`: the refund was reviewed and rejected with a safe internal reason.
- `SUBMITTED`: the refund was submitted to the selected provider.
- `CONFIRMED`: the provider confirmed the refund.
- `FAILED`: the provider rejected or failed the refund.
- `CANCELLED`: the request was cancelled before provider submission.

State names are planning placeholders. They should not be treated as implemented runtime behavior.

## Approval Boundaries

These approval boundaries should keep refund request, approval, and provider submission as separate actions.

Refund approval boundaries should be explicit before implementation:

- OWNER or a future finance role approves high-value refunds.
- MANAGER may be allowed to request or approve bounded operational refunds only after policy is defined.
- SUPPORT should remain read-only or request-only unless a future policy explicitly grants approval rights.
- Provider submission must be separate from request creation.
- Refunds must be tenant-scoped by restaurantId and tied to the original payment/order/invoice context.
- Refunds must not be inferred from manual invoice payment records because those records do not process real money.

## Audit Requirements

These audit requirements keep refund decisions reviewable without exposing secrets or card data.

Refund workflows should audit:

- refund request creation
- approval or rejection
- provider submission
- provider confirmation or failure
- manual cancellation
- status correction by authorized staff

Audit metadata should be safe and minimal: tenant id, entity ids, status transitions, actor id/email, provider reference id when available, and reason category. Do not log raw card data, provider secrets, private customer payment details, cookies, sessions, or full provider payloads.

## Safety Requirements

- Require idempotency for provider submission.
- Require signature verification for provider callback handling.
- Keep refund status changes tenant-scoped.
- Keep refund state separate from manual invoice payment recordkeeping.
- Preserve immutable provider references after confirmation.
- Do not create negative payment records as a substitute for refunds.

## Explicit Non-Goals For Batch 73

- No refund API route.
- No refund button or UI.
- No provider call.
- No webhook handler.
- No money movement.
- No database migration.
- No secret values.
