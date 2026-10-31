# Staging preview — 2026-10-31

Created isolated Vercel project sriq360-staging-review (prj_ACjmUFLwUgBNpU3pRClxoANu3kFI) on existing team team_pIXSBPMDLLrvovYDsok8RlkZ. No new database. Deployment protection enabled for all deployments, custom-domain auto-assignment disabled, no production deployment served.

Initial deployment dpl_BMSXBopv4BZzfvz18et94mRB5zp7 was unexpectedly labeled production despite explicit preview input and immediately canceled. Verified CANCELED before READY. Corrected request by omitting target per API documentation; subsequent deployment dpl_FjKtFFJfLNpjAtEc6dKP48hkkZzq is READY with target null (preview).

Source pinned to reviewed PR #1 commit 033dc127a64b29cfc6bc093c1e031be5a553f5bd. Framework tanstack-start, Node24, frozen Bun lockfile, build bunx vite build --mode staging, NITRO_PRESET=vercel. Preview-only public environment values VITE_APP_ENV=staging, VITE_SUPABASE_URL=https://kpatqovdotkkgvpvgccg.supabase.co, staging publishable key. No private API keys or passwords supplied.

Preview: https://sriq360-staging-review-c6xp96zup-chiynagranderson57-1786.vercel.app/auth

Build successful; generated Nitro Vercel SSR function output. Protected HTTP fetch /auth returned 200 and actual browser sign-in UI rendered. Built auth JS contains staging backend URL. Backend resolver and application logic were not edited. Browser access uses a temporary connector-issued deployment link (not recorded here); application authentication is still required.

This is preview readiness, not completed live-session testing. Next: enter synthetic staging credentials securely, verify Auth issuer and own/cross-athlete behavior, record UI role-mapping findings and remaining security gates. PR #1 is unmerged; original Supabase and older Vercel projects were not changed.
