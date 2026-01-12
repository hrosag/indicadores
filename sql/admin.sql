create table if not exists public.admin_users (
  id bigserial primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ingest_jobs (
  id bigserial primary key,
  dataset text not null,
  params jsonb not null default '{}',
  status text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ingest_jobs_status_idx on public.ingest_jobs (status);
create index if not exists ingest_jobs_dataset_idx on public.ingest_jobs (dataset);
create index if not exists ingest_jobs_requested_by_idx on public.ingest_jobs (requested_by);
create index if not exists ingest_jobs_created_at_idx on public.ingest_jobs (created_at);

alter table public.admin_users enable row level security;
alter table public.ingest_jobs enable row level security;

create policy "Admin users can read own row"
  on public.admin_users
  for select
  using (auth.uid() = user_id);

create policy "Admins can read ingest jobs"
  on public.ingest_jobs
  for select
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.is_active = true
    )
  );

create policy "Admins can insert ingest jobs"
  on public.ingest_jobs
  for insert
  with check (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.is_active = true
    )
  );
