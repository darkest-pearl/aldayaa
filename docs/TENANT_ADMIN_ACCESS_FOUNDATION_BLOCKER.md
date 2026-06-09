# Tenant Admin Access Foundation

Foundation status: first-owner login resolved by Batch 50; operational tenant admin modules remain future work.

Batch 48 identified that the original platform `AdminUser` model could not safely represent restaurant-scoped tenant staff. `AdminUser` remains global and platform-owned.

Batch 49 adds a separate RestaurantUser model. This keeps platform ownership and restaurant staff access in different tables.

Batch 50 adds first-owner provisioning and restaurant staff login.

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
- Restaurant staff login is authentication-only for now.
- Menu, gallery, orders, reservations, settings, inventory, recipes, staff management, and other tenant admin modules are not enabled yet.
- No email or WhatsApp sending is connected to first-owner creation.
- No billing, subscription, payment, provisioning, custom domain, or subdomain logic is connected to first-owner creation.

## Future Work

Future tenant admin batches can build on the Batch 50 foundation by adding scoped operational modules. Each module should verify:

- the staff session belongs to the route restaurantSlug
- the staff role is allowed for the specific operation
- every read/write query is scoped by restaurantId
- tenant staff cannot access `/platform-admin`
- platform-only data such as GatewayLead remains platform-owned

Broader staff management, password reset flows, invitations, audit logging, and operational tenant admin tools remain future work.
