// Isolated synthetic PostgreSQL only. Never connects to a hosted database.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(process.env.SRIQ_PGLITE_MODULE ?? "@electric-sql/pglite");
const baseline = JSON.parse(await readFile(new URL("./baseline.json", import.meta.url), "utf8"));
const structure = JSON.parse(
  await readFile(new URL("./production-structure-2026-11-07.json", import.meta.url), "utf8"),
);
const catalog = JSON.parse(
  await readFile(new URL("./production-acl-2026-11-07.json", import.meta.url), "utf8"),
);
const proposal = await readFile(new URL("./proposal.sql", import.meta.url), "utf8");
const q = (s) => `'${s.replaceAll("'", "''")}'`;
const i = (s) => `"${s.replaceAll('"', '""')}"`;
const signature = (f) => `${f.schema}.${f.name}(${f.arguments.replace(/\bp_\w+\s+/g, "")})`;
process.on("uncaughtException", (error) => {
  console.error(
    JSON.stringify({
      result: "FAIL",
      message: error.message,
      code: error.code,
      query: error.query,
    }),
  );
  process.exit(1);
});
const a = "9d0d7e9c-05b3-4ea5-bdd9-82b761c2a22d";
const b = "0784d468-02a1-4c54-b1c2-fce5444b6737";
const users = {
  athlete: "7e5bcc5e-b167-43d8-8665-3f39a6a1f99e",
  athleteB: "61f2c0c3-60e9-47d3-849f-9d092e6a6437",
  guardian: "32be8560-45c1-4b99-9ad1-1f4f55a5f2ec",
  revoked: "6d569ad6-9785-4bc1-bb5b-f5e1fdab247f",
  coordinator: "535b00f8-40da-4c69-9832-962dbf745df6",
  assignmentOnly: "00000000-0000-4000-8000-000000000006",
};
let assertions = 0;
const check = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  assertions++;
};
const scalar = async (db, sql) => (await db.query(sql)).rows[0].value;
async function setup() {
  const db = new PGlite();
  if (db.bootstrapReviewRoles) await db.bootstrapReviewRoles();
  else
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
  await db.exec(`create schema auth; create schema private;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  // Production private has a null ACL: retain owner-only schema privileges.
  assert.equal(catalog.schemas.find((s) => s.name === "private").acl, null);
  for (const e of baseline.enums)
    await db.exec(`create type public.${i(e.typname)} as enum (${e.labels.map(q).join(",")});`);
  for (const t of catalog.tables) {
    const cols = structure.columns
      .filter((c) => c.table_name === t.name)
      .map((c) => {
        let d = `${i(c.column_name)} ${i(c.udt_name)}`;
        if (c.is_generated === "ALWAYS")
          d += ` generated always as (${c.generation_expression}) stored`;
        else if (c.column_default) d += ` default ${c.column_default}`;
        if (c.is_nullable === "NO") d += " not null";
        return d;
      });
    await db.exec(
      `create table public.${i(t.name)} (${cols.join(",")}); alter table public.${i(t.name)} enable row level security;`,
    );
  }
  for (const c of [...structure.constraints].sort(
    (a, b) =>
      Number(a.definition.startsWith("FOREIGN KEY")) -
      Number(b.definition.startsWith("FOREIGN KEY")),
  ))
    await db.exec(`alter table public.${i(c.table)} add constraint ${i(c.name)} ${c.definition};`);
  for (const definition of new Set(structure.triggers.map((t) => t.function)))
    await db.exec(definition);
  for (const trigger of structure.triggers) await db.exec(trigger.definition);
  for (const f of baseline.functions) await db.exec(f.definition);
  for (const f of baseline.functions.filter((f) => f.acl)) {
    const sig = `${i(f.schema)}.${i(f.name)}(${f.arguments})`;
    await db.exec(`revoke all on function ${sig} from public,anon,authenticated,service_role;`);
    for (const role of ["anon", "authenticated", "service_role"])
      if (
        f.acl.some((s) => s.startsWith(`${role}=`) && s.split("=")[1].split("/")[0].includes("X"))
      )
        await db.exec(`grant execute on function ${sig} to ${role};`);
  }
  for (const p of baseline.policies)
    await db.exec(
      `create policy ${i(p.policyname)} on public.${i(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map((r) => (r === "public" ? "public" : i(r))).join(",")}${p.qual ? ` using (${p.qual})` : ""}${p.with_check ? ` with check (${p.with_check})` : ""};`,
    );
  const privileges = {
    r: "SELECT",
    a: "INSERT",
    w: "UPDATE",
    d: "DELETE",
    D: "TRUNCATE",
    x: "REFERENCES",
    t: "TRIGGER",
    m: "MAINTAIN",
  };
  for (const t of catalog.tables) {
    await db.exec(`revoke all on public.${i(t.name)} from public,anon,authenticated,service_role;`);
    for (const role of ["anon", "authenticated", "service_role"]) {
      const letters = t.acl
        .slice(1, -1)
        .split(",")
        .find((s) => s.startsWith(`${role}=`))
        ?.split("=")[1]
        .split("/")[0];
      if (letters)
        await db.exec(
          `grant ${[...letters].map((s) => privileges[s]).join(",")} on public.${i(t.name)} to ${role};`,
        );
    }
  }
  await db.exec(
    "alter default privileges for role postgres in schema public grant select,insert,update,delete,truncate,references,trigger,maintain on tables to postgres,anon,authenticated,service_role;",
  );
  for (const [kind, id] of Object.entries(users))
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      kind === "athlete"
        ? "sriq12-staging-athlete-a2@example.com"
        : kind === "coordinator"
          ? "sriq12-staging-coordinator@example.com"
          : `isolated-${kind}@example.com`,
    ]);
  await db.exec(`insert into public.athletes(id,first_name,last_name) values ('${a}','Isolated','A'),('${b}','Isolated','B');
    insert into public.user_roles(user_id,role) values ('${users.coordinator}','recruitment_coordinator');
    insert into public.athlete_access(athlete_id,user_id,access_role) values
      ('${a}','${users.athlete}','student_athlete'),('${b}','${users.athleteB}','student_athlete'),
      ('${a}','${users.guardian}','parent_guardian'),('${a}','${users.revoked}','parent_guardian'),
      ('${a}','${users.coordinator}','recruitment_coordinator'),('${b}','${users.coordinator}','student_athlete'),
      ('${b}','${users.assignmentOnly}','recruitment_coordinator');
    insert into public.guardian_consents(athlete_id,guardian_user_id,status,revoked_at) values
      ('${a}','${users.guardian}','active',null),('${a}','${users.revoked}','revoked',now());
    insert into public.athlete_readiness(athlete_id) values ('${a}'),('${b}');`);
  return db;
}
async function asUser(db, id, sql, role = "authenticated") {
  await db.exec(`begin; set local role ${role};`);
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id, role }),
    ]);
    return await db.query(sql);
  } finally {
    await db.exec("rollback;");
  }
}
async function denied(db, id, sql, label, role) {
  await assert.rejects(asUser(db, id, sql, role), (e) => e.code === "42501", label);
  assertions++;
}
const serviceAclSql =
  "select array_agg(relname||':'||privilege order by relname,privilege) value from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege where n.nspname='public' and c.relkind='r' and has_table_privilege('service_role',c.oid,privilege)";
const db = await setup();
const serviceFunctionAclSql =
  "select array_agg(n.nspname||'.'||p.proname||':'||has_function_privilege('service_role',p.oid,'EXECUTE')::text order by n.nspname,p.proname) value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname in ('has_athlete_access','is_recruitment_coordinator')) or (n.nspname='public' and p.proname='assign_role')";
const serviceFunctionsBefore = await scalar(db, serviceFunctionAclSql);
check(
  await scalar(
    db,
    "select has_function_privilege('service_role','public.assign_role(uuid,public.app_role)','EXECUTE') value",
  ),
  true,
  "model retains production service-role function grant",
);
const serviceBefore = await scalar(db, serviceAclSql);
await assert.rejects(
  asUser(db, users.coordinator, "select * from public.athlete_access"),
  (e) => e.code === "42P17",
);
assertions++;
// The readiness gap can still be reproduced through its definer-backed SELECT.

const definitions = new Map();
for (const f of baseline.functions)
  definitions.set(
    f.name,
    await scalar(db, `select pg_get_functiondef('${signature(f)}'::regprocedure) value`),
  );
check(
  (
    await asUser(
      db,
      users.coordinator,
      `update public.athlete_readiness set profile_complete=true where athlete_id='${b}' returning athlete_id`,
    )
  ).rows.length,
  1,
  "baseline reproduces unassigned update when coordinator also has a read link",
);
await db.exec("set sriq.review_target='lqthjvzjkbwtggrhgpts'");
await db.exec(proposal);
check(
  await scalar(db, serviceFunctionAclSql),
  serviceFunctionsBefore,
  "service-role existing function permissions unchanged",
);
for (const role of ["anon", "authenticated", "service_role"])
  for (const privilege of ["USAGE", "CREATE"])
    check(
      await scalar(db, `select has_schema_privilege('${role}','private','${privilege}') value`),
      false,
      `${role} private schema ${privilege} stays denied`,
    );
await denied(
  db,
  users.coordinator,
  `select private.is_assigned_athlete_coordinator('${a}')`,
  "direct private helper lookup denied by schema ACL while bound policies work",
);
check(
  await scalar(
    db,
    "select pg_get_userbyid(proowner) value from pg_proc where oid='private.is_assigned_athlete_coordinator(uuid)'::regprocedure",
  ),
  "postgres",
  "new helper retains reviewed owner",
);
check(
  await scalar(
    db,
    "select prosecdef and proconfig=array['search_path=\"\"']::text[] value from pg_proc where oid='private.is_assigned_athlete_coordinator(uuid)'::regprocedure",
  ),
  true,
  "new helper uses fixed empty search path",
);
for (const kind of ["athlete", "guardian", "revoked", "coordinator", "assignmentOnly"]) {
  const rows = (
    await asUser(db, users[kind], "select athlete_id,user_id from public.athlete_access")
  ).rows;
  check(rows.length > 0, true, `${kind} access lookup no longer recurses`);
  check(
    rows.every(
      (r) =>
        r.user_id === users[kind] ||
        (kind === "coordinator" && r.athlete_id === a) ||
        (kind === "assignmentOnly" && r.athlete_id === b),
    ),
    true,
    `${kind} access links remain scoped`,
  );
}
check(
  (await asUser(db, null, "select id from public.athletes")).rows.length,
  0,
  "no user claim sees no athletes",
);
check(
  await scalar(
    db,
    "select has_function_privilege('anon','private.is_assigned_athlete_coordinator(uuid)','EXECUTE') value",
  ),
  false,
  "anonymous cannot invoke helper",
);
check(
  await scalar(
    db,
    "select has_function_privilege('authenticated','private.is_assigned_athlete_coordinator(uuid)','EXECUTE') value",
  ),
  true,
  "policy can invoke private helper",
);
for (const t of baseline.table_acl) {
  for (const role of ["anon", "authenticated"])
    for (const capability of ["TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"])
      check(
        await scalar(
          db,
          `select has_table_privilege('${role}','public.${t.name}','${capability}') value`,
        ),
        false,
        `${role} ${capability} ${t.name}`,
      );
  check(
    await scalar(
      db,
      `select relrowsecurity value from pg_class where oid='public.${t.name}'::regclass`,
    ),
    true,
    `${t.name} retains RLS`,
  );
}
await db.exec("create table public.isolated_future_table(id int);");
for (const role of ["anon", "authenticated"])
  for (const capability of ["TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"])
    check(
      await scalar(
        db,
        `select has_table_privilege('${role}','public.isolated_future_table','${capability}') value`,
      ),
      false,
      "future postgres table has no dangerous client grants",
    );
await db.exec("drop table public.isolated_future_table;");
for (const [kind, id] of Object.entries(users)) {
  const actual = (await asUser(db, id, "select id from public.athletes order by id")).rows
    .map((r) => r.id)
    .sort();
  const expected =
    kind === "revoked"
      ? []
      : kind === "coordinator"
        ? [a, b].sort()
        : [kind === "athleteB" || kind === "assignmentOnly" ? b : a];
  check(actual, expected, `${kind} retains expected read scope`);
  await denied(
    db,
    id,
    `select public.assign_role('${users.athleteB}','recruitment_coordinator')`,
    `${kind} cannot grant roles`,
  );
}
for (const kind of ["athlete", "athleteB", "guardian", "revoked", "assignmentOnly"])
  check(
    (
      await asUser(
        db,
        users[kind],
        "update public.athlete_readiness set film_complete=true returning athlete_id",
      )
    ).rows.length,
    0,
    `${kind} cannot update readiness`,
  );
check(
  (
    await asUser(
      db,
      users.coordinator,
      `update public.athlete_readiness set profile_complete=true where athlete_id='${a}' returning readiness_score`,
    )
  ).rows[0].readiness_score,
  25,
  "assigned coordinator update works; score is generated",
);
check(
  (
    await asUser(
      db,
      users.coordinator,
      `update public.athlete_readiness set profile_complete=true where athlete_id='${b}' returning athlete_id`,
    )
  ).rows.length,
  0,
  "coordinator cannot update an athlete with only a read link",
);
for (const col of ["id", "athlete_id"])
  await denied(
    db,
    users.coordinator,
    `update public.athlete_readiness set ${col}='00000000-0000-4000-8000-000000000099' where athlete_id='${a}'`,
    `${col} cannot be reassigned`,
  );
await assert.rejects(
  asUser(
    db,
    users.coordinator,
    `update public.athlete_readiness set readiness_score=100 where athlete_id='${a}'`,
  ),
  (e) => ["42501", "428C9"].includes(e.code),
  "score cannot be edited",
);
assertions++;
await denied(
  db,
  users.athlete,
  "update public.athlete_readiness set film_complete=true",
  "anon cannot update",
  "anon",
);
await denied(
  db,
  users.athlete,
  `select public.assign_role('${users.athleteB}','recruitment_coordinator')`,
  "anon cannot grant roles",
  "anon",
);
for (const f of baseline.functions)
  check(
    await scalar(db, `select pg_get_functiondef('${signature(f)}'::regprocedure) value`),
    definitions.get(f.name),
    `${f.name} body unchanged`,
  );
check(await scalar(db, serviceAclSql), serviceBefore, "service-role permissions unchanged");
for (const [table, count] of [
  ["user_roles", 1],
  ["athlete_access", 7],
  ["guardian_consents", 2],
])
  check(
    await scalar(db, `select count(*)::int value from public.${table}`),
    count,
    `${table} rows unchanged`,
  );
check(
  await scalar(
    db,
    "select count(*)::int value from public.athlete_readiness where readiness_score=0",
  ),
  2,
  "all synthetic update tests rolled back",
);
const version = await scalar(db, "select version() value");
await db.close();
for (const drift of [
  "set sriq.review_target='wrong-project'",
  "alter policy athlete_access_select_own on public.athlete_access using(true)",
  "create policy unexpected_update on public.athlete_readiness for update to authenticated using(true)",
  "grant update(athlete_id) on public.athlete_readiness to authenticated",
  "grant usage on schema private to authenticated",
  "grant create on schema public to service_role; alter table public.athletes owner to service_role",
  "grant execute on function private.has_athlete_access(uuid) to anon",
  "revoke execute on function public.assign_role(uuid,public.app_role) from service_role",
  "alter function private.is_recruitment_coordinator() security invoker",
  "grant create on schema private to service_role; alter function private.has_athlete_access(uuid) owner to service_role",
  "grant select on public.athletes to public",
  "alter default privileges for role postgres in schema public grant select on tables to public",
  "alter default privileges for role postgres grant truncate on tables to authenticated",
  "grant service_role to authenticated",
  "alter table public.athletes add column unexpected_column int",
  "alter table public.athletes add constraint unexpected_check check(first_name <> '')",
  "alter type public.record_status add value 'unexpected'",
]) {
  const driftDb = await setup();
  await driftDb.exec("set sriq.review_target='lqthjvzjkbwtggrhgpts'");
  await driftDb.exec(drift);
  await assert.rejects(
    driftDb.exec(proposal),
    /target missing|policy changed|Unexpected column grants|Schema ownership|Table ownership|Function ownership|Table default ACL|Browser role|Catalog structure/,
  );
  assertions++;
  await driftDb.exec("rollback;");
  check(
    await scalar(
      driftDb,
      "select has_table_privilege('authenticated','public.athletes','TRUNCATE') value",
    ),
    true,
    "precondition failure preserves original permissions",
  );
  await driftDb.close();
}
console.log(
  JSON.stringify(
    {
      result: "PASS",
      assertions,
      version,
      scope: "isolated synthetic PostgreSQL only; no hosted changes or real JWT authentication",
    },
    null,
    2,
  ),
);
