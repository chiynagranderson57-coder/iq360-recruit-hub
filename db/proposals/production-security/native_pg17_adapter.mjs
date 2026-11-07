// Test-only PGlite-compatible adapter. Creates disposable native PostgreSQL 17.6
// clusters on password-protected loopback TCP. Never accepts a hosted URL.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const bin = resolve(process.env.SRIQ_PG17_BIN_DIR);
const env = { ...process.env, LD_LIBRARY_PATH: resolve(bin, "../lib") };
const driver = await import(process.env.SRIQ_PG_MODULE);
const Client = driver.Client ?? driver.default.Client;
const active = new Set();
process.once("exit", () => {
  for (const directory of active) {
    try {
      execFileSync(
        join(bin, "pg_ctl"),
        ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"],
        { env, stdio: "ignore" },
      );
    } catch {
      /* A stopped cluster needs no further action. */
    }
  }
});

export class PGlite {
  constructor() {
    this.ready = this.initialize();
  }

  async initialize() {
    const { stdout } = await run(join(bin, "postgres"), ["--version"], { env });
    assert.match(stdout, /PostgreSQL\) 17\.6\b/, "native rehearsal requires PostgreSQL 17.6");
    this.directory = await mkdtemp(join(tmpdir(), "sriq-native17-"));
    const data = join(this.directory, "data");
    const password = randomBytes(32).toString("hex");
    const pwfile = join(this.directory, "bootstrap-password");
    await writeFile(pwfile, password, { mode: 0o600 });
    const port = await new Promise((accept, reject) => {
      const probe = createServer();
      probe.once("error", reject);
      probe.listen(0, "127.0.0.1", () => {
        const selected = probe.address().port;
        probe.close((error) => (error ? reject(error) : accept(selected)));
      });
    });
    await run(
      join(bin, "initdb"),
      [
        "-D",
        data,
        "-U",
        "sriq_review_bootstrap",
        "--auth-local=trust",
        "--auth-host=scram-sha-256",
        `--pwfile=${pwfile}`,
        "--no-locale",
        "--encoding=UTF8",
      ],
      { env },
    );
    await run(
      join(bin, "pg_ctl"),
      [
        "-D",
        data,
        "-l",
        join(this.directory, "server.log"),
        "-o",
        `-F -h 127.0.0.1 -k '' -p ${port}`,
        "-w",
        "start",
      ],
      { env },
    );
    active.add(this.directory);
    const connection = { host: "127.0.0.1", port, password };
    const bootstrap = new Client({
      ...connection,
      database: "postgres",
      user: "sriq_review_bootstrap",
    });
    await bootstrap.connect();
    try {
      // Generated hexadecimal password is local to this disposable cluster.
      await bootstrap.query(`create role postgres login password '${password}' nosuperuser inherit createdb createrole replication bypassrls;
        create role anon nologin nosuperuser inherit nocreatedb nocreaterole nobypassrls;
        create role authenticated nologin nosuperuser inherit nocreatedb nocreaterole nobypassrls;
        create role service_role nologin nosuperuser inherit nocreatedb nocreaterole bypassrls;
        grant anon,authenticated,service_role to postgres with admin option;`);
      await bootstrap.query("create database review_fixture owner postgres");
    } finally {
      await bootstrap.end();
    }
    this.client = new Client({ ...connection, database: "review_fixture", user: "postgres" });
    await this.client.connect();
    const { rows } = await this.client.query(
      "select rolsuper from pg_roles where rolname=current_user",
    );
    assert.equal(rows[0].rolsuper, false, "proposal runs as non-superuser postgres");
  }

  async bootstrapReviewRoles() {
    await this.ready;
  }

  async exec(sql) {
    await this.ready;
    return this.client.query(sql);
  }

  async query(sql, parameters) {
    await this.ready;
    return this.client.query(sql, parameters);
  }

  async close() {
    await this.ready;
    await this.client.end();
    await run(
      join(bin, "pg_ctl"),
      ["-D", join(this.directory, "data"), "-m", "fast", "-w", "stop"],
      { env },
    );
    active.delete(this.directory);
    await rm(this.directory, { recursive: true, force: true });
  }
}
