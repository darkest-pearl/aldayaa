# Tenant Admin Access Foundation

Foundation status: first-owner login resolved by Batch 50; tenant menu/gallery management resolved by Batch 51; tenant profile/settings management resolved by Batch 52; tenant staff management foundation resolved by Batch 53; tenant reservations management resolved by Batch 54; tenant table management foundation resolved by Batch 55; tenant order API boundary foundation resolved by Batch 56; tenant public order creation resolved by Batch 57; tenant table QR ordering resolved by Batch 58; tenant public order support actions resolved by Batch 59; tenant public reservation support actions resolved by Batch 60; tenant kitchen queue operations resolved by Batch 61; tenant inventory management foundation resolved by Batch 62; tenant recipe and ingredient linkage foundation resolved by Batch 63; tenant recipe consumption preview resolved by Batch 64; tenant manual recipe consumption apply resolved by Batch 65; tenant supplier and purchase request foundation resolved by Batch 66; tenant purchase receiving stock intake resolved by Batch 67; tenant purchase invoice recording foundation resolved by Batch 68; tenant purchase invoice payment recording foundation resolved by Batch 69; tenant operations reporting foundation resolved by Batch 70; tenant audit logging and security hardening foundation resolved by Batch 71; production readiness checklist documented by Batch 72; tenant payment settings foundation resolved by Batch 74.

Batch 48 identified that the original platform `AdminUser` model could not safely represent restaurant-scoped tenant staff. `AdminUser` remains global and platform-owned.

Batch 49 adds a separate RestaurantUser model. This keeps platform ownership and restaurant staff access in different tables.

Batch 50 adds first-owner provisioning and restaurant staff login. Batch 51 adds tenant-scoped menu/gallery management. Batch 52 adds tenant-scoped profile/settings management. Batch 53 adds OWNER-only tenant staff management for RestaurantUser records. Batch 54 adds tenant-scoped reservation viewing, status management, and public tenant reservation creation. Batch 55 adds tenant-scoped table management for table labels, zones, seats, active state, and QR token references without activating tenant table ordering. Batch 56 adds tenant-scoped order reads and status management without activating public tenant ordering. Batch 57 activates tenant-safe public order creation for initialized, non-archived tenants when ONLINE_ORDERING is enabled. Batch 58 activates tenant-safe table QR ordering for initialized, non-archived tenants when ONLINE_ORDERING and TABLE_QR_ORDERING are enabled. Batch 59 adds tenant-scoped public order tracking and cancellation using restaurantSlug, reference, and phone. Batch 60 adds tenant-scoped public reservation lookup and cancellation using restaurantSlug, reference, and phone. Batch 61 adds tenant-scoped kitchen queue and active order prep status management. Batch 62 adds tenant-scoped inventory item management and manual inventory movement tracking. Batch 63 adds tenant-scoped recipe/ingredient linkage between menu items and inventory items. Batch 64 adds tenant-scoped read-only recipe consumption preview for orders. Batch 65 adds OWNER/MANAGER-only manual recipe consumption apply from the tenant kitchen preview. Batch 66 adds tenant-scoped supplier records and manual purchase request creation/status tracking. Batch 67 adds OWNER/MANAGER-only full purchase request receiving that increments tenant inventory and creates tenant-scoped stock-in inventory movements. Batch 68 adds tenant-scoped purchase invoice recording with invoice lines, optional supplier links, optional purchase request links, and status tracking. Batch 69 adds tenant-scoped manual payment records for purchase invoices with payment summaries and void-only correction. Batch 70 adds tenant-scoped read-only operations reports with date period filters. Batch 71 adds tenant-scoped audit logging for high-value tenant staff admin writes and read-only OWNER/MANAGER audit log review. Batch 72 adds production readiness, deployment, secrets rotation, and security checklist documentation. Batch 74 adds tenant-scoped payment settings for disabled/planned-only provider readiness.

- platform ADMIN users can create the first OWNER `RestaurantUser` for initialized non-demo tenants
- restaurant staff sign in through `/r/[restaurantSlug]/admin/login`
- the login API is `/api/restaurant-admin/login`
- restaurant staff sessions use `aldayaa_restaurant_staff`, not `aldayaa_admin`
- restaurant staff session payloads include restaurantId and restaurantSlug
- tenant staff sessions cannot access `/platform-admin`

## Current Boundaries

