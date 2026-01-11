from __future__ import annotations

import os
import sys
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


def upsert_supabase(table: str, records: list[dict[str, Any]]) -> None:
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    endpoint = f"{supabase_url}/rest/v1/{table}"
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
        r = requests.post(endpoint, headers=headers, json=chunk, timeout=120)
        r.raise_for_status()


def main() -> None:
    dataset_path = sys.argv[1] if len(sys.argv) > 1 else "datasets/ibge_ipca_1737.yml"
    job = load_job(dataset_path)

    df, _content_type = fetch_sidra(job.url)
    records = to_records(df, source_url=job.url)

    if not records:
        raise RuntimeError("Sem registros retornados pela API SIDRA.")

    upsert_supabase("ipca_1737_raw", records)
    print(f"OK: inseridos/upsert {len(records)} registros em ipca_1737_raw")


if __name__ == "__main__":
    main()
