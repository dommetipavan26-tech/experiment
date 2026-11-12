-- Relay v1.1 guardrails
-- Input validation, anonymous intake rate limiting, an atomic confirmation
-- helper, and a QA snapshot view. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Length / value constraints on every client-writable text column
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'relay_incidents_title_length' and conrelid = 'public.incidents'::regclass
  ) then
    execute 'alter table public.incidents add constraint relay_incidents_title_length check (char_length(btrim(title)) between 3 and 200)';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'relay_incidents_summary_length' and conrelid = 'public.incidents'::regclass
  ) then
    execute 'alter table public.incidents add constraint relay_incidents_summary_length check (char_length(summary) <= 2000)';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'relay_incidents_assignee_length' and conrelid = 'public.incidents'::regclass
  ) then
    execute 'alter table public.incidents add constraint relay_incidents_assignee_length check (char_length(assignee) <= 120)';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'relay_updates_body_length' and conrelid = 'public.incident_updates'::regclass
  ) then
    execute 'alter table public.incident_updates add constraint relay_updates_body_length check (char_length(btrim(body)) between 1 and 2000)';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'relay_signals_title_length' and conrelid = 'public.signals'::regclass
  ) then
    execute 'alter table public.signals add constraint relay_signals_title_length check (char_length(btrim(title)) between 3 and 200)';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'relay_signals_detail_length' and conrelid = 'public.signals'::regclass
  ) then
    execute 'alter table public.signals add constraint relay_signals_detail_length check (char_length(detail) <= 1000)';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'relay_signals_confirmations_range' and conrelid = 'public.signals'::regclass
  ) then
    execute 'alter table public.signals add constraint relay_signals_confirmations_range check (confirmations between 0 and 100000)';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'relay_activity_message_length' and conrelid = 'public.activity'::regclass
  ) then
    execute 'alter table public.activity add constraint relay_activity_message_length check (char_length(message) between 1 and 400)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Field signal intake guard: normalise text and cap anonymous submissions
-- ---------------------------------------------------------------------------
create or replace function public.relay_guard_signal_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare recent integer;
begin
  new.title := btrim(new.title);
  new.detail := btrim(coalesce(new.detail, ''));
  new.location := btrim(coalesce(new.location, ''));
  new.reporter := left(btrim(coalesce(new.reporter, 'Field report')), 120);

  if char_length(new.title) < 3 then
    raise exception 'A field signal needs at least a 3 character title'
      using errcode = '23514';
  end if;

  select count(*) into recent
  from public.signals
  where created_at > now() - interval '60 seconds';

  if recent >= 60 then
    raise exception 'Signal intake is temporarily rate limited. Please retry in a moment.'
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists relay_signal_guard on public.signals;
create trigger relay_signal_guard
  before insert on public.signals
  for each row execute function public.relay_guard_signal_insert();

-- ---------------------------------------------------------------------------
-- Atomic confirmation counter (avoids lost updates across consoles)
-- ---------------------------------------------------------------------------
create or replace function public.relay_confirm_signal(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare new_count integer;
begin
  update public.signals
     set confirmations = least(confirmations + 1, 100000)
   where id = p_id
  returning confirmations into new_count;

  if new_count is null then
    raise exception 'Signal not found' using errcode = 'P0002';
  end if;
  return new_count;
end $$;

grant execute on function public.relay_confirm_signal(uuid) to public;

-- ---------------------------------------------------------------------------
-- QA snapshot for verification dashboards
-- ---------------------------------------------------------------------------
create or replace view public.relay_qa_snapshot as
select
  (select count(*) from public.incidents)                     as incidents,
  (select count(*) from public.incident_updates)              as incident_updates,
  (select count(*) from public.signals)                       as signals,
  (select count(*) from public.activity)                      as activity_events,
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public') as realtime_tables,
  now()                                                        as checked_at;

grant select on public.relay_qa_snapshot to public;
