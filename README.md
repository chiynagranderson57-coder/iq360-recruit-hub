# Sports Recruit IQ360™

**This repository is the canonical Sports Recruit IQ360 application codebase.**

It is a standalone production web application operated by BFM. It is **not** the
Athlete Showcase Landing marketing project, shares no code with it, and must
remain a separate codebase and deployment.

Product authority: the locked **November 4, 2026 SRIQ360 software scope**.

## Audiences

- Athletes (record owners)
- Authorized parents/guardians (acting only under an active, revocable consent grant)
- Authorized BFM operations staff (assigned-athlete support scope only)

## Approved capabilities

The product structure is fixed to these capabilities. `src/lib/capabilities.ts`
is the source of truth and maps each one to its route.

1. Identity & guided intake — `/intake`
2. Athlete Intelligence Record — `/record`
3. Guardian & consent — `/guardian`
4. Readiness snapshot — `/readiness`
5. My Plan / Next Best Action — `/plan`
6. Curated discovery — `/discovery`
7. Opportunity comparison — `/compare`
8. AskNavaria360 — `/ask`
9. Resource & pathway library — `/library`
10. Human help request — `/help`
11. Returning-user continuity — cross-cutting, surfaced on `/plan`

## Security defaults (non-negotiable)

- Deny-by-default server-side authorization on every read and write. See
  `src/lib/authorization.ts`; UI checks are never authoritative.
- Row-level authorization at the database layer in addition to application checks.
- Consent and revocation awareness: guardian access ends immediately on revocation.
- Minor/guardian boundaries: minor accounts cannot progress without an active grant.
- No cross-athlete access under any role.
- Private storage only; documents are reached through short-lived signed URLs.
- Audit events for sensitive reads, writes, consent changes, and staff access.
- No fabricated recruiting claims, predictions, offers, or rankings anywhere in the product.
- AI output always discloses uncertainty and its basis.

## Backend binding (intended, not yet connected)

Canonical product data lives in an **existing external Supabase project**:

```
Supabase project ref: lqthjvzjkbwtggrhgpts
```

No new database is provisioned by this repository, and no canonical data is
stored in it yet. Binding happens explicitly after project creation and
source-control verification.

Secrets are never committed here. Credentials (`SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the `VITE_`
client-visible values) are supplied through project secret storage at bind time.

## Stack

TanStack Start (React 19, TypeScript, SSR), Vite, Tailwind CSS v4, shadcn-style UI.

## Development

```sh
npm i
npm run dev
```

## Status

Foundation scaffold only. Not deployed to production. No authentication,
persistence, storage, or AI calls are wired yet.

## Operations

Environments, CI, secrets, feature flags, logging, promotion/rollback and the
access/ownership inventory are documented in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).
Staging does not exist yet; production is published only by the founder.
