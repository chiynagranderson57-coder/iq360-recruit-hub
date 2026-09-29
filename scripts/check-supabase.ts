/**
 * Read-only connectivity check against the canonical Supabase project.
 * Calls the Auth health endpoint (schema-independent, no writes).
 * Run: bun scripts/check-supabase.ts
 */
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
const body = await res.text();
console.log(`GET ${url}/auth/v1/health -> ${res.status}`);
console.log(body);
process.exit(res.ok ? 0 : 1);
