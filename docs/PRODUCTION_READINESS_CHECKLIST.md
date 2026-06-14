# Production Readiness Checklist

Batch 72 adds a pre-commercial readiness checklist for the current restaurant automation foundation. It is documentation and safety coverage only. It does not add payments, subscriptions, domains, CRM, email, WhatsApp, payroll, external logging, analytics engines, schema changes, seed data, or production database writes.

## Current Foundation

Core operations foundation through Batch 71 is complete for the current bounded product surface:

- Tenant public reads and public ordering/reservation flows are scoped by restaurantSlug and restaurantId.
- Tenant staff access is separate from platform AdminUser access.
- Tenant admin modules cover menu, gallery, profile, settings, staff records, reservations, tables, order status, kitchen queue, inventory, recipes, manual recipe consumption, suppliers, purchase requests, purchase receiving, purchase invoices, manual invoice payments, read-only reports, and tenant audit logs.
- Tenant audit logs are read-only for OWNER and MANAGER staff and sanitize sensitive metadata.
- Commercial integrations remain future work: real payments/refunds, billing/subscriptions, custom domains, CRM, email/WhatsApp, payroll, advanced analytics, onboarding polish, external logging/SIEM, alerting, and compliance exports.
- Payment provider readiness remains a future commercial expansion. Batch 73 documents provider-neutral payment boundaries, refund workflow planning, and provider launch criteria without implementing real payment processing.

## Required Migration Status

Before production rollout, confirm all migrations through Batch 71 are deployed in order, including:

- `20260611103000_add_supplier_purchase_requests`
- `20260612090000_add_purchase_invoices`
- `20260613090000_add_purchase_invoice_payments`
- `20260613160000_add_restaurant_audit_logs`

Use `_prisma_migrations` for status checks. Do not infer production state from local files alone.

## Environment Variables

Set environment variables by name only in the hosting platform or secret manager. Never store production values in the repository.

- `DATABASE_URL`
- `ADMIN_JWT_SECRET`
- `RESTAURANT_STAFF_JWT_SECRET`
- `COOKIE_DOMAIN`
- `NEXT_PUBLIC_BASE_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Future commercial integrations will add additional secret names only when those integrations are implemented.

## Pre-Deploy Checks

Run these checks before merging a production-bound PR:

- `npm ci`
- `npx prisma generate`
- `npm run lint`
- `npm run build`
- `node scripts/smoke-hardening.js`

Run `prisma migrate deploy only in a deploy gate` with process-scoped environment variables. Do not run migration deploy as part of local development or PR verification unless a deploy task explicitly asks for it.

## Deploy Gate

- Confirm the PR is merged through the PR merge gate.
- Fetch origin and fast-forward local main.
- Confirm main HEAD matches the expected merge commit or a newer intended commit.
- Confirm the target migration directory exists.
- Run `npx prisma generate`.
- Read `DATABASE_URL` into the current process only.
- Run `npx prisma migrate deploy`, using `npx.cmd prisma migrate deploy` on Windows if the npx shim fails.
- Clear the process environment variable immediately after deploy and verification.

## Post-Deploy Smoke Checks

- Open the public restaurant home page for the intended tenant.
- Confirm public menu/gallery content renders from tenant-scoped data.
- Confirm public tenant ordering and reservation checks for initialized, non-archived tenants.
- Confirm demo routes still load for the demo restaurant.
- Confirm tenant staff login checks for OWNER, MANAGER, and SUPPORT roles.
- Confirm tenant admin login checks redirect unauthenticated staff to `/r/[restaurantSlug]/admin/login`.
- Confirm platform admin routes still require the platform admin cookie and do not accept tenant staff sessions.
- Confirm audit log visibility checks: OWNER and MANAGER can view `/r/[restaurantSlug]/admin/audit-logs`; SUPPORT cannot access audit navigation or page content.

## Rollback Notes

Use these rollback notes during deploy review:

- Prefer application rollback before database rollback.
- Do not delete applied migration rows manually.
- If a migration fails, stop and inspect the failed `_prisma_migrations` entry before retrying.
- Keep a record of the deploy commit SHA, migration name, deploy command, and verification result.
- For schema changes, roll forward with a corrective migration unless an explicit database rollback plan has been reviewed.

## Known Future Work

- Real payments/refunds
- Payment provider selection and webhook implementation
- Billing/subscriptions
- Custom domains
- CRM
- Email/WhatsApp
- Payroll
- Advanced analytics
- Onboarding polish
- External logging/SIEM
- Alerting
- Compliance exports
