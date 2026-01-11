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


MONTH_PT = {
    1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
    7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
}

# Mapeamento SIDRA (Tabela 1737) -> colunas desejadas
VAR_MAP = {
    "2266": "NUMERO INDICE",
    "63":   "MES",        # variação mensal (sim, cabeçalho “MES” como você pediu)
    "2263": "3 Meses",
    "2264": "6 MESES",
    "69":   "ANO",        # acumulada no ano (sim, cabeçalho “ANO” como você pediu)
    "2265": "12 MESES",
}


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
    if t.startswith("[") or t.startswith("{"):
        try:
            return pd.read_json(pd.io.common.StringIO(text))
        except Exception:
            pass
    return pd.read_xml(text, xpath=".//ValorDescritoPorSuasDimensoes")


def clean(df: pd.DataFrame) -> pd.DataFrame:
    # remove linha “cabeçalho”
    if "D1C" in df.columns:
        df = df[~df["D1C"].astype(str).str.contains(r"\(Código\)", regex=True)].copy()

    # normaliza tipos
    if "D2C" in df.columns:
        df["D2C"] = df["D2C"].astype(str).str.strip()
    if "D3C" in df.columns:
        df["D3C"] = df["D3C"].astype(str).str.strip()
    if "V" in df.columns:
        df["V"] = pd.to_numeric(df["V"], errors="coerce")

    return df


def to_wide(df: pd.DataFrame) -> pd.DataFrame:
    # Esperado: D2C (código variável), D3C (YYYYMM), V (valor)
    needed = {"D2C", "D3C", "V"}
    missing = needed - set(df.columns)
    if missing:
        raise ValueError(f"Colunas ausentes no retorno SIDRA: {missing}")

    # mantém só as variáveis do seu layout (tabela 1737)
    df2 = df[df["D2C"].isin(VAR_MAP.keys())].copy()

    # pivot: linhas = mês, colunas = variável
    wide = (
        df2.pivot_table(index="D3C", columns="D2C", values="V", aggfunc="first")
        .reset_index()
        .rename(columns={"D3C": "YYYYMM"})
    )

    # ANO e MÊS
    wide["ANO"] = wide["YYYYMM"].str.slice(0, 4).astype(int)
    wide["_mes_num"] = wide["YYYYMM"].str.slice(4, 6).astype(int)
    wide["MES"] = wide["_mes_num"].map(MONTH_PT)

    # renomeia colunas das variáveis para os headers desejados
    for code, colname in VAR_MAP.items():
        if code in wide.columns:
            wide = wide.rename(columns={code: colname})
        else:
            wide[colname] = pd.NA

    # monta exatamente a ordem e nomes pedidos (inclui cabeçalhos duplicados: MES e ANO)
    out = wide[["ANO", "MES", "NUMERO INDICE", "MES", "3 Meses", "6 MESES", "ANO", "12 MESES"]].copy()

    # opcional: arredondar (mantém número, Excel formata)
    num_cols = ["NUMERO INDICE", "MES", "3 Meses", "6 MESES", "ANO", "12 MESES"]
    for c in num_cols:
        out[c] = pd.to_numeric(out[c], errors="coerce").round(2)

    return out


def main() -> None:
    dataset_path = sys.argv[1] if len(sys.argv) > 1 else "datasets/ibge_ipca_1737.yml"

    job = load_job(dataset_path)
    text, content_type = fetch_payload(job.url)
    df_raw = parse_payload(text)
    df = clean(df_raw)
    df_wide = to_wide(df)

    meta = pd.DataFrame(
        {
            "name": [job.name],
            "dataset_path": [dataset_path],
            "url": [job.url],
            "content_type": [content_type],
            "rows_raw": [len(df)],
            "rows_wide": [len(df_wide)],
        }
    )

    os.makedirs(os.path.dirname(job.output_xlsx), exist_ok=True)
    with pd.ExcelWriter(job.output_xlsx, engine="openpyxl") as writer:
        df_wide.to_excel(writer, index=False, sheet_name="data")
        meta.to_excel(writer, index=False, sheet_name="meta")

    print(f"OK: {job.output_xlsx} (raw={len(df)}, wide={len(df_wide)})")


if __name__ == "__main__":
    main()
