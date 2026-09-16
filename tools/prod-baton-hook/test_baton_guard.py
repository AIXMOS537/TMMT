"""Tests for baton_guard.py. Run: python -m unittest tools/prod-baton-hook/test_baton_guard.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import baton_guard as g  # noqa: E402

S = g.SUPABASE
ME = "sess-123"
MINE = {"state": "held", "holder_session": "claude:sess-123", "workstream": "ws", "acquired_at": "t0", "expires_at": "t1"}


class Classify(unittest.TestCase):
    def w(self, tool, **inp):
        return g.classify(tool, inp, cwd=os.path.dirname(__file__))

    def test_production_writes_are_recognised(self):
        self.assertTrue(self.w(S + "apply_migration", name="x", query="select 1"))
        self.assertTrue(self.w(S + "deploy_edge_function", name="f"))
        self.assertTrue(self.w(g.VERCEL + "deploy_to_vercel"))
        for q in ("update exec_va_tasks set status='x'", "insert into t values (1)", "delete from t",
                  "create table t(a int)", "alter role r set x=1", "revoke all on t from anon",
                  "do $$ begin perform 1; end $$;", "with x as (update t set a=1 returning 1) select * from x",
                  "select comms.run_shadow_batch('r')", "select public.generate_va_tasks_v2()",
                  "select net.http_post('https://example.invalid')", "select cron.schedule('j','* * * * *','select 1')",
                  "truncate t", "grant execute on function f() to anon", "comment on table t is 'x'"):
            self.assertTrue(self.w(S + "execute_sql", project_id="p", query=q), q)
        for c in ("gh pr merge 236 --merge", "git push origin master", "git push origin HEAD:main",
                  "powershell -File work-baton.ps1 -Mode Push", "vercel --prod", "vercel env add X production",
                  "supabase db push", "supabase functions deploy intake", "supabase secrets set A=b",
                  "curl -X POST https://uapxakmlwnpfsftfeezx.supabase.co/rest/v1/exec_va_tasks -d '{}'",
                  "curl -s -X PUT https://services.leadconnectorhq.com/contacts/1",
                  "gh api -X PUT repos/o/r/pulls/5/merge"):
            self.assertTrue(self.w("Bash", command=c), c)

    def test_read_only_and_local_work_is_not_touched(self):
        for q in ("select count(*) from exec_va_tasks", "select ops.prod_baton_status()",
                  "select 'update' as word, 'insert into' as w2 -- delete in a comment",
                  "select classify_va_tasks(true, 'ruleset/v1')",
                  "select md5(prosrc) from pg_proc where proname = 'generate_va_tasks_v2'",
                  "explain select * from t"):
            self.assertIsNone(self.w(S + "execute_sql", project_id="p", query=q), q)
        for c in ("git status", "git diff origin/master...HEAD", "git push -u origin fix/some-branch",
                  "npx vitest run", "node scripts/tests/sql/prod-write-baton.rehearsal.mjs", "npm run build",
                  "curl -s https://uapxakmlwnpfsftfeezx.supabase.co/rest/v1/exec_va_tasks?select=id",
                  "gh pr view 236", "gh pr checks 236", "supabase start", "vercel logs"):
            self.assertIsNone(self.w("Bash", command=c), c)
        self.assertIsNone(self.w("Read", file_path="x"))
        self.assertIsNone(self.w(S + "list_tables", project_id="p"))

    def test_baton_calls_themselves_are_allowed_but_not_as_cover(self):
        acq = "select ops.acquire_prod_baton('claude:x','ws','p','op','ref')"
        self.assertIsNone(self.w(S + "execute_sql", query=acq))
        self.assertIsNone(self.w(S + "execute_sql", query="select ops.release_prod_baton(3,'claude:x','done','e')"))
        self.assertTrue(self.w(S + "execute_sql", query=acq + "; update exec_va_tasks set status='x'"))
        self.assertTrue(self.w(S + "execute_sql", query="select ops.assert_prod_baton('claude:x'); delete from t"))


class Decide(unittest.TestCase):
    def test_owned_by_this_session_allows(self):
        self.assertEqual(g.decide("w", ME, MINE)[0], "allow")

    def test_free_denies_with_next_action(self):
        d, r = g.decide("w", ME, {"state": "free"})
        self.assertEqual(d, "deny")
        self.assertIn("BATON REQUIRED", r)
        self.assertIn("claude:sess-123", r)
        self.assertIn("acquire", r)

    def test_other_session_denies_with_holder(self):
        other = dict(MINE, holder_session="ccd:someone-else", workstream="worker recovery")
        d, r = g.decide("w", ME, other)
        self.assertEqual(d, "deny")
        self.assertIn("ccd:someone-else", r)
        self.assertIn("worker recovery", r)
        self.assertIn("never steal", r)

    def test_expired_even_if_mine_denies(self):
        d, r = g.decide("w", ME, dict(MINE, state="held_expired"))
        self.assertEqual(d, "deny")
        self.assertIn("EXPIRED", r)

    def test_recovered_baton_is_free_and_denies_until_acquired(self):
        self.assertEqual(g.decide("w", ME, {"state": "free"})[0], "deny")

    def test_database_unavailable_asks_never_allows(self):
        d, r = g.decide("w", ME, RuntimeError("timeout"))
        self.assertEqual(d, "ask")
        self.assertIn("UNKNOWN", r)

    def test_unreadable_status_asks(self):
        self.assertEqual(g.decide("w", ME, None)[0], "ask")


class MainIO(unittest.TestCase):
    def run_main(self, event, status):
        import io
        import json
        orig_read, orig_in, orig_out = g.read_status, sys.stdin, sys.stdout
        g.read_status = (lambda: (_ for _ in ()).throw(status)) if isinstance(status, Exception) else (lambda: status)
        sys.stdin, sys.stdout = io.StringIO(json.dumps(event)), io.StringIO()
        called = []
        try:
            real = g.read_status
            g.read_status = lambda: (called.append(1), real())[1]
            g.main()
            return sys.stdout.getvalue(), called
        finally:
            g.read_status, sys.stdin, sys.stdout = orig_read, orig_in, orig_out

    def test_read_only_prints_nothing_and_never_touches_db(self):
        out, called = self.run_main({"session_id": ME, "tool_name": "Bash", "tool_input": {"command": "git status"}}, RuntimeError("db down"))
        self.assertEqual(out, "")
        self.assertEqual(called, [])

    def test_local_test_with_db_down_is_unaffected(self):
        out, called = self.run_main({"session_id": ME, "tool_name": "Bash", "tool_input": {"command": "npx vitest run"}}, RuntimeError("db down"))
        self.assertEqual((out, called), ("", []))

    def test_production_write_emits_only_json(self):
        import json
        out, _ = self.run_main({"session_id": ME, "tool_name": S + "apply_migration", "tool_input": {"query": "create table t(a int)"}}, {"state": "free"})
        payload = json.loads(out)
        self.assertEqual(payload["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_production_write_with_db_down_asks(self):
        import json
        out, _ = self.run_main({"session_id": ME, "tool_name": S + "execute_sql", "tool_input": {"query": "delete from t"}}, RuntimeError("db down"))
        self.assertEqual(json.loads(out)["hookSpecificOutput"]["permissionDecision"], "ask")

    def test_production_write_by_holder_prints_nothing(self):
        out, _ = self.run_main({"session_id": ME, "tool_name": "Bash", "tool_input": {"command": "gh pr merge 1"}}, MINE)
        self.assertEqual(out, "")


if __name__ == "__main__":
    unittest.main()
