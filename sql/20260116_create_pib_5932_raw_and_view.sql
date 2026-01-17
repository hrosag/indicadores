create table if not exists public.pib_5932_raw (
  id bigserial primary key,
  d1c text not null,
  d1n text,
  d2c text not null,
  d2n text,
  d3c text not null,
  d3n text,
  c11255c text,
  c11255n text,
  mc text,
  mn text,
  nc text,
  nn text,
  v text,
  source_url text,
  collected_at timestamptz not null default now()
);

create unique index if not exists pib_5932_raw_unique_idx
  on public.pib_5932_raw (d1c, d2c, d3c, coalesce(c11255c, ''));

drop view if exists public.vw_pib_5932_quarterly;

create view public.vw_pib_5932_quarterly as
with base as (
  select
    substring(d3c, 1, 4)::int as ano,
    substring(d3c, 5, 2)::int as trimestre,
    case substring(d3c, 5, 2)
      when '01' then 3
      when '02' then 6
      when '03' then 9
      when '04' then 12
    end as mes_final,
    c11255c,
    c11255n,
    d2c,
    v
  from public.pib_5932_raw
)
select
  ano,
  trimestre,
  to_char(make_date(ano, mes_final, 1), 'YYYY-MM') as data,
  c11255c,
  c11255n,
  max(case when d2c = '6561' then nullif(v, '')::numeric end) as var_qoq,
  max(case when d2c = '6562' then nullif(v, '')::numeric end) as var_yoy,
  max(case when d2c = '6563' then nullif(v, '')::numeric end) as var_ytd,
  max(case when d2c = '6564' then nullif(v, '')::numeric end) as var_4q
from base
where mes_final is not null
group by ano, trimestre, mes_final, c11255c, c11255n
order by ano, trimestre, c11255c, c11255n;