- Platform `AdminUser` remains separate from `RestaurantUser`.
- First OWNER creation does not create or modify `AdminUser`.
- Demo Restaurant admin behavior is not modified.
- GatewayLead remains platform-owned.
- Restaurant staff access now includes tenant-scoped menu, gallery, profile, settings, staff management foundation, reservations management, table management foundation, order status management foundation, kitchen queue operations, inventory management foundation, recipe/ingredient linkage foundation, recipe consumption preview, supplier records, manual purchase requests, purchase invoice recording, manual purchase invoice payment records, payment settings foundation, read-only operations reports, tenant audit logs, public tenant order creation when enabled, tenant table QR ordering when enabled, tenant public order support actions, and tenant public reservation support actions.
- OWNER users can create, edit, deactivate, and manually reset passwords for RestaurantUser records in their own restaurant.
- MANAGER and SUPPORT users remain read-only for staff management.
- OWNER and MANAGER users can update reservation status; SUPPORT remains read-only for reservations.
- Public reservation creation is tenant-scoped for initialized, non-archived tenants at `/r/[restaurantSlug]/reservations`.
- OWNER and MANAGER users can create, update, and deactivate table records; SUPPORT remains read-only for tables.
- OWNER and MANAGER users can update order status; SUPPORT remains read-only for orders.
- Tenant kitchen queue reads and status updates are scoped by restaurantId.
- Tenant inventory reads, item updates, soft deactivation, and manual movements are scoped by restaurantId.
- Tenant recipe reads, ingredient mapping updates, menu item validation, and inventory item validation are scoped by restaurantId.
- Tenant recipe linkage exposes estimated cost and linked stock visibility only; it does not deduct stock or create inventory movements.
- Tenant recipe consumption preview is read-only, scoped by restaurantId, and shows required ingredient quantities, missing mappings, and current stock warnings.
- Batch 65 adds manual tenant recipe consumption apply from the kitchen preview.
- Manual apply is OWNER/MANAGER-only, transactional, idempotent, and scoped by restaurantId.
- Manual apply creates scoped stock decrements, inventory movements, and order recipe consumption records.
- Tenant supplier records are scoped by restaurantId, can be deactivated without hard delete, and are internal references only.
- Manual purchase requests are scoped by restaurantId, validate tenant supplier ownership, and validate tenant inventory item ownership for every line.
- Purchase requests track status and line items only; they do not mutate stock, create inventory movements, or send anything to vendors.
- Batch 67 adds OWNER/MANAGER-only full purchase request receiving that increments tenant inventory and creates tenant-scoped stock-in inventory movements.
- Purchase receiving is transactional, scoped by restaurantId, and marks the purchase request RECEIVED.
- Partial purchase receiving remains future work until purchase request lines track received quantities.
- Batch 68 adds tenant-scoped purchase invoice recording with invoice lines, optional supplier links, optional purchase request links, and status tracking.
- Purchase invoice recording validates tenant ownership for supplier, purchase request, and linked inventory item references.
- Purchase invoices do not mutate stock, create inventory movements, create payments/refunds, or send anything to vendors.
- Payment records are scoped by restaurantId, validate purchase invoice ownership, and cannot overpay the scoped invoice balance.
- Void payment records are excluded from purchase invoice paid amount and balance calculations.
- Payment recording is manual recordkeeping only; it does not process real payments, create refunds, mutate stock, create inventory movements, or send anything to vendors.
- Read-only operations reports are scoped by restaurantId and use date period filters for operational summaries.
- Reporting does not mutate orders, reservations, inventory, purchase requests, purchase invoices, payment records, or supplier records.
- Reporting is summary-only; advanced analytics, forecasting, BI exports, and scheduled reports remain future work.
- Batch 71 adds tenant-scoped audit logging for high-value tenant staff admin writes.
- Audit logs are scoped by restaurantId, sanitize sensitive metadata, and are read-only for OWNER and MANAGER staff.
- Audit logging does not connect to external logging/SIEM, alerting, compliance exports, email/WhatsApp alerts, billing, domains, CRM, payroll, accounting/tax automation, analytics engines, or production secrets rotation.
- The core operations foundation is complete through Batch 71; Batch 72 documents production readiness, deployment, secrets rotation, and security hardening checks before commercial integrations.
- The tenant payment settings foundation stores planned/disabled provider readiness only; it does no real payment processing, makes no provider calls, and keeps no secrets stored in database records.
- Public tenant order creation is tenant-scoped for initialized, non-archived tenants when ONLINE_ORDERING is enabled.
- Tenant table QR ordering is tenant-scoped for initialized, non-archived tenants when ONLINE_ORDERING and TABLE_QR_ORDERING are enabled.
- Tenant public order tracking and cancellation are tenant-scoped by restaurantSlug, reference, and phone.
- Tenant public reservation lookup and cancellation are tenant-scoped by restaurantSlug, reference, and phone.
- Assisted ordering, payments, refunds, messaging, advanced guest automation, advanced kitchen automation, automatic recipe depletion, order inventory consumption, automatic supplier sending, invoice automation, staff invitations, self-service password reset flows, external logging/SIEM, alerting, compliance exports, production secrets rotation, advanced analytics, forecasting, BI exports, scheduled reports, billing, domains, CRM, payroll, email, and WhatsApp automation remain future work.
- No email or WhatsApp sending is connected to first-owner creation.
- No billing, subscription, payment, provisioning, custom domain, or subdomain logic is connected to first-owner creation or tenant staff management.

## Future Work

Future tenant admin batches can build on this foundation by adding additional scoped operational modules. Each module should verify:

- the staff session belongs to the route restaurantSlug
- the staff role is allowed for the specific operation
- every read/write query is scoped by restaurantId
- tenant staff cannot access `/platform-admin`
- platform-only data such as GatewayLead remains platform-owned

Assisted ordering, payments, refunds, messaging, advanced guest automation, advanced kitchen automation, automatic recipe depletion on order creation/status changes, automatic supplier sending, invoice automation, staff invitations, self-service password reset flows, external logging/SIEM, alerting, compliance exports, production secrets rotation, advanced analytics, forecasting, BI exports, scheduled reports, billing, domains, CRM, payroll, email, and WhatsApp automation remain future work.
