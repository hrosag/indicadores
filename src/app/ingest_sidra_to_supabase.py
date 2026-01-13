from __future__ import annotations

import argparse
import math
import numbers
import os
import re
from dataclasses import dataclass
from typing import Any

import pandas as pd
import requests
import yaml


@dataclass
class Job:
    name: str
    url: str


def load_job(path: str) -> Job:
    with open(path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    return Job(name=str(cfg["name"]), url=str(cfg["url"]))


def with_period(url: str, period: str) -> str:
    if "/p/" not in url:
        raise ValueError("URL SIDRA sem segmento /p/ para período.")
    return re.sub(r"/p/[^/]+", f"/p/{period}", url)


def fetch_sidra(url: str) -> tuple[pd.DataFrame, str]:
    headers = {"Accept": "application/json, text/xml;q=0.9, */*;q=0.8"}
    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()
    content_type = r.headers.get("Content-Type", "")
    text = r.text

    t = text.lstrip()
    if t.startswith("[") or t.startswith("{"):
        df = pd.read_json(pd.io.common.StringIO(text))
    else:
        df = pd.read_xml(text, xpath=".//ValorDescritoPorSuasDimensoes")

    # remove linha de “cabeçalho”
    if "D1C" in df.columns:
        df = df[~df["D1C"].astype(str).str.contains(r"\(Código\)", regex=True)].copy()

    # normaliza valor
    if "V" in df.columns:
        df["V"] = pd.to_numeric(df["V"], errors="coerce")

    return df, content_type


def max_period(df: pd.DataFrame) -> str:
    if "D3C" not in df.columns:
        raise RuntimeError("Resposta SIDRA sem coluna D3C para período.")
    periods = pd.to_numeric(df["D3C"], errors="coerce").dropna().astype(int)
    if periods.empty:
        raise RuntimeError("Nenhum período válido encontrado em D3C.")
    return str(periods.max())


def period_from_url(url: str) -> str:
    match = re.search(r"/p/(\d{6})", url)
    if not match:
        raise RuntimeError("Não foi possível extrair período da URL base.")
    return match.group(1)


def next_period(period: str) -> str:
    year = int(period[:4])
    month = int(period[4:])
    if month < 1 or month > 12:
        raise ValueError(f"Período inválido: {period}")
    if month == 12:
        return f"{year + 1}01"
    return f"{year}{month + 1:02d}"


def build_periods(first_period: str, last_period: str) -> list[str]:
    periods = []
    current = first_period
    while True:
        periods.append(current)
        if current == last_period:
            break
        current = next_period(current)
        if len(periods) > 2000:
            raise RuntimeError("Intervalo de períodos excedeu limite esperado.")
    return periods


def to_records(df: pd.DataFrame, source_url: str) -> list[dict[str, Any]]:
    # Map SIDRA keys -> DB columns
    # Mantém o “raw” em colunas fixas
    cols = {
        "D1C": "d1c",
        "D1N": "d1n",
        "D2C": "d2c",
        "D2N": "d2n",
        "D3C": "d3c",
        "D3N": "d3n",
        "MC": "mc",
        "MN": "mn",
        "NC": "nc",
        "NN": "nn",
        "V": "v",
    }

    out = df.rename(columns=cols)
    for c in cols.values():
        if c not in out.columns:
            out[c] = None

    out["source_url"] = source_url
    # collected_at default no banco

    keep = list(cols.values()) + ["source_url"]
    out = out[keep]
    # evita NaN virar NaN (PostgREST prefere null)
    out = out.where(pd.notnull(out), None)

    return out.to_dict(orient="records")


def sanitize_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for rec in records:
        for k, v in rec.items():
            if isinstance(v, numbers.Real) and not math.isfinite(float(v)):
                rec[k] = None
    return records


def upsert_supabase(table: str, records: list[dict[str, Any]]) -> None:
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    endpoint = f"{supabase_url}/rest/v1/{table}?on_conflict=d1c,d2c,d3c"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    # envia em lotes
    batch = 500
    for i in range(0, len(records), batch):
        chunk = records[i : i + batch]
        chunk = sanitize_records(chunk)
        r = requests.post(endpoint, headers=headers, json=chunk, timeout=120)
        r.raise_for_status()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest SIDRA -> Supabase")
    parser.add_argument("--dataset", required=True, help="Dataset logical name")
    parser.add_argument(
        "--action",
        required=True,
        choices=["initial", "current"],
        help="initial = full load, current = last period only",
    )
    parser.add_argument("--config", required=True, help="Path to dataset YAML")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    job = load_job(args.config)

    total_records = 0

    if args.action == "current":
        period = None
        try:
            last_url = with_period(job.url, "last")
            df_last, _content_type = fetch_sidra(last_url)
            period = max_period(df_last)
        except (requests.RequestException, RuntimeError, ValueError):
            period = period_from_url(job.url)

        target_url = with_period(job.url, period)
        df, _content_type = fetch_sidra(target_url)
        records = to_records(df, source_url=target_url)
        records = sanitize_records(records)
        if not records:
            raise RuntimeError("Sem registros retornados pela API SIDRA.")
        upsert_supabase("ipca_1737_raw", records)
        total_records = len(records)
    else:
        try:
            first_url = with_period(job.url, "first")
            last_url = with_period(job.url, "last")
            df_first, _content_type = fetch_sidra(first_url)
            df_last, _content_type = fetch_sidra(last_url)
            first_period = max_period(df_first)
            last_period = max_period(df_last)
        except (requests.RequestException, RuntimeError, ValueError) as exc:
            raise RuntimeError(
                "Carga inicial requer endpoints /p/first e /p/last disponíveis."
            ) from exc

        periods = build_periods(first_period, last_period)

        for period in periods:
            target_url = with_period(job.url, period)
            df, _content_type = fetch_sidra(target_url)
            records = to_records(df, source_url=target_url)
            records = sanitize_records(records)
            if not records:
                raise RuntimeError("Sem registros retornados pela API SIDRA.")
            upsert_supabase("ipca_1737_raw", records)
            total_records += len(records)
            print(f"Período {period}: {len(records)} registros")

    if args.action == "initial":
        print(f"Períodos processados: {len(periods)}")

    print(
        f"OK: inseridos/upsert {total_records} registros em ipca_1737_raw ({args.dataset}/{args.action})"
    )


if __name__ == "__main__":
    main()
