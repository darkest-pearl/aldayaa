# Client Restaurant Profile/Settings Initialization Blocker

Client restaurant profile/settings initialization blocked by singleton RestaurantProfile schema.

Batch 43 inspected the current tenant foundation before adding an initialization action for non-demo restaurants. The safe implementation is blocked because the current profile/settings models still carry singleton identity from the original demo app:

- `RestaurantProfile.id` is `Int @id @default(1)`.
- `RestaurantSettings.id` is `Int @id @default(1)`.

That shape is safe for the existing Demo Restaurant singleton behavior, but it is not safe for creating one profile/settings pair per client restaurant. A platform action that creates rows for `test-restaurant` or any future client would either collide with the singleton `id = 1` default or require ad hoc manual IDs that are not supported by the schema contract.

Do not initialize per-restaurant profile/settings rows yet.

## Next safe migration

The next safe step is a focused schema migration that makes profile/settings identity tenant-safe while preserving existing Demo Restaurant behavior.

Recommended migration batch:

- make profile/settings identity tenant-safe with generated IDs or a tenant-specific unique key
- add `@@unique([restaurantId])` where one profile/settings row per restaurant is intended
- backfill Demo Restaurant profile/settings rows to `restaurantId = demo-restaurant`
- preserve existing Demo Restaurant behavior at `/public`, `/r/demo-restaurant`, `/admin`, and `/platform-admin`
- update profile/settings helpers after the schema supports tenant-safe lookup

Keep that migration isolated. It should not create menus, gallery content, orders, reservations, inventory, recipes, admin users, custom domains, billing, payments, CRM automation, email sending, or WhatsApp sending.
