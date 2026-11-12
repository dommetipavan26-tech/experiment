-- Relay: live civic operations console
-- Schema, row level security, realtime publication, activity triggers, seed data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.incidents (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  title        text not null,
  summary      text not null default '',
  category     text not null default 'other'
               check (category in ('power','water','traffic','weather','network','safety','other')),
  severity     text not null default 'medium'
               check (severity in ('critical','high','medium','low')),
  status       text not null default 'triage'
               check (status in ('triage','responding','monitoring','resolved')),
  district     text not null default 'Amaravati',
  location     text not null default '',
  reporter     text not null default 'Control room',
  assignee     text not null default 'Unassigned',
  linear_id    text,
  linear_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create table if not exists public.incident_updates (
  id           uuid primary key default gen_random_uuid(),
  incident_id  uuid not null references public.incidents(id) on delete cascade,
  body         text not null,
  author       text not null default 'Control room',
  kind         text not null default 'note'
               check (kind in ('note','status','assignment','system','linear')),
  created_at   timestamptz not null default now()
);

create table if not exists public.signals (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  detail         text not null default '',
  category       text not null default 'other'
                 check (category in ('power','water','traffic','weather','network','safety','other')),
  severity       text not null default 'medium'
                 check (severity in ('critical','high','medium','low')),
  status         text not null default 'new'
                 check (status in ('new','verified','actioned','dismissed')),
  district       text not null default 'Amaravati',
  location       text not null default '',
  reporter       text not null default 'Field report',
  confirmations  integer not null default 0,
  incident_id    uuid references public.incidents(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists public.activity (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'ops'
              check (source in ('ops','field','system','github','vercel','linear')),
  kind        text not null default 'event',
  message     text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists incidents_status_idx on public.incidents (status, created_at desc);
create index if not exists incident_updates_incident_idx on public.incident_updates (incident_id, created_at desc);
create index if not exists signals_created_idx on public.signals (created_at desc);
create index if not exists activity_created_idx on public.activity (created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- Demo-grade open policies: this is a public community reporting board.
-- Tighten to authenticated-only writes before production use with real users.
-- ---------------------------------------------------------------------------

alter table public.incidents        enable row level security;
alter table public.incident_updates enable row level security;
alter table public.signals          enable row level security;
alter table public.activity         enable row level security;

drop policy if exists "relay incidents read"   on public.incidents;
drop policy if exists "relay incidents write"  on public.incidents;
drop policy if exists "relay incidents change" on public.incidents;
drop policy if exists "relay updates read"    on public.incident_updates;
drop policy if exists "relay updates write"   on public.incident_updates;
drop policy if exists "relay signals read"    on public.signals;
drop policy if exists "relay signals write"   on public.signals;
drop policy if exists "relay signals change"  on public.signals;
drop policy if exists "relay activity read"   on public.activity;
drop policy if exists "relay activity write"  on public.activity;

create policy "relay incidents read"   on public.incidents        for select to public using (true);
create policy "relay incidents write"  on public.incidents        for insert to public with check (true);
create policy "relay incidents change" on public.incidents        for update to public using (true) with check (true);
create policy "relay updates read"     on public.incident_updates for select to public using (true);
create policy "relay updates write"    on public.incident_updates for insert to public with check (true);
create policy "relay signals read"     on public.signals          for select to public using (true);
create policy "relay signals write"    on public.signals          for insert to public with check (true);
create policy "relay signals change"   on public.signals          for update to public using (true) with check (true);
create policy "relay activity read"    on public.activity         for select to public using (true);
create policy "relay activity write"   on public.activity         for insert to public with check (true);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.incidents        replica identity full;
alter table public.incident_updates replica identity full;
alter table public.signals          replica identity full;
alter table public.activity         replica identity full;

do $$
declare t text;
begin
  foreach t in array array['incidents','incident_updates','signals','activity'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.relay_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists relay_incidents_touch on public.incidents;
create trigger relay_incidents_touch before update on public.incidents
  for each row execute function public.relay_touch_updated_at();

create or replace function public.relay_log_incident()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity (source, kind, message, meta)
    values ('ops', 'incident_created', new.code || ' opened: ' || new.title,
            jsonb_build_object('incident_id', new.id, 'severity', new.severity, 'category', new.category));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.activity (source, kind, message, meta)
    values ('ops', 'status_changed', new.code || ' moved from ' || old.status || ' to ' || new.status,
            jsonb_build_object('incident_id', new.id, 'status', new.status));
  end if;
  return new;
end $$;

drop trigger if exists relay_incident_activity on public.incidents;
create trigger relay_incident_activity after insert or update on public.incidents
  for each row execute function public.relay_log_incident();

create or replace function public.relay_log_signal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity (source, kind, message, meta)
  values ('field', 'signal_received', 'Field report: ' || new.title,
          jsonb_build_object('signal_id', new.id, 'district', new.district, 'severity', new.severity));
  return new;
end $$;

drop trigger if exists relay_signal_activity on public.signals;
create trigger relay_signal_activity after insert on public.signals
  for each row execute function public.relay_log_signal();

-- ---------------------------------------------------------------------------
-- Seed data (only when the board is empty, so re-running is safe)
-- ---------------------------------------------------------------------------

insert into public.incidents (code, title, summary, category, severity, status, district, location, reporter, assignee, created_at, updated_at)
select * from (values
  ('INC-2041', 'Feeder tripped near Velagapudi', '11 kV feeder F-12 tripped at 06:12. Roughly 1,400 connections affected across Velagapudi and Rayapudi. Restoration crew is on site.', 'power', 'critical', 'responding', 'Guntur', 'Velagapudi 33/11 kV substation', 'APSPDCL SCADA', 'K. Rao / Grid Ops', now() - interval '47 minutes', now() - interval '6 minutes'),
  ('INC-2040', 'Water main breach on Seed Access Road', '400 mm distribution main ruptured under the Seed Access Road junction. Low pressure reported in Thullur and Abbarajupalem.', 'water', 'high', 'responding', 'Amaravati', 'Seed Access Road, Thullur', 'Ward 14 field officer', 'S. Devi / Water', now() - interval '2 hours 12 minutes', now() - interval '22 minutes'),
  ('INC-2039', 'Signal failure at Penumaka junction', 'Adaptive traffic controller offline; four approaches running on flashing amber. Police have deployed manual traffic control.', 'traffic', 'high', 'monitoring', 'Guntur', 'Penumaka T-junction', 'Traffic control centre', 'M. Ilias / Traffic', now() - interval '3 hours 40 minutes', now() - interval '51 minutes'),
  ('INC-2038', 'Waterlogging on Undavalli flyover approach', 'Storm drain blockage after overnight rain. Two lanes blocked; vehicles being diverted at the service road.', 'weather', 'medium', 'triage', 'Guntur', 'Undavalli flyover, east approach', 'Citizen report x14', 'Unassigned', now() - interval '4 hours 5 minutes', now() - interval '4 hours 5 minutes'),
  ('INC-2037', 'Fibre cut affects three government offices', 'Backbone fibre damaged during road works near the Secretariat. Offices running on backup 4G links.', 'network', 'medium', 'monitoring', 'Amaravati', 'Secretariat campus, Block C', 'AP FiberNet NOC', 'R. Prasad / Network', now() - interval '6 hours 20 minutes', now() - interval '1 hour 14 minutes'),
  ('INC-2036', 'Streetlight outage along Vijayawada highway', 'A 2.4 km stretch of the NH-16 service road is unlit. Night visibility risk reported by patrol units.', 'power', 'low', 'resolved', 'NTR', 'NH-16 service road, km 12-14', 'Night patrol unit 3', 'K. Rao / Grid Ops', now() - interval '1 day 3 hours', now() - interval '20 hours')
) as v
where not exists (select 1 from public.incidents);

insert into public.incident_updates (incident_id, body, author, kind, created_at)
select i.id, u.body, u.author, u.kind, now() - u.mins * interval '1 minute'
from (values
  ('INC-2041', 'SCADA alarm received. Feeder F-12 load dropped to zero.', 'SCADA gateway', 'system', 47),
  ('INC-2041', 'Crew dispatched from Guntur depot. ETA 18 minutes.', 'K. Rao', 'assignment', 39),
  ('INC-2041', 'Fault localised to a failed insulator on pole 42. Alternate feed being arranged for critical loads.', 'K. Rao', 'note', 12),
  ('INC-2041', 'Partial restoration: 620 connections back via the Nidamarru alternate feed.', 'Control room', 'status', 6),
  ('INC-2040', 'Bulk supply to Thullur isolated. Valve crew requested to clamp the breach.', 'S. Devi', 'note', 118),
  ('INC-2040', 'Tanker deployment approved for Ward 14 and Ward 16.', 'Duty commissioner', 'status', 22),
  ('INC-2039', 'Manual traffic control in place at all four approaches.', 'M. Ilias', 'status', 195),
  ('INC-2039', 'Vendor engineer scheduled with a replacement controller board.', 'M. Ilias', 'note', 51),
  ('INC-2037', 'Backup 4G routers activated in three offices.', 'R. Prasad', 'status', 350),
  ('INC-2036', 'All 38 light points restored and verified by patrol.', 'K. Rao', 'status', 1200)
) as u(code, body, author, kind, mins)
join public.incidents i on i.code = u.code
where not exists (select 1 from public.incident_updates);

insert into public.signals (title, detail, category, severity, status, district, location, reporter, confirmations, incident_id, created_at)
select s.title, s.detail, s.category, s.severity, s.status, s.district, s.location, s.reporter, s.confirmations, i.id, now() - s.mins * interval '1 minute'
from (values
  ('No supply since 06:10 in Rayapudi', 'Whole street dark, APSPDCL helpline busy.', 'power', 'high', 'verified', 'Guntur', 'Rayapudi main road', 'Resident, Ward 3', 18, 'INC-2041', 41),
  ('Low water pressure in Abbarajupalem', 'Tap running dry since early morning.', 'water', 'medium', 'verified', 'Amaravati', 'Abbarajupalem', 'Resident, Ward 16', 11, 'INC-2040', 96),
  ('Long queue at Penumaka junction', 'Signal off, roughly 20 minute delay toward Vijayawada.', 'traffic', 'high', 'actioned', 'Guntur', 'Penumaka junction', 'Commuter report', 27, 'INC-2039', 188),
  ('Standing water near Undavalli flyover', 'Two-wheeler lane fully submerged.', 'weather', 'medium', 'new', 'Guntur', 'Undavalli east approach', 'Field volunteer', 9, 'INC-2038', 74),
  ('Internet down at Block C', 'Video conferencing unavailable in three departments.', 'network', 'low', 'verified', 'Amaravati', 'Secretariat Block C', 'Office IT desk', 6, 'INC-2037', 310),
  ('Transformer humming loudly', 'Audible arcing sound near the substation fence.', 'safety', 'critical', 'new', 'Guntur', 'Velagapudi substation', 'Field volunteer', 4, 'INC-2041', 8),
  ('Drain overflow at Dondapadu', 'Debris blocking the storm water inlet.', 'weather', 'low', 'new', 'Amaravati', 'Dondapadu main drain', 'Sanitation worker', 3, null, 27),
  ('Bus diversion requested', 'RTC buses unable to turn at the flooded service road.', 'traffic', 'medium', 'new', 'NTR', 'NH-16 service road', 'RTC depot', 7, null, 14),
  ('Streetlight flickering near school', 'Zebra crossing poorly lit at dusk.', 'safety', 'low', 'dismissed', 'Amaravati', 'Thullur government school', 'Parent report', 2, null, 190)
) as s(title, detail, category, severity, status, district, location, reporter, confirmations, code, mins)
left join public.incidents i on i.code = s.code
where not exists (select 1 from public.signals);

insert into public.activity (source, kind, message, meta, created_at)
select * from (values
  ('system'::text, 'board_ready'::text, 'Operations board initialised for the Amaravati region', '{}'::jsonb, now() - interval '8 hours'),
  ('github'::text, 'commit'::text, 'Repository dommetipavan26-tech/experiment connected to Relay', '{"repo":"dommetipavan26-tech/experiment"}'::jsonb, now() - interval '7 hours 40 minutes'),
  ('vercel'::text, 'deploy'::text, 'Production deployment wired to the Relay console', '{"target":"production"}'::jsonb, now() - interval '7 hours 22 minutes'),
  ('linear'::text, 'sync'::text, 'Escalation pipeline connected to Linear team PAV', '{"team":"PAV"}'::jsonb, now() - interval '7 hours 5 minutes')
) as a
where not exists (select 1 from public.activity where kind in ('board_ready','commit','deploy','sync'));
