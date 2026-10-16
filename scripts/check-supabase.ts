/**
 * Read-only connectivity check against the configured Supabase project.
 * Calls the Auth health endpoint (schema-independent, no writes) and verifies
 * the URL matches the declared VITE_APP_ENV (production/staging/development).
 * Run: bun scripts/check-supabase.ts
 *      bun --env-file=.env.staging scripts/check-supabase.ts   (staging)
 */
import { resolveAppBackend } from "../src/lib/environment";

const { url, publishableKey: key, check: env } = resolveAppBackend(process.env);
console.log(`environment: ${JSON.stringify(env)}`);

const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
const body = await res.text();
console.log(`GET ${url}/auth/v1/health -> ${res.status}`);
console.log(body);
process.exit(res.ok ? 0 : 1);
