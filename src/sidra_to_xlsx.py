from __future__ import annotations

import os
import sys
from dataclasses import dataclass

import pandas as pd
import requests
import yaml


@dataclass
class Job:
    name: str
    url: str
    output_xlsx: str


def load_job(path: str) -> Job:
    with open(path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    return Job(
        name=str(cfg["name"]),
        url=str(cfg["url"]),
        output_xlsx=str(cfg["output_xlsx"]),
    )


def fetch_payload(url: str) -> tuple[str, str]:
    headers = {"Accept": "application/json, text/xml;q=0.9, */*;q=0.8"}
    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()
    return r.text, r.headers.get("Content-Type", "")


def parse_payload(text: str) -> pd.DataFrame:
    t = text.lstrip()

    # JSON
    if t.startswith("[") or t.startswith("{"):
        try:
            return pd.read_json(pd.io.common.StringIO(text))
        except Exception:
            pass

    # XML (SIDRA)
    return pd.read_xml(text, xpath=".//ValorDescritoPorSuasDimensoes")


def clean(df: pd.DataFrame) -> pd.DataFrame:
    # Remove a primeira linha “cabeçalho”, quando existir
    if "D1C" in df.columns:
        df = df[~df["D1C"].astype(str).str.contains(r"\(Código\)", regex=True)].copy()

    # Normaliza período se existir D3C = YYYYMM
    if "D3C" in df.columns:
        s = df["D3C"].astype(str).str.strip()
        df["period_ym"] = s.where(s.str.match(r"^\d{6}$"), other=pd.NA)
        df["period_ym"] = df["period_ym"].str.slice(0, 4) + "-" + df["period_ym"].str.slice(4, 6)

    # Valor numérico
    if "V" in df.columns:
        df["value"] = pd.to_numeric(df["V"], errors="coerce")

    return df


def main() -> None:
    dataset_path = sys.argv[1] if len(sys.argv) > 1 else "datasets/ibge_ipca_1737.yml"

    job = load_job(dataset_path)
    text, content_type = fetch_payload(job.url)
    df = clean(parse_payload(text))

    meta = pd.DataFrame(
        {
            "name": [job.name],
            "dataset_path": [dataset_path],
            "url": [job.url],
            "content_type": [content_type],
            "rows": [len(df)],
        }
    )

    os.makedirs(os.path.dirname(job.output_xlsx), exist_ok=True)
    with pd.ExcelWriter(job.output_xlsx, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="data")
        meta.to_excel(writer, index=False, sheet_name="meta")

    print(f"OK: {job.output_xlsx} (rows={len(df)})")


if __name__ == "__main__":
    main()
