# Canonical staging session review — November 6, 2026

Deployment dpl_8NY31FSAYFKJESp3uhrJUiU1dwou, source commit 9479bc6e0eca0d2144471b4e0e61ddc5e642cec8. User operated their own browser; passwords and tokens were not collected.

## Screenshot observations

| Session identified through instructed sequence and displayed role | Observed result | Evidence |
| --- | --- | --- |
| Athlete | Account screen shows sportsrecruitiq360@gmail.com | IMG_3397.jpeg |
| Athlete | Athlete A visible with student_athlete label | IMG_3398.jpeg |
| Athlete | Readiness record 9d0d7e9c, score 0 | IMG_3399.jpeg |
| Athlete | Active and revoked consent rows visible | IMG_3400.jpeg |
| Signed out | Record panel requests sign-in; athlete details hidden | IMG_3401.jpeg |
| Active guardian | Athlete A visible with parent_guardian label | IMG_3402.jpeg |
| Active guardian | Active and revoked consent rows visible | IMG_3403.jpeg |
| Revoked guardian | No athlete records available | IMG_3404.jpeg |
| Revoked guardian | No readiness records available | IMG_3405.jpeg |
| Revoked guardian | One revoked consent row visible | IMG_3406.jpeg |
| Coordinator | Athlete A visible with recruitment_coordinator label | IMG_3407.jpeg |
| Coordinator | Readiness record 9d0d7e9c, score 0 | IMG_3408.jpeg |
| Coordinator | Active and revoked consent rows visible | IMG_3409.jpeg |

Guardian readiness was not captured. Screenshots establish settled UI visibility on these routes, not network-level denial, absence of transient stale cache flashes, cross-athlete isolation, immediate live revocation in an already-open session, write permissions, or complete release readiness. Session identity beyond the athlete account screen relies on the user-directed sequence and displayed access labels.

## Read-only database recheck

Staging kpatqovdotkkgvpvgccg:
- Security advisors returned no notices.
- athlete_access SELECT uses own user or private.is_assigned_athlete_coordinator, avoiding the production self-reference.
- Readiness UPDATE USING and WITH CHECK both require active coordinator plus assigned-athlete coordinator.
- authenticated cannot execute assign_role or assign_role_from_server.
- Consent SELECT allows own guardian row or private.has_athlete_access(athlete_id). This explains why authorized athlete/guardian/coordinator sessions can see both consent rows, while the revoked session sees its own historical row. No policy was broadened.

Production lqthjvzjkbwtggrhgpts remains different:
- athlete_access SELECT still queries athlete_access recursively.
- Readiness UPDATE requires global coordinator only, without athlete assignment in this policy.
- authenticated can execute public.assign_role, which the security advisor flags as SECURITY DEFINER.
- Security advisor also reports leaked-password protection disabled.
- Remediation references: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

All three PRs remain open and unmerged with unchanged source heads: PR1 033dc127a64b29cfc6bc093c1e031be5a553f5bd; PR2 789808c8f2136ca5b6ea84229d120433fc2b3942; PR3 9479bc6e0eca0d2144471b4e0e61ddc5e642cec8.

## Decision

The requested screenshot round is complete. Keep merge/release blocked: staging success cannot establish production readiness while production policies differ. Next technical deliverable is a reviewed production-specific correction and validation plan that includes the non-recursive access helper, readiness assignment restriction, privileged role delegation boundary, and recovery steps. Do not blindly run staging-marker-guarded SQL in production.

The four credential-dependent automated tests remain skipped in the earlier application check; these screenshots do not change their test-run status. Remaining session/security coverage should be automated where feasible without collecting the founder's passwords. No more founder sign-ins are requested by this review.

No production configuration, database permissions, account roles, deployments, or passwords changed during this review. Only this evidence document was added on the isolated review branch. No merge or launch is authorized by the observations.
