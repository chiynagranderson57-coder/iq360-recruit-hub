# Staging validation — 2026-10-31

Target verified through parent project's development branch inventory: staging `kpatqovdotkkgvpvgccg`, ACTIVE_HEALTHY. PostgreSQL 17.6. Standalone get_project returned Project not found because this target is a development branch; branch inventory and SQL access succeeded.

The expected recursive policy, existing private helpers, tables and enabled RLS are present. Table/helper ownership is postgres and table FORCE RLS is false. The five approved synthetic account email addresses are absent from staging.

Initial transactional validation failed with 42501 because authenticated has neither SELECT on public.athlete_access nor USAGE on private. Verified afterward that no helper or policy change was retained.

Repeated compatibility validation with those two grants supplied ONLY inside the rollback transaction. The proposed SQL compiled successfully. An authenticated SQL context with an unassigned synthetic UUID read zero access rows without recursion and the bounded coordinator helper returned false. No Auth account was created, no real sign-in occurred, and no positive athlete/guardian/coordinator session test is claimed.

Verified after ROLLBACK: original policy restored, proposed helper absent, test-only SELECT grant removed, test-only private USAGE grant removed. No hosted changes were retained. Production was not modified.

Full staging integration remains blocked by missing authenticated permissions and synthetic Auth accounts/fixtures. Configure staging as a separate reviewed step, then test approved sessions, positive and negative athlete/guardian/coordinator cases, and the intended application revision before production approval. SQL impersonation and empty-table checks do not replace those tests.

Security advisor reported the existing authenticated-callable public.assign_role SECURITY DEFINER function. Read-only inspection confirms it checks private.is_recruitment_coordinator() before writes, rejects unknown targets and audits grants. This finding predates the proposal and is not resolved or changed here; review remains required. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

PR #1 and lovable-sync were not modified by this validation. The prepared repair remains separate and unapplied.
