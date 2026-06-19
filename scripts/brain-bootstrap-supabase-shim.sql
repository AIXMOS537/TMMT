-- brain-bootstrap-supabase-shim.sql
-- Minimal Supabase-compatibility layer so the Supabase migrations in
-- supabase/migrations/*.sql apply cleanly into a plain pgvector Postgres
-- (the LOCAL HAILMARY brain). This is NOT a full Supabase install; it only
-- provides the roles, schemas, auth.users table, auth.* claim helpers, and the
-- realtime publication that the migrations reference.
--
-- Safe + idempotent. Apply once before loading migrations.

-- Don't validate SQL function bodies at CREATE time: migrations define helper
-- functions that reference each other / not-yet-created objects.
ALTER DATABASE hailmary_brain SET check_function_bodies = off;
SET check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Roles that Supabase migrations grant to / create policies "TO".
-- ---------------------------------------------------------------------------
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'anon','authenticated','service_role','authenticator',
    'supabase_admin','supabase_auth_admin','supabase_storage_admin'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT', r);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Schemas + extensions
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS graphql_public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- auth.users — minimal shape; migrations FK-reference auth.users(id).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- auth.* claim helpers — read the current request JWT claims from GUCs,
-- exactly like Supabase. In a no-JWT local session these return NULL, so
-- RLS simply denies anon access; the service-role connection bypasses RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

-- ---------------------------------------------------------------------------
-- storage.buckets / storage.objects — minimal; referenced by document_uploads.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage.buckets (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  public      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id   text REFERENCES storage.buckets(id),
  name        text,
  owner       uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- realtime publication — migrations do ALTER PUBLICATION supabase_realtime ADD.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Baseline grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
