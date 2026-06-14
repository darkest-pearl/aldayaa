# Deployment Runbook

This runbook covers safe deployment for the current Next.js, Prisma, and PostgreSQL application. It assumes the PR has already passed review and CI-equivalent local checks.

## PR Merge Gate

Every production deploy starts with a PR merge gate:

- Confirm the target PR is open.
- Confirm the expected PR head SHA.
- Confirm GitHub reports the PR mergeable.
- Merge using the repository default merge method.
- Fetch origin main.
- Switch to local `main`.
- fast-forward local main with `git merge --ff-only origin/main`.
- Confirm the local main HEAD matches origin main.
- Confirm the worktree is clean.

## Application Deploy Sequence

- Confirm the deploy commit SHA.
- Install dependencies with `npm ci` in the build environment.
- Run `npx prisma generate`.
- Run `npm run lint`.
- Run `npm run build`.
- Deploy the application artifact through the hosting provider.
- Do not run seed unless explicitly planned and reviewed.

## Migration Deploy Sequence

Run migrations only in a deploy gate.

- Fetch origin and fast-forward local main.
- Confirm main HEAD is the expected merge commit or newer intended commit.
- Confirm the migration directory exists.
- Run `npx prisma generate`.
- Read `DATABASE_URL` into the current process only.
- Run `npx prisma migrate deploy`.
- If the Windows npx shim fails, retry only the deploy command with `npx.cmd prisma migrate deploy`.
- Run read-only verification checks.
- Clear the process variable with `Remove-Item Env:DATABASE_URL`.

## Safe PowerShell DATABASE_URL Pattern

Use this pattern in a local PowerShell process. Do not paste the value into chat.

```powershell
$secureDatabaseUrl = Read-Host "Paste DATABASE_URL for this process only" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureDatabaseUrl)
try {
  $env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

try {
  npx prisma migrate deploy
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
```

If PowerShell secure input is unavailable in the current host, use masked local input with no echo, keep the value only in `Env:DATABASE_URL`, and clear it in `finally`.

## Verification Query Checklist

Do not print secrets while verifying database state.

- `_prisma_migrations` includes the expected migration name.
- Newly introduced tables exist.
- Required columns are `NOT NULL`.
- Expected indexes exist.
- Expected foreign keys use the documented delete behavior.
- Run row-count verification for newly introduced tables.
- Confirm newly introduced table row counts match the deploy plan, usually `0` for foundation tables.

## No-Seed Boundary

No seed unless explicitly planned. Production seed actions must name exact rows, ownership boundaries, rollback steps, and verification checks before execution.

## Rollback

- Prefer reverting application code first.
- Do not manually edit `_prisma_migrations`.
- If a migration fails, preserve the failed state for inspection.
- Use corrective forward migrations for schema changes unless a reviewed database rollback is safer.
