create table if not exists public.ipp_6904_raw (
  id bigserial primary key,
  d1c text not null,
  d1n text,
  d2c text not null,
  d2n text,
  d3c text not null,
  d3n text,
  c543c text,
  c543n text,
  mc text,
  mn text,
  nc text,
  nn text,
  v text,
  source_url text,
  collected_at timestamptz not null default now()
);

create unique index if not exists ipp_6904_raw_unique_idx
  on public.ipp_6904_raw (d1c, d2c, d3c, coalesce(c543c, ''));

create or replace view public.vw_ipp_6904_monthly as
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
  c543c,
  c543n,
  max(case when d2c = '10008' then nullif(v, '')::numeric end) as num_indice,
  max(case when d2c = '1394' then nullif(v, '')::numeric end) as var_m,
  max(case when d2c = '1395' then nullif(v, '')::numeric end) as var_ano,
  max(case when d2c = '1396' then nullif(v, '')::numeric end) as var_12_m
from public.ipp_6904_raw
where d1c = '1'
group by d3c, c543c, c543n
order by d3c, c543c, c543n;
