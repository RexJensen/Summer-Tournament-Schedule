create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  created_at timestamptz default now()
);

create table if not exists event_status (
  user_id uuid references users(id) on delete cascade,
  event_key text not null,
  status text not null check (status in ('planned','played','cashed','skipped')),
  entries int not null default 1,
  cash_amount numeric(10,2),
  notes text,
  updated_at timestamptz default now(),
  primary key (user_id, event_key)
);

create index if not exists event_status_user_id_idx on event_status(user_id);
