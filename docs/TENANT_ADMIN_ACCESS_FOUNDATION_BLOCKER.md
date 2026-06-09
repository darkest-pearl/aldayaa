# Tenant Admin Access Foundation

Foundation status: first-owner login resolved by Batch 50; tenant menu/gallery management resolved by Batch 51; tenant profile/settings management resolved by Batch 52; tenant staff management foundation resolved by Batch 53.

Batch 48 identified that the original platform `AdminUser` model could not safely represent restaurant-scoped tenant staff. `AdminUser` remains global and platform-owned.

Batch 49 adds a separate RestaurantUser model. This keeps platform ownership and restaurant staff access in different tables.

Batch 50 adds first-owner provisioning and restaurant staff login. Batch 51 adds tenant-scoped menu/gallery management. Batch 52 adds tenant-scoped profile/settings management. Batch 53 adds OWNER-only tenant staff management for RestaurantUser records.

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
- Restaurant staff access now includes tenant-scoped menu, gallery, profile, settings, and staff management foundation.
- OWNER users can create, edit, deactivate, and manually reset passwords for RestaurantUser records in their own restaurant.
- MANAGER and SUPPORT users remain read-only for staff management.
- Orders, reservations, inventory, recipes, staff invitations, audit logging, password reset flows, and other advanced tenant admin modules remain future work.
- No email or WhatsApp sending is connected to first-owner creation.
- No billing, subscription, payment, provisioning, custom domain, or subdomain logic is connected to first-owner creation or tenant staff management.

## Future Work

Future tenant admin batches can build on this foundation by adding additional scoped operational modules. Each module should verify:

- the staff session belongs to the route restaurantSlug
- the staff role is allowed for the specific operation
- every read/write query is scoped by restaurantId
- tenant staff cannot access `/platform-admin`
- platform-only data such as GatewayLead remains platform-owned

Orders, reservations, inventory, recipes, staff invitations, audit logging, self-service password reset flows, billing, domains, email, and WhatsApp automation remain future work.
