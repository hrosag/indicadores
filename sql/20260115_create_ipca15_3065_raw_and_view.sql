create table if not exists public.ipca15_3065_raw (
  id bigserial primary key,
  d1c text not null,
  d1n text,
  d2c text not null,
  d2n text,
  d3c text not null,
  d3n text,
  mc text,
  mn text,
  nc text,
  nn text,
  v text,
  source_url text,
  collected_at timestamptz not null default now()
);

create unique index if not exists ipca15_3065_raw_unique_idx
  on public.ipca15_3065_raw (d1c, d2c, d3c);

create or replace view public.vw_ipca15_3065_monthly as
select
  substring(d3c, 1, 4)::int as ano,
  case substring(d3c, 5, 2)
    when '01' then 'janeiro'
    when '02' then 'fevereiro'
    when '03' then 'março'
    when '04' then 'abril'
    when '05' then 'maio'
    when '06' then 'junho'
    when '07' then 'julho'
    when '08' then 'agosto'
    when '09' then 'setembro'
    when '10' then 'outubro'
    when '11' then 'novembro'
    when '12' then 'dezembro'
  end as mes,
  to_char(to_date(d3c || '01', 'YYYYMMDD'), 'YYYY-MM') as data,
  max(case when d2c = '1117' then nullif(v, '')::numeric end) as num_indice,
  max(case when d2c = '355' then nullif(v, '')::numeric end) as var_m,
  max(case when d2c = '356' then nullif(v, '')::numeric end) as var_3_m,
  max(case when d2c = '1118' then nullif(v, '')::numeric end) as var_6_m,
  max(case when d2c = '1119' then nullif(v, '')::numeric end) as var_ano,
  max(case when d2c = '1120' then nullif(v, '')::numeric end) as var_12_m
from public.ipca15_3065_raw
where d1c = '1'
group by d3c
order by d3c;
