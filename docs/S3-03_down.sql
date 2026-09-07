-- ============================================================================
-- S3-03 · ROLLBACK
-- Restores the exact pre-package state. Safe to run at any point after up.sql.
-- Data written to decision_events between up and down is preserved in an
-- archive table (never dropped) so the audit trail is not destroyed.
-- ============================================================================
begin;

-- 0. Preserve any events written since up.sql (append-only archive)
create table if not exists public.decision_events_archive_s3_03 (like public.decision_events including all);
insert into public.decision_events_archive_s3_03 overriding system value select * from public.decision_events on conflict do nothing;

-- 1. Drop the observability view
drop view if exists public.v_decision_trail;

-- 2. Restore the ORIGINAL bg_check_decide (verbatim from production, captured 2026-09-07)
drop function if exists public.bg_check_decide(uuid, text, text, text, text, text, text);

create or replace function public.bg_check_decide(p_id uuid, p_decision text, p_notes text default null::text)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid  uuid := auth.uid();
  v_prev text;
begin
  if v_uid is not null and not (public.is_staff() or public.is_platform_admin()) then
    raise exception 'bg_check_decide: staff or admin only' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in
     ('Eligible','Not Eligible','Need Manager''s Review','out of radius','Not found') then
    raise exception 'bg_check_decide: decision must be one of Eligible | Not Eligible | Need Manager''s Review | out of radius | Not found';
  end if;

  if length(coalesce(p_notes,'')) > 4000 then
    raise exception 'bg_check_decide: notes too long';
  end if;

  select eligibility_status into v_prev from public.background_checks where id = p_id;
  if not found then
    raise exception 'bg_check_decide: background check % not found', p_id;
  end if;

  update public.background_checks
     set eligibility_status = p_decision,
         review_notes       = coalesce(nullif(btrim(coalesce(p_notes,'')),''), review_notes),
         date_verified      = current_date,
         reviewed_by        = v_uid,
         reviewed_at        = now(),
         updated_at         = now()
   where id = p_id;

  return jsonb_build_object(
    'id', p_id, 'from', v_prev, 'to', p_decision, 'reviewed_at', now()
  );
end;
$function$;
revoke all on function public.bg_check_decide(uuid,text,text) from public, anon;
grant execute on function public.bg_check_decide(uuid,text,text) to authenticated, service_role;

-- 3. Drop new functions
drop function if exists public.record_decision_event(uuid,text,text,text,text,text,uuid,text,text);
drop function if exists public.resolve_person_id(text,text);

-- 4. Remove added columns from background_checks (values are re-derivable from decision_events_archive)
alter table public.background_checks
  drop column if exists last_decision_event_id,
  drop column if exists reason_code,
  drop column if exists lead_match_method,
  drop column if exists lead_id;

-- 5. Drop new tables (archive retained)
drop table if exists public.decision_events;
drop table if exists public.reason_codes;
drop table if exists public.reason_categories;

commit;

-- NOTE: decision_events_archive_s3_03 is intentionally left in place.
-- Drop it only by separate, explicit owner authorization.
