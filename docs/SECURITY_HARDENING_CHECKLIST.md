# Security Hardening Checklist

This checklist captures the current production-readiness baseline before commercial integrations are added.

## Tenant And Platform Boundaries

- Tenant/staff auth boundaries: restaurant staff use `aldayaa_restaurant_staff`, route through `/r/[restaurantSlug]/admin/login`, and must match the route restaurantSlug.
- Platform admin separation: platform admin users use `aldayaa_admin` and remain separate from RestaurantUser records.
- Tenant operational APIs use DB-backed `requireRestaurantStaffAccess` so the current RestaurantUser, restaurantId, restaurantSlug, role, active state, and tenant status are revalidated.
- Middleware remains lightweight and does not import Prisma.
- The middleware remains lightweight and does not import Prisma.
- Tenant APIs must not use platform `requireAdmin` or `AdminUser`; no AdminUser usage in tenant APIs.
- Platform admin APIs must not use restaurant staff auth.
- No RestaurantUser usage in platform APIs unless clearly intended and reviewed; no RestaurantUser usage in platform APIs unless clearly intended.
- No cross-tenant reads or writes; no cross-tenant reads or writes.
- Public write APIs scoped by restaurantSlug and restaurantId; public write APIs scoped by restaurantSlug and restaurantId.

## Session Cookies

Session cookies should keep these properties:

- `httpOnly`
- `sameSite`
- `secure in production`
- `path scoping`
- domain scoping only through the configured cookie domain when needed

## Audit Logging

- Audit logging covers high-value tenant staff admin writes.
- Audit logs are scoped by restaurantId.
- Audit log review is read-only for OWNER and MANAGER staff.
- Sensitive metadata redaction covers password, passwordHash, session, cookie, token, DATABASE_URL, secret, and related key names.
- No DATABASE_URL in logs; no DATABASE_URL in logs.
- Future external logging/SIEM remains future work.
- Future alerting remains future work.

## Error Handling And Secret Hygiene

- No raw Prisma errors to clients; no raw Prisma errors to clients.
- Do not log database URLs, session tokens, API keys, passwords, or provider secrets.
- Keep environment variables in deployment settings or a managed secret store.
- Do not write production secrets to the repository or generated artifacts.
- Redact request metadata before audit logging.

## Public Routes

- Public tenant ordering is available only for initialized, non-archived tenants when enabled.
- Public tenant reservations remain tenant-scoped.
- Public track/cancel routes must require tenant route data such as restaurantSlug, reference, and phone.
- Demo routes remain demo-scoped.

## Future Security Work

- Add future rate-limiting/WAF at the edge or hosting layer before high-volume production traffic.
- Add future external logging/SIEM after a provider and redaction policy are selected.
- Add alerting and compliance exports only after audit log retention, access policy, and customer requirements are defined.
- Payment provider controls remain future work and must include signature verification, idempotency, tenant scoping, no raw card data, and no secrets in logs before real money movement is implemented.
- Add payment, billing, domain, CRM, payroll, tax, accounting, email, and WhatsApp controls only with their corresponding integrations.
