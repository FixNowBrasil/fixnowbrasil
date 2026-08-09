# P0 hardening

This document records the first hardening pass for the FixNow MVP.

## Implemented in this branch

- Centralized service-request lifecycle transitions in `src/lib/request-lifecycle.ts`.
- Exposed lifecycle helpers from `src/lib/fixnow.ts` so UI code can reuse one transition map.
- Added GitHub Actions CI to run `npm ci`, lint and production build on pushes and pull requests.
- Kept the changes backend-provider agnostic so they remain compatible with a future move from Lovable Cloud to a dedicated Supabase project.

## Backend protection already present on `main`

The current main branch contains database hardening for:

- role assignment and admin self-registration;
- moderation fields on profiles/providers;
- request ownership;
- request status transitions;
- quote ownership and accepted-quote price changes.

These protections must remain enforced in the database. Client-side lifecycle helpers are convenience/UX protection only and are not a security boundary.

## Still requires backend-side verification

Before real users are admitted, verify in the current Lovable Cloud database:

1. RLS policies for every marketplace table (`profiles`, `providers`, `provider_services`, `service_requests`, `quotes`, `reviews`, `notifications`, `messages`, `addresses`).
2. No client can update another user's records by changing an ID in the request payload.
3. A provider cannot claim or modify another provider's schedule, services or profile.
4. A client cannot advance a request to a provider-only status.
5. Two clients cannot reserve the same provider/time slot concurrently.
6. Public provider queries do not expose private fields.
7. Storage policies prevent users from reading or writing another user's private files.

## Migration rule

Do not add Lovable-specific business logic to the frontend. Database rules should remain portable PostgreSQL/Supabase concepts wherever possible. When the project moves to a dedicated Supabase instance, the schema, RLS, functions and triggers should be migrated as versioned SQL rather than recreated manually.
