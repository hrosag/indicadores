create table if not exists public.finance_simulations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  created_by uuid not null references auth.users (id) on delete cascade,
  title text,
  mode text not null default 'COMMERCIAL_BULLET',
  inputs jsonb not null default '{}'::jsonb,
  version int not null default 1
);

alter table public.finance_simulations alter column created_by set default auth.uid();

alter table public.finance_simulations enable row level security;

create policy "Admin users can manage finance simulations"
  on public.finance_simulations
  for all
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.is_active = true
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.is_active = true
    )
  );

create index if not exists idx_finance_simulations_created_by
  on public.finance_simulations (created_by);

create index if not exists idx_finance_simulations_created_at
  on public.finance_simulations (created_at desc);
