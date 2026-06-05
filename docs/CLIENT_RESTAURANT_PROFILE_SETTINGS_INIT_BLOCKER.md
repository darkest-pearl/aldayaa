# Client Restaurant Profile/Settings Initialization Blocker

Client restaurant profile/settings initialization was blocked by singleton RestaurantProfile schema.

Blocker status: resolved by Batch 44 schema migration.

Initialization action status: added in Batch 45.

Batch 43 inspected the current tenant foundation before adding an initialization action for non-demo restaurants. The safe implementation was blocked because the profile/settings models still carried singleton identity from the original demo app:

- `RestaurantProfile.id` is `Int @id @default(1)`.
- `RestaurantSettings.id` is `Int @id @default(1)`.

That shape was safe for the existing Demo Restaurant singleton behavior, but it was not safe for creating one profile/settings pair per client restaurant. A platform action that created rows for `test-restaurant` or any future client would either collide with the singleton `id = 1` default or require ad hoc manual IDs that were not supported by the schema contract.

Batch 44 changes the schema so the identity blocker is removed:

- RestaurantProfile.id now uses `autoincrement()`.
- RestaurantSettings.id now uses `autoincrement()`.
- Each model has a unique `restaurantId` constraint while `restaurantId` remains nullable during the transition.
- The Demo Restaurant rows remain backfilled to `restaurantId = demo-restaurant`.

one profile/settings row per restaurant is now possible at the schema level.

Batch 45 adds a focused platform-admin initialization action for non-demo Restaurant tenants:

- creates only missing `RestaurantProfile` and/or `RestaurantSettings` rows
- uses the Restaurant row as the target tenant anchor
- does not overwrite existing profile/settings rows
- does not create menu, gallery, order, reservation, inventory, recipe, AdminUser, or GatewayLead rows
- does not activate non-demo `/r/[slug]` public routes

## Remaining boundaries

Full provisioning is still not implemented. The next provisioning batches still need to stay isolated and deliberate:

- preserve existing Demo Restaurant behavior at `/public`, `/r/demo-restaurant`, `/admin`, and `/platform-admin`
- keep non-demo ordering inactive until tenant-aware write APIs are added
- create menus, gallery content, restaurant admin users, domains, and write/public ordering activation only in later explicit batches
- continue avoiding billing, payments, subscriptions, CRM automation, email sending, and WhatsApp sending
