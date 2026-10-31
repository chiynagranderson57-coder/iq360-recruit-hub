# Approved staging setup status — 2026-10-31

Founder explicitly approved staging-only permissions, five synthetic accounts and repair testing. Target reverified from branch inventory: staging kpatqovdotkkgvpvgccg, parent lqthjvzjkbwtggrhgpts. No production write performed.

Applied migration sriq12_staging_access_recursion_and_read_permissions through Supabase: success. It contains only the prepared read-permissions script and bounded recursion repair. Before-state grants and policy are recorded in STAGING_BEFORE_APPROVED_SETUP.json. Note pre-existing authenticated UPDATE on athlete_readiness, and pre-existing TRUNCATE/REFERENCES/TRIGGER grants to anon/authenticated/service_role were not introduced or changed by this repair; TRUNCATE bypasses row-level policy and needs separate security review before release. No TRUNCATE operation was performed.

Verified with authenticated SQL context (synthetic unassigned UUID): no recursion and zero visible rows across athlete_access, athletes, guardian_consents, athlete_readiness and user_roles. Helper owned by postgres. Anonymous cannot execute the helper or SELECT athlete_access. One pre-existing staging athlete remains and no fixture/access rows have been created.

Read-only production verification: original recursive policy still present and proposed helper absent. PR #1/lovable-sync were not written by this setup.

Security advisors: existing public.assign_role authenticated-callable SECURITY DEFINER warning remains; no new warning reported. Its authorization guard was inspected in prior validation, but full security review remains open. Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

Auth provisioning is blocked pending dashboard sign-in. Connected Supabase tools have no Auth-admin create-user operation. The available browser currently shows Supabase's account sign-in page. No passwords or privileged API keys were requested in chat or stored in GitHub. Five synthetic Auth accounts and fixture SQL remain pending; real-session and browser tests have NOT passed yet.

A public-key request to the staging REST root returned 401 Secret API key required; this endpoint result is inconclusive for authenticated row endpoints. Verify real staging REST requests with user sessions after account provisioning rather than assuming Data API readiness.

Production repair and merging PR #1 remain prohibited until the remaining checks and review pass.
