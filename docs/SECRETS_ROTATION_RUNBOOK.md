# Secrets Rotation Runbook

Use this runbook when preparing production, responding to suspected exposure, or rotating credentials after development work. This document contains placeholders only and never includes real secret values.

## Rules

- Do not paste DATABASE_URL into chat or transcripts.
- Do not paste any production secret into chat, tickets, issue comments, pull requests, screenshots, or logs.
- Use a process-scoped environment variable for migration deploy.
- Never write production DATABASE_URL to the repo, `.env`, local notes, shell history, or generated reports.
- Store production values only in the hosting provider, managed secret store, or approved password manager.
- Rotate credentials after any suspected exposure.

## Rotate Database Access

- Create a new production database credential in the database provider.
- Update the hosting platform secret named `DATABASE_URL`.
- Restart or redeploy the app so new connections use the rotated credential.
- Verify app boot after rotation.
- Run a read-only health check that does not print the connection string.
- Revoke the old database credential.
- Verify old credentials are revoked by confirming old application instances can no longer connect after rollout.
- Verify `_prisma_migrations` after deploy when a migration deploy is part of the same change.

## Rotate Auth And Session Secrets

- Rotate `ADMIN_JWT_SECRET` with at least 32 random characters.
- Rotate `RESTAURANT_STAFF_JWT_SECRET` separately from the platform admin secret.
- Expect existing platform admin and tenant staff sessions to be invalidated.
- Restart or redeploy the app after updating each secret.
- Verify platform admin login works.
- Verify tenant staff login works for OWNER, MANAGER, and SUPPORT roles.
- Verify logout clears the corresponding session cookie.

## Rotate Manually Provisioned Credentials

- Rotate platform admin credentials if manually provisioned.
- Rotate first OWNER tenant credentials if a tenant requests it.
- Prefer application-supported password reset/update flows where available.
- Do not send passwords through chat or issue comments.
- Confirm old credentials no longer authenticate.

## Rotate Third-Party API Keys

Third-party integrations are not part of the current commercial workflow. If later added, rotate each provider key in this order:

- Create the replacement key in the provider console.
- Update the hosting platform secret by name.
- Redeploy or restart the app.
- Verify the integration with a non-destructive smoke check.
- Revoke the old key.
- Record the key name, provider, rotation date, and verifier, but not the key value.

## Migration Deploy Secret Handling

For migration deploys, read the database URL into the current shell process only. Clear it immediately after deploy and verification.

- Use secure or masked local input.
- Keep the value only in `Env:DATABASE_URL`.
- Run `npx prisma migrate deploy` or the documented Windows fallback.
- Run read-only verification checks.
- Clear `Env:DATABASE_URL` in `finally`.
- Confirm the parent shell does not retain the variable.

## Verification Checklist

- App boots after rotation.
- Platform admin login succeeds with rotated credentials.
- Tenant staff login succeeds with rotated secrets.
- Old credentials are revoked.
- `_prisma_migrations` status is readable after deploy.
- No secret value appears in logs, docs, commits, pull requests, or chat transcripts.
