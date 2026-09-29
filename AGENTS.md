<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Sports Recruit IQ360 — architecture rules

- This repo is the canonical SRIQ360 application only; never merge in or mirror the Athlete Showcase Landing marketing project, so the two codebases stay independently deployable.
- `src/lib/capabilities.ts` is the single registry of approved capabilities and their routes; add a capability there before building it, so scope stays locked to the Nov 4, 2026 authority.
- All athlete-scoped access decisions go through `decideAthleteAccess` in `src/lib/authorization.ts` and are enforced server-side, because deny-by-default must not depend on UI checks.
- Canonical product data belongs to the external Supabase project `lqthjvzjkbwtggrhgpts`; never provision a second database for it, to keep one system of record.
- Colors, fonts, and elevation come from tokens in `src/styles.css`; components must not hardcode color utilities so theming stays centralized.
