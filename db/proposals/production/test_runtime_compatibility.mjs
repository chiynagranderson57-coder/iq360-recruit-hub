// In-memory PostgreSQL only. No hosted connections, credentials or production rows.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(process.env.SRIQ_PGLITE_MODULE ?? "@electric-sql/pglite");
const b = JSON.parse(await readFile(new URL("./baseline.json", import.meta.url), "utf8"));
const sql = await readFile(new URL("./production_permissions.sql", import.meta.url), "utf8");
const q = (s) => `'${s.replaceAll("'", "''")}'`;
const i = (s) => `"${s.replaceAll('"', '""')}"`;
const sig = (f) => `${f.schema}.${f.name}(${f.args})`;
let checks = 0;
const equal = (a, e, label) => {
  assert.deepEqual(a, e, label);
  checks++;
};
const scalar = async (db, s) => (await db.query(s)).rows[0].value;
const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const ids = Object.fromEntries(
  ["athlete", "athleteB", "guardian", "revoked", "coordinator", "assignmentOnly", "globalOnly"].map(
    (s, n) => [s, `20000000-0000-4000-8000-00000000000${n + 1}`],
  ),
);
process.on("uncaughtException", (e) => {
  console.error(
    JSON.stringify({ result: "FAIL", message: e.message, code: e.code, query: e.query }),
  );
  process.exit(1);
});

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role supabase_admin;
 create schema auth; create schema private;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;
 set role pg_database_owner;
 revoke all on schema public from public;
 grant usage on schema public to public,postgres,anon,authenticated,service_role;
 reset role;`);
  for (const e of b.enums)
    await db.exec(`create type public.${i(e.typname)} as enum(${e.labels.map(q).join(",")});`);
  for (const t of b.tables) {
    const cols = t.columns.map(
      (c) =>
        `${i(c.name)} ${c.type}${c.notnull ? " not null" : ""}${c.generated === "s" ? ` generated always as (${c.default}) stored` : c.default ? ` default ${c.default}` : ""}`,
    );
    await db.exec(
      `create table public.${i(t.name)}(${cols.join(",")}); alter table public.${i(t.name)} enable row level security;`,
    );
  }
  for (const c of b.constraints.toSorted(
    (a, z) =>
      Number(a.definition.startsWith("FOREIGN KEY")) -
      Number(z.definition.startsWith("FOREIGN KEY")),
  ))
    await db.exec(`alter table public.${i(c.table)} add constraint ${i(c.name)} ${c.definition};`);
  for (const f of b.functions) {
    await db.exec(f.definition);
    await db.exec(`revoke all on function ${sig(f)} from public,anon,authenticated,service_role;`);
    for (const entry of f.acl ?? []) {
      const role = entry.split("=")[0] || "public";
      if (role !== "postgres") await db.exec(`grant execute on function ${sig(f)} to ${role};`);
    }
  }
  for (const p of b.policies)
    await db.exec(
      `create policy ${i(p.policyname)} on public.${i(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map((r) => (r === "public" ? "public" : i(r))).join(",")}${p.qual ? ` using(${p.qual})` : ""}${p.with_check ? ` with check(${p.with_check})` : ""};`,
    );
  for (const t of b.tables)
    await db.exec(`grant all on public.${i(t.name)} to anon,authenticated,service_role;`);
  for (const t of b.triggers) await db.exec(t.definition);
  for (const role of ["postgres", "supabase_admin"]) {
    await db.exec(`set role ${role};
   alter default privileges for role ${role} in schema public grant all on tables to postgres,anon,authenticated,service_role;
   alter default privileges for role ${role} in schema public grant execute on functions to postgres,anon,authenticated,service_role;
   alter default privileges for role ${role} in schema public grant usage,select,update on sequences to postgres,anon,authenticated,service_role;
   reset role;`);
  }
  for (const [name, id] of Object.entries(ids))
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      `isolated-${name}@example.com`,
    ]);
  await db.exec(`insert into public.athletes(id,first_name,last_name) values('${A}','Isolated','A'),('${B}','Isolated','B');
 insert into public.user_roles(user_id,role) values('${ids.coordinator}','recruitment_coordinator'),('${ids.globalOnly}','recruitment_coordinator');
 insert into public.athlete_access(athlete_id,user_id,access_role) values
 ('${A}','${ids.athlete}','student_athlete'),('${B}','${ids.athleteB}','student_athlete'),
 ('${A}','${ids.guardian}','parent_guardian'),('${A}','${ids.revoked}','parent_guardian'),
 ('${A}','${ids.coordinator}','recruitment_coordinator'),('${B}','${ids.coordinator}','student_athlete'),
 ('${A}','${ids.assignmentOnly}','recruitment_coordinator');
 insert into public.guardian_consents(athlete_id,guardian_user_id,status,revoked_at) values
 ('${A}','${ids.guardian}','active',null),('${A}','${ids.revoked}','revoked',now());
 insert into public.athlete_readiness(athlete_id) values('${A}'),('${B}');`);
  return db;
}
async function as(db, id, s, role = "authenticated") {
  await db.exec(`begin; set local role ${role};`);
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id, role }),
    ]);
    return await db.query(s);
  } finally {
    await db.exec("rollback;");
  }
}
async function denied(db, id, s, label, codes = ["42501"], role) {
  await assert.rejects(as(db, id, s, role), (e) => codes.includes(e.code), label);
  checks++;
}
const db = await setup();
const version = await scalar(db, "select version() value");
equal(
  await scalar(db, "select has_schema_privilege('authenticated','private','USAGE') value"),
  false,
  "production-like private schema remains private",
);
await denied(
  db,
  ids.athlete,
  "select * from public.athlete_access",
  "baseline recursion reproduced",
  ["42P17"],
);
const fnBefore = new Map();
for (const f of b.functions)
  fnBefore.set(
    sig(f),
    await scalar(db, `select pg_get_functiondef('${sig(f)}'::regprocedure) value`),
  );
await assert.rejects(db.exec(sql), /opt-in missing/);
checks++;
await db.exec("rollback; set sriq.approved_project_ref='lqthjvzjkbwtggrhgpts';");
await db.exec(sql);

for (const t of b.tables) {
  equal(
    await scalar(
      db,
      `select relrowsecurity value from pg_class where oid='public.${t.name}'::regclass`,
    ),
    true,
    "RLS retained",
  );
  for (const role of ["anon", "authenticated"])
    for (const privilege of ["TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"])
      equal(
        await scalar(
          db,
          `select has_table_privilege('${role}','public.${t.name}','${privilege}') value`,
        ),
        false,
        "unneeded capability removed",
      );
  for (const privilege of [
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
    "MAINTAIN",
  ])
    equal(
      await scalar(
        db,
        `select has_table_privilege('service_role','public.${t.name}','${privilege}') value`,
      ),
      true,
      "service-role compatibility",
    );
  for (const role of ["anon", "authenticated"])
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      if (t.name === "athlete_readiness" && privilege === "UPDATE") continue;
      equal(
        await scalar(
          db,
          `select has_table_privilege('${role}','public.${t.name}','${privilege}') value`,
        ),
        true,
        "unrelated DML grants preserved",
      );
    }
}
for (const [name, id] of Object.entries(ids)) {
  const expected =
    name === "revoked" || name === "globalOnly"
      ? []
      : name === "coordinator"
        ? [A, B]
        : [name === "athleteB" ? B : A];
  equal(
    (await as(db, id, "select id from public.athletes order by id")).rows.map((r) => r.id),
    expected,
    "read scope " + name,
  );
  equal(
    (
      await as(db, id, "select athlete_id from public.athlete_readiness order by athlete_id")
    ).rows.map((r) => r.athlete_id),
    expected,
    "readiness scope " + name,
  );
  const modified = await as(
    db,
    id,
    "update public.athlete_readiness set film_complete=true returning athlete_id,readiness_score",
  );
  equal(
    modified.rows.map((r) => r.athlete_id),
    name === "coordinator" ? [A] : [],
    "assigned/global coordinator write scope " + name,
  );
  if (name === "coordinator")
    equal(modified.rows[0].readiness_score, 25, "score computed from flags");
  await denied(
    db,
    id,
    `select public.assign_role('${ids.athleteB}','recruitment_coordinator')`,
    "browser role assignment denied " + name,
  );
}
equal(
  (await as(db, ids.revoked, "select status from public.guardian_consents")).rows.map(
    (r) => r.status,
  ),
  ["revoked"],
  "revoked consent history only",
);
equal(
  (await as(db, ids.guardian, "select id from public.guardian_consents")).rows.length,
  2,
  "active guardian scope unchanged",
);
await db.exec(
  `update public.athlete_access set status='archived' where athlete_id='${A}' and user_id='${ids.coordinator}';`,
);
equal(
  (
    await as(
      db,
      ids.coordinator,
      "update public.athlete_readiness set film_complete=true returning id",
    )
  ).rows.length,
  0,
  "archived assignment blocks write despite active global role",
);
await db.exec(
  `update public.athlete_access set status='active' where athlete_id='${A}' and user_id='${ids.coordinator}'; update public.user_roles set status='archived' where user_id='${ids.coordinator}';`,
);
equal(
  (
    await as(
      db,
      ids.coordinator,
      "update public.athlete_readiness set film_complete=true returning id",
    )
  ).rows.length,
  0,
  "archived global role blocks write despite active assignment",
);
await db.exec(`update public.user_roles set status='active' where user_id='${ids.coordinator}';`);
for (const col of ["id", "athlete_id"])
  await denied(
    db,
    ids.coordinator,
    `update public.athlete_readiness set ${col}=${col}`,
    "identity columns denied",
  );
await denied(
  db,
  ids.coordinator,
  "update public.athlete_readiness set readiness_score=readiness_score",
  "score denied",
  ["42501", "428C9"],
);
for (const col of ["id", "athlete_id", "readiness_score"])
  equal(
    await scalar(
      db,
      `select has_column_privilege('authenticated','public.athlete_readiness','${col}','UPDATE') value`,
    ),
    false,
    "sensitive column ACL denied",
  );
for (const col of [
  "profile_complete",
  "academics_complete",
  "film_complete",
  "recruiting_materials_complete",
  "updated_at",
])
  equal(
    await scalar(
      db,
      `select has_column_privilege('authenticated','public.athlete_readiness','${col}','UPDATE') value`,
    ),
    true,
    "completion column grants preserved",
  );
equal(
  (
    await as(
      db,
      ids.athlete,
      `insert into public.user_profiles(id,full_name) values('${ids.athlete}','Synthetic self-service') returning id`,
    )
  ).rows.length,
  1,
  "profile self-service insert preserved",
);
await db.exec(
  `insert into public.user_profiles(id,full_name) values('${ids.athlete}','Synthetic');`,
);
equal(
  (await as(db, ids.athlete, "update public.user_profiles set full_name='Changed' returning id"))
    .rows.length,
  1,
  "profile self-service update preserved",
);
equal(
  (
    await as(
      db,
      ids.athlete,
      `insert into public.audit_events(actor_user_id,event_type,action) values('${ids.athlete}','isolated.test','read') returning id`,
    )
  ).rows.length,
  1,
  "self audit insert preserved",
);
await denied(
  db,
  ids.athlete,
  `insert into public.audit_events(actor_user_id,event_type,action) values('${ids.athleteB}','isolated.test','read')`,
  "audit actor forgery denied",
);
await denied(
  db,
  ids.athlete,
  `insert into public.user_roles(user_id,role) values('${ids.athlete}','recruitment_coordinator')`,
  "direct role escalation denied",
);
await denied(
  db,
  ids.athlete,
  "select * from public.athletes",
  "anon read denied",
  ["42501"],
  "anon",
);
await denied(
  db,
  ids.athlete,
  "update public.athlete_readiness set film_complete=true",
  "anon update denied",
  ["42501"],
  "anon",
);
await denied(
  db,
  ids.athlete,
  `select public.assign_role('${ids.athleteB}','recruitment_coordinator')`,
  "anon RPC denied",
  ["42501"],
  "anon",
);
for (const f of b.functions) {
  equal(
    await scalar(db, `select pg_get_functiondef('${sig(f)}'::regprocedure) value`),
    fnBefore.get(sig(f)),
    "existing function body unchanged",
  );
  for (const role of ["service_role", "anon", "authenticated"]) {
    const expected =
      f.name === "assign_role" && role !== "service_role"
        ? false
        : f.acl.some((s) => s.startsWith(role + "=") || s.startsWith("="));
    equal(
      await scalar(db, `select has_function_privilege('${role}','${sig(f)}','EXECUTE') value`),
      expected,
      "existing function ACL preservation/restriction",
    );
  }
}
for (const role of ["anon", "service_role"])
  equal(
    await scalar(
      db,
      `select has_function_privilege('${role}','private.is_assigned_athlete_coordinator(uuid)','EXECUTE') value`,
    ),
    false,
    "new helper denies default-granted role",
  );
equal(
  await scalar(
    db,
    "select has_function_privilege('authenticated','private.is_assigned_athlete_coordinator(uuid)','EXECUTE') value",
  ),
  true,
  "helper executable in stored policies",
);
equal(
  await scalar(db, "select has_schema_privilege('authenticated','private','USAGE') value"),
  false,
  "no private schema grant was needed",
);
equal(
  (
    await as(
      db,
      ids.coordinator,
      `select public.assign_role('${ids.athleteB}','recruitment_coordinator')`,
      "service_role",
    )
  ).rows.length,
  1,
  "existing service-role function works with required coordinator actor",
);
await denied(
  db,
  ids.athlete,
  `select public.assign_role('${ids.athleteB}','recruitment_coordinator')`,
  "service key alone does not bypass actor guard",
  ["P0001"],
  "service_role",
);
await db.exec("create table public.future_probe(id int);");
for (const role of ["anon", "authenticated"])
  for (const p of ["TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"])
    equal(
      await scalar(db, `select has_table_privilege('${role}','public.future_probe','${p}') value`),
      false,
      "new postgres table safe defaults",
    );
await db.exec("drop table public.future_probe;");
equal(
  await scalar(db, "select count(*)::int value from public.user_roles"),
  2,
  "role assignment tests rolled back",
);
equal(
  await scalar(
    db,
    "select count(*)::int value from public.athlete_readiness where readiness_score=0",
  ),
  2,
  "readiness tests rolled back",
);

// Additional production-runtime queries, copied from deployed commit 3ebe508.
await db.exec(`insert into public.user_profiles(id,full_name) select id,'Synthetic runtime user' from auth.users on conflict(id) do nothing;`);
const runtimeEvidence=[];
for (const [name,id] of Object.entries(ids)) {
  const profile=await as(db,id,`select id,email,full_name,status,created_at,updated_at from public.user_profiles where id='${id}'`);
  equal(profile.rows.length,1,'runtime own profile '+name);
  const roles=await as(db,id,`select role from public.user_roles where user_id='${id}' and status='active'`);
  equal(roles.rows.map(r=>r.role),['coordinator','globalOnly'].includes(name)?['recruitment_coordinator']:[],'runtime active role query '+name);
  const athletes=await as(db,id,`select id,first_name,last_name,sport,graduation_year,status,created_at,updated_at from public.athletes where status='active' order by last_name asc`);
  const expected=['revoked','globalOnly'].includes(name)?[]:name==='coordinator'?[A,B]:[name==='athleteB'?B:A];
  equal(athletes.rows.map(r=>r.id).sort(),expected.slice().sort(),'runtime athlete cards '+name);
  const access=await as(db,id,`select access_role from public.athlete_access where athlete_id='${A}' and status='active'`);
  runtimeEvidence.push({name,athleteIds:athletes.rows.map(r=>r.id),accessRowsForA:access.rows.length,maybeSingleAccepts:access.rows.length===1});
}
await denied(db,ids.coordinator,`select public.assign_role('${ids.athleteB}','parent_guardian')`,'production assignRole authenticated client incompatible');
equal((await as(db,ids.coordinator,`insert into public.audit_events(actor_user_id,athlete_id,event_type,entity_type,entity_id,action,source,correlation_id,metadata) values('${ids.coordinator}',null,'auth.signed_out','session',null,'update','app',null,'{}') returning id`,'service_role')).rows.length,1,'runtime sign-out audit insert preserved');
console.log(JSON.stringify({runtimeEvidence,scope:'exact production SQL query shapes in isolated engine; no hosted sign-in'},null,2));

await assert.rejects(db.exec(sql), /already exists/);
checks++;
await db.exec("rollback;");
await db.close();

for (const [label, drift] of [
  ["wrong project opt-in", "set sriq.approved_project_ref='kpatqovdotkkgvpvgccg'"],
  ["table inventory drift", "create table public.unexpected_table(id integer)"],
  ["enum drift", "alter type public.app_role add value 'unexpected_role'"],
  [
    "policy drift",
    "alter policy athlete_readiness_update_coordinator on public.athlete_readiness using(true)",
  ],
  ["column drift", "grant update(athlete_id) on public.athlete_readiness to authenticated"],
  ["schema exposure", "grant usage on schema private to authenticated"],
  [
    "function ACL drift",
    "grant execute on function public.assign_role(uuid,public.app_role) to anon",
  ],
  ["role inheritance", "grant anon to authenticated"],
  [
    "default privilege drift",
    "alter default privileges for role postgres in schema public revoke select on tables from authenticated",
  ],
  [
    "constraint drift",
    "alter table public.athletes add constraint unexpected_name check(first_name<>'')",
  ],
  [
    "trigger drift",
    "create trigger unexpected_readiness_trigger before update on public.athlete_readiness for each row execute function public.set_updated_at()",
  ],
]) {
  const d = await setup();
  await d.exec("set sriq.approved_project_ref='lqthjvzjkbwtggrhgpts';");
  await d.exec(drift);
  await assert.rejects(d.exec(sql), /opt-in missing|drift|membership/);
  checks++;
  await d.exec("rollback;");
  equal(
    await scalar(
      d,
      "select has_table_privilege('authenticated','public.athletes','TRUNCATE') value",
    ),
    true,
    label + " stopped without partial changes",
  );
  equal(
    await scalar(
      d,
      "select to_regprocedure('private.is_assigned_athlete_coordinator(uuid)') is null value",
    ),
    true,
    label + " did not create helper",
  );
  await d.close();
}
const fault = await setup();
await fault.exec("set sriq.approved_project_ref='lqthjvzjkbwtggrhgpts';");
const injected = sql.replace(
  "do $verify$",
  "grant truncate on public.athletes to authenticated;\ndo $verify$",
);
await assert.rejects(fault.exec(injected), /Residual dangerous/);
checks++;
await fault.exec("rollback;");
equal(
  await scalar(fault, "select has_table_privilege('anon','public.athletes','TRUNCATE') value"),
  true,
  "postcheck failure rolls back earlier privilege edits",
);
equal(
  await scalar(
    fault,
    "select to_regprocedure('private.is_assigned_athlete_coordinator(uuid)') is null value",
  ),
  true,
  "postcheck failure rolls back helper creation",
);
await fault.close();
console.log(
  JSON.stringify(
    {
      result: "PASS",
      checks,
      engine: version,
      scope: "isolated synthetic data only; no production execution or JWT sign-ins",
    },
    null,
    2,
  ),
);

