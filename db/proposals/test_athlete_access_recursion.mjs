// Isolated PostgreSQL test: no network calls and no hosted database credentials.
// Run: NODE_PATH is not used; pass the installed PGlite module URL as argv[2].
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.argv[2]);
const db = new PGlite();
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let passed = 0;
await db.exec(`
  create role authenticated; create role anon;
  create schema auth; create schema private;
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
  $$;
  grant usage on schema auth, private to authenticated, anon;
  create type public.athlete_access_role as enum ('student_athlete','parent_guardian','recruitment_coordinator');
  create type public.record_status as enum ('active','revoked');
  create table public.athlete_access (
    id uuid primary key, athlete_id uuid not null, user_id uuid not null,
    access_role public.athlete_access_role not null, status public.record_status not null
  );
  alter table public.athlete_access enable row level security;
  grant select, insert, update, delete on public.athlete_access to authenticated, anon;
  insert into public.athlete_access values
    ('${uid(101)}','${uid(1)}','${uid(11)}','student_athlete','active'),
    ('${uid(102)}','${uid(1)}','${uid(12)}','parent_guardian','active'),
    ('${uid(103)}','${uid(1)}','${uid(13)}','parent_guardian','revoked'),
    ('${uid(104)}','${uid(1)}','${uid(14)}','recruitment_coordinator','active'),
    ('${uid(105)}','${uid(1)}','${uid(15)}','recruitment_coordinator','revoked'),
    ('${uid(106)}','${uid(2)}','${uid(16)}','student_athlete','active');
  create policy athlete_access_select_own on public.athlete_access for select using (
    auth.uid() = user_id or exists (select 1 from public.athlete_access mine
      where mine.athlete_id = athlete_access.athlete_id and mine.user_id = auth.uid()
        and mine.access_role = 'recruitment_coordinator' and mine.status = 'active')
  );
`);
async function asUser(n, fn, role = 'authenticated') {
  await db.exec(`begin; set local role ${role};`);
  try {
    await db.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify(n ? {sub:uid(n),role} : {role})]);
    return await fn();
  } finally { await db.exec('rollback'); }
}
await assert.rejects(asUser(11, () => db.query('select * from public.athlete_access')), e => e.code === '42P17');
passed++;
console.log('PASS reproduced original infinite recursion (42P17)');
await db.exec(await readFile(new URL('./sriq12_athlete_access_recursion.sql', import.meta.url), 'utf8'));

for (const [user, expected, label] of [
  [11,[101],'athlete sees own access only'],
  [12,[102],'active guardian sees own access only'],
  [13,[103],'revoked guardian sees own status only'],
  [14,[101,102,103,104,105],'assigned active coordinator sees only assigned athlete access'],
  [15,[105],'revoked coordinator sees own status only'],
  [16,[106],'unrelated athlete sees own access only'],
  [17,[],'unassigned coordinator account gains no access'],
  [null,[],'missing identity denied'],
]) {
  const result = await asUser(user, () => db.query('select id from public.athlete_access order by id'));
  assert.deepEqual(result.rows.map(r => r.id), expected.map(uid)); passed++;
  console.log(`PASS ${label}`);
}
assert.equal((await asUser(null, () => db.query('select * from public.athlete_access'), 'anon')).rows.length,0);
passed++; console.log('PASS anonymous access denied');
for (const [user, athlete, expected] of [[14,1,true],[14,2,false],[15,1,false],[17,1,false],[null,1,false]]) {
  const result = await asUser(user, () => db.query('select private.is_assigned_athlete_coordinator($1) as allowed',[uid(athlete)]));
  assert.equal(result.rows[0].allowed,expected); passed++;
}
console.log('PASS helper checks current caller, assignment, active status and null identity');
await assert.rejects(asUser(null, () => db.query('select private.is_assigned_athlete_coordinator($1)',[uid(1)]),'anon'),e=>e.code==='42501');
passed++; console.log('PASS anonymous helper execution denied');
await assert.rejects(asUser(14,()=>db.query(`insert into public.athlete_access values ($1,$2,$3,'recruitment_coordinator','active')`,[uid(107),uid(2),uid(14)])),e=>e.code==='42501');
passed++; console.log('PASS access assignment cannot be self-created');
for (const sql of ["update public.athlete_access set status='active' returning id",'delete from public.athlete_access returning id']) {
  assert.equal((await asUser(14,()=>db.query(sql))).rows.length,0); passed++;
}
console.log('PASS no update or delete authority introduced');
assert.equal((await db.query('select count(*)::int as n from public.athlete_access')).rows[0].n,6);
passed++; console.log('PASS fixture rows unchanged');
await assert.rejects(db.exec(await readFile(new URL('./sriq12_athlete_access_recursion.sql', import.meta.url),'utf8')),/Expected recursive policy missing or changed/);
await db.exec('rollback'); passed++;
console.log('PASS repeat application stops for review');
console.log(`${passed} assertions passed in isolated PostgreSQL ${ (await db.query('show server_version')).rows[0].server_version }`);
await db.close();
