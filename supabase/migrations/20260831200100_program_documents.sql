-- Real document uploads for the credit/funding journey.
--
-- /learn/documents shipped with no file input at all. "Mark uploaded" flipped a
-- boolean in browser state, and that boolean is what /work/admin reads as
-- docsOk to unlock "Approve → supervisor". So the document-verification gate of
-- the whole funding application was a checkbox with no document behind it, and
-- an applicant could satisfy it without ever producing a payslip.
--
-- This is the storage half. A private bucket, a table that records what landed
-- in it, and policies that keep an applicant to their own application.
--
-- Deliberately NOT reusing `documents`: that table is keyed on case_id, belongs
-- to the rentals workflow, and 20260828000000 locked it to platform admins.
-- Funding applicants are not admins and have no case.

-- ── bucket ───────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'program-documents',
  'program-documents',
  false,
  12582912, -- 12 MB, same ceiling as vendor uploads
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- ── table ────────────────────────────────────────────────────────────────────
create table if not exists public.program_documents (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.program_applications (id) on delete cascade,
  doc_key        text not null,            -- matches Application.documents[].id
  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text not null,
  size_bytes     integer not null,
  verified_at    timestamptz,
  verified_by    uuid references auth.users (id) on delete set null,
  uploaded_by    uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists program_documents_application_idx
  on public.program_documents (application_id);

-- One live file per checklist item. Replacing a document deletes the old row.
create unique index if not exists program_documents_one_per_key
  on public.program_documents (application_id, doc_key);

alter table public.program_documents enable row level security;

-- ── who may see a row ────────────────────────────────────────────────────────
-- Staff and admins, or the applicant whose email matches the application. The
-- server actions that write here run on the service role and do their own
-- ownership check (including the access_token path, which has no session at
-- all), so these policies exist to bound everything that is NOT that path.
drop policy if exists program_documents_staff on public.program_documents;
create policy program_documents_staff on public.program_documents
  as permissive for all to authenticated
  using (public.is_staff() or public.is_platform_admin())
  with check (public.is_staff() or public.is_platform_admin());

drop policy if exists program_documents_own on public.program_documents;
create policy program_documents_own on public.program_documents
  as permissive for select to authenticated
  using (
    exists (
      select 1
      from public.program_applications a
      where a.id = program_documents.application_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
    )
  );

revoke all on public.program_documents from anon;

-- ── who may touch the objects ────────────────────────────────────────────────
-- Nothing but the service role. Every read is served through a signed URL and
-- every write goes through the server action, so no browser needs direct
-- bucket access — and an applicant's payslips should not be one guessed object
-- key away.
drop policy if exists program_documents_objects_staff on storage.objects;
create policy program_documents_objects_staff on storage.objects
  as permissive for all to authenticated
  using (
    bucket_id = 'program-documents'
    and (public.is_staff() or public.is_platform_admin())
  )
  with check (
    bucket_id = 'program-documents'
    and (public.is_staff() or public.is_platform_admin())
  );
