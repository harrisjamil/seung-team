create table if not exists public.ships (
  ship_id text primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  speed_knots double precision not null,
  heading_deg double precision not null,
  destination_port_id text not null,
  destination_port_name text not null,
  fuel_tonnes double precision not null,
  cargo jsonb not null default '{}'::jsonb,
  status text not null,
  weather_adverse boolean not null default false,
  fuel_required_remaining_tonnes double precision null,
  route jsonb not null default '[]'::jsonb,
  route_meta jsonb null,
  updated_at bigint not null
);

create table if not exists public.ship_history (
  id bigserial primary key,
  t bigint not null,
  ships jsonb not null,
  alerts jsonb not null,
  zones jsonb not null
);

create index if not exists ship_history_t_idx on public.ship_history (t desc);

create table if not exists public.alerts (
  alert_id text primary key,
  type text not null,
  severity_score integer not null,
  title text not null,
  detail text not null,
  ship_ids text[] not null default '{}',
  created_at bigint not null,
  acknowledged boolean not null default false,
  resolved boolean not null default false,
  directive_id text null
);

create index if not exists alerts_created_idx on public.alerts (created_at desc);

create table if not exists public.directives (
  directive_id text primary key,
  ship_id text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  issued_at bigint not null,
  acknowledged_by_captain_at bigint null,
  response text null
);

create table if not exists public.distress_logs (
  id bigserial primary key,
  directive_id text not null,
  ship_id text not null,
  raw_message text not null,
  structured jsonb not null,
  severity_score integer not null,
  created_at bigint not null
);

create table if not exists public.zones (
  zone_id text primary key,
  name text not null,
  ring jsonb not null,
  created_at bigint not null
);

create table if not exists public.restricted_zones (
  zone_id text primary key,
  name text not null,
  ring jsonb not null,
  created_at bigint not null
);

insert into public.restricted_zones (zone_id, name, ring, created_at)
select z.zone_id, z.name, z.ring, z.created_at
from public.zones z
on conflict (zone_id) do update
set
  name = excluded.name,
  ring = excluded.ring,
  created_at = excluded.created_at;

create table if not exists public.users (
  user_id text primary key,
  username text not null unique,
  password text not null,
  role text not null check (role in ('command', 'captain')),
  ship_id text null,
  display_name text not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

insert into public.users (user_id, username, password, role, ship_id, display_name)
values
  ('seed-command-001', 'command@fleet.local', 'command123', 'command', null, 'Fleet Command'),
  ('seed-captain-001', 'captain@fleet.local', 'captain123', 'captain', 'BRV-001', 'Captain BRV-001')
on conflict (user_id) do update
set
  username = excluded.username,
  password = excluded.password,
  role = excluded.role,
  ship_id = excluded.ship_id,
  display_name = excluded.display_name;

create table if not exists public.api_integrations (
  id bigserial primary key,
  provider text not null,
  token text not null,
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_integrations_provider_key unique (provider)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_api_integrations_updated_at on public.api_integrations;
create trigger trg_api_integrations_updated_at
before update on public.api_integrations
for each row
execute function public.set_updated_at();
