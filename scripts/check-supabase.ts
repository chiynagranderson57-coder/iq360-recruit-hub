/**
 * Read-only connectivity check against the configured Supabase project.
 * Calls the Auth health endpoint (schema-independent, no writes) and verifies
 * the URL matches the declared VITE_APP_ENV (production/staging/development).
 * Run: bun scripts/check-supabase.ts
 *      bun --env-file=.env.staging scripts/check-supabase.ts   (staging)
 */
import { checkEnvironment } from "../src/lib/environment";

const url = process.env["VITE_SUPABASE_URL"];
const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}
if (/^sb_secret_|service_role/.test(key)) {
  console.error("Refusing to run: a secret key was supplied. Use the publishable key only.");
  process.exit(1);
}

const env = checkEnvironment(process.env);
console.log(`environment: ${JSON.stringify(env)}`);
if (!env.ok) process.exit(1);

const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
const body = await res.text();
console.log(`GET ${url}/auth/v1/health -> ${res.status}`);
console.log(body);
process.exit(res.ok ? 0 : 1);
