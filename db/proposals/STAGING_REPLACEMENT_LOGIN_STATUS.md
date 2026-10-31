# Replacement staging login — 2026-10-31

Confirmed synthetic account sriq12-staging-athlete-a2@example.com, UUID 7e5bcc5e-b167-43d8-8665-3f39a6a1f99e. Moved exactly one existing student_athlete assignment, access row 011ec9ac-7168-45eb-bd3d-6c1de2f54cf4 for athlete 9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d, from original staging Auth UUID d07c0680-bc73-4ce2-8ad8-f9275097a15f to replacement. Guarded transaction required confirmed exact replacement and exactly one matching old link. No duplicate athlete record or extra assignment created. Original Auth account retained with no athlete assignment.

Three SQL-context checks passed for replacement: own athlete visible, Athlete B denied, exactly one access row visible. These do not constitute password-session testing.

Secure browser login returned Invalid login credentials. Read-only Auth inspection confirms replacement email-confirmed, password present (value not inspected), email identity present, no ban, no last sign-in. Staging Auth logs confirm /token password-grant request rejected with invalid_credentials. Built Supabase client explicitly resolves staging URL and staging public key; production is not selected by that build.

No password value inspected, changed or saved. Remaining blocker: successful entry of matching staging account email/password, followed by UI role-mapping review and full security gates. No production write or PR #1 merge.
