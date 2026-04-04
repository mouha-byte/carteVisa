# Sprint 6 Smoke Validation Report

Date: 2026-04-03
Workspace: carte-visitee

## Scope

This run validates backend readiness after Sprint 6 stabilization using:
- integration tests
- lint
- real environment verification
- manual end-to-end API smoke checks with seeded entreprise/admin accounts

## Commands Executed

- `npm run test:integration`
- `npm run lint`
- `powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts/seed-db.ps1`
- Manual smoke sweep via local API + Supabase auth tokens

## Results

### 1) Integration Tests

- Status: PASS
- Files: 4 passed
- Tests: 32/32 passed

### 2) Lint

- Status: PASS
- Command: `npm run lint`

### 3) Environment Verification (`verify-env.ps1`)

- Status: PASS
- Passed:
  - Supabase URL/auth keys present and coherent
  - Supabase REST anon/service checks OK
  - Storage bucket checks OK (`candidate-cv`, `company-media`)
  - Supabase DB TCP check OK (`supabase:db-tcp`) via configured `SUPABASE_DB_URL`
  - Resend API check OK
  - Nominatim check OK

### 4) Seed Data (`seed-db.ps1`)

- Status: PASS (idempotent)
- Users existing: 3
- Categories upserted: 5
- Companies upserted: 2
- Profiles upserted: 3
- Company categories upserted: 2
- Jobs existing: 3

### 5) Manual API Smoke Matrix

Status: PASS (17/17)

- auth:entreprise-login -> 200
- auth:admin-login -> 200
- public:health -> 200
- public:categories -> 200
- public:companies -> 200
- public:jobs -> 200
- public:job-by-id -> 200
- public:contact-post -> 201
- public:site-request-post -> 201
- entreprise:jobs-get -> 200
- entreprise:jobs-post -> 201
- entreprise:job-patch -> 200
- entreprise:applications-get -> 200
- entreprise:application-status-patch -> 200
- entreprise:admin-contact-forbidden -> 403
- admin:contact-messages-get -> 200
- admin:site-requests-get -> 200

## Conclusion

Backend API behavior is stable and validated for public, entreprise, and admin flows in real connected conditions.

No blocking infrastructure caveat remains in the environment checks. Backend can continue with the remaining feature backlog before final frontend implementation.
