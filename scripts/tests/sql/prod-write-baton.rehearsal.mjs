// Rehearses the production write baton in embedded PostgreSQL.
// Usage: node scripts/tests/sql/prod-write-baton.rehearsal.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const migration = await readFile(resolve(repo, 'supabase/migrations/20260916193606_ops_prod_write_baton.sql'), 'utf8')

const db = new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role;')
await db.exec(migration)
await db.exec(migration) // idempotent re-run
const one = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0]
const acquire = (holder) =>
  one(`select ops.acquire_prod_baton($1, 'ws', 'purpose', 'operation', 'owner said yes')`, [holder])

assert.equal((await one('select ops.prod_baton_status()')).state, 'free')
console.log('ok  1 starts free; migration re-runs cleanly')

const a = await acquire('session-A')
assert.equal(a.acquired, true)
assert.equal(a.holder_session, 'session-A')
console.log('ok  2 session A acquires')

const b = await acquire('session-B')
assert.equal(b.acquired, false)
assert.equal(b.holder_session, 'session-A')
console.log('ok  3 session B is refused and told who holds it')

await assert.rejects(() => db.query(`insert into ops.prod_write_baton
  (holder_session, workstream, purpose, intended_operation, expires_at) values ('x','x','x','x', now() + interval '1 hour')`), /unique|duplicate/i)
console.log('ok  4 the database itself refuses a second open baton (race-safe)')

assert.equal(typeof (await one(`select ops.assert_prod_baton('session-A')`)), 'number')
await assert.rejects(() => db.query(`select ops.assert_prod_baton('session-B')`), /not held by session-B/)
console.log('ok  5 assert passes for the holder, raises for anyone else')

await assert.rejects(() => db.query(`select ops.renew_prod_baton($1, 'session-B')`, [a.id]), /not held/)
await assert.rejects(() => db.query(`select ops.release_prod_baton($1, 'session-B', 'done')`, [a.id]), /not held/)
console.log('ok  6 a non-holder cannot renew or release')

await assert.rejects(() => db.query(`select ops.recover_stale_prod_baton($1, 'session-B', 'looks idle to me, taking it over')`, [a.id]), /not an expired/)
console.log('ok  7 an unexpired baton cannot be recovered, however idle it looks')

await db.query(`update ops.prod_write_baton set expires_at = now() - interval '1 minute' where id = $1`, [a.id])
assert.equal((await one('select ops.prod_baton_status()')).state, 'held_expired')
assert.equal((await acquire('session-B')).acquired, false)
await assert.rejects(() => db.query(`select ops.assert_prod_baton('session-A')`), /not held/)
console.log('ok  8 expiry does not free the baton: acquire still refused, expired holder can no longer assert')

await assert.rejects(() => db.query(`select ops.recover_stale_prod_baton($1, 'session-B', 'short')`, [a.id]), /reason/)
const rec = await one(`select ops.recover_stale_prod_baton($1, 'session-B', 'holder expired 1 min ago; owner confirmed session A is gone')`, [a.id])
assert.equal(rec.state, 'free')
const row = (await db.query('select result, recovered_by from ops.prod_write_baton where id = $1', [a.id])).rows[0]
assert.deepEqual(row, { result: 'stale_recovered', recovered_by: 'session-B' })
console.log('ok  9 stale recovery needs a real reason, frees without handing over, and is recorded')

const b2 = await acquire('session-B')
assert.equal(b2.acquired, true)
assert.equal((await one(`select ops.release_prod_baton($1, 'session-B', 'done', 'migration 123')`, [b2.id])).state, 'free')
assert.equal(await one('select count(*)::int from ops.prod_write_baton'), 2)
console.log('ok 10 recoverer acquires normally, releases with evidence; full history kept')

await assert.rejects(() => db.query(`select ops.acquire_prod_baton('x','x','x','x',null, interval '5 hours')`), /ttl/)
console.log('ok 11 ttl is bounded')

const priv = (await db.query(`select
  has_schema_privilege('anon','ops','USAGE') a_schema, has_schema_privilege('authenticated','ops','USAGE') u_schema,
  has_function_privilege('anon','ops.acquire_prod_baton(text,text,text,text,text,interval)','EXECUTE') a_fn,
  has_function_privilege('authenticated','ops.acquire_prod_baton(text,text,text,text,text,interval)','EXECUTE') u_fn,
  has_table_privilege('anon','ops.prod_write_baton','SELECT') a_tbl,
  has_function_privilege('service_role','ops.acquire_prod_baton(text,text,text,text,text,interval)','EXECUTE') s_fn`)).rows[0]
assert.deepEqual(priv, { a_schema: false, u_schema: false, a_fn: false, u_fn: false, a_tbl: false, s_fn: true })
console.log('ok 12 anon/authenticated have no schema, table or function access; service_role can execute')

console.log('production write baton rehearsal passed')
