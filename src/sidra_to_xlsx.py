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

# Códigos da Tabela 1737 (variáveis) -> rótulos desejados
# (internamente usamos nomes únicos)
VAR_MAP = {
    "2266": "NUMERO INDICE",
    "63":   "MES_VAR",      # variação mensal
    "2263": "3 Meses",
    "2264": "6 MESES",
    "69":   "ANO_VAR",      # acumulada no ano
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
    # remove linha “cabeçalho” (aquela que traz “Brasil (Código)” etc.)
    if "D1C" in df.columns:
        df = df[~df["D1C"].astype(str).str.contains(r"\(Código\)", regex=True)].copy()

    for c in ["D1C", "D2C", "D3C", "D3N", "D2N"]:
        if c in df.columns:
            df[c] = df[c].astype(str).str.strip()

    if "V" in df.columns:
        df["V"] = pd.to_numeric(df["V"], errors="coerce")

    return df


def reshape_like_sidra_but_ordered(df: pd.DataFrame) -> pd.DataFrame:
    needed = {"D2C", "D3C", "V"}
    missing = needed - set(df.columns)
    if missing:
        raise ValueError(f"Colunas ausentes no retorno SIDRA: {missing}")

    # Deriva ANO e MES a partir de D3C (YYYYMM)
    d3c = df["D3C"].astype(str)
    if not d3c.str.match(r"^\d{6}$").all():
        # Se vier fora do padrão, não inventa; deixa em branco
        df["ANO"] = pd.NA
        df["MES"] = pd.NA
    else:
        df["ANO"] = d3c.str.slice(0, 4).astype(int)
        mes_num = d3c.str.slice(4, 6).astype(int)
        df["MES"] = mes_num.map(MONTH_PT)

    # Mantém só as 6 variáveis do layout desejado
    df2 = df[df["D2C"].isin(VAR_MAP.keys())].copy()

    # Pivot apenas para montar 1 linha por período (sem duplicar nomes depois)
    wide = (
        df2.pivot_table(index=["ANO", "MES"], columns="D2C", values="V", aggfunc="first")
        .reset_index()
    )

    # Renomeia códigos -> nomes únicos
    wide = wide.rename(columns={code: name for code, name in VAR_MAP.items()})

    # Garante colunas existirem
    for name in VAR_MAP.values():
        if name not in wide.columns:
            wide[name] = pd.NA

    # Monta a ordem final (com nomes únicos; depois “mascara” no Excel)
    ordered = wide[["ANO", "MES", "NUMERO INDICE", "MES_VAR", "3 Meses", "6 MESES", "ANO_VAR", "12 MESES"]].copy()

    # Arredonda numéricos
    for c in ["NUMERO INDICE", "MES_VAR", "3 Meses", "6 MESES", "ANO_VAR", "12 MESES"]:
        ordered[c] = pd.to_numeric(ordered[c], errors="coerce").round(2)

    return ordered


def main() -> None:
    dataset_path = sys.argv[1] if len(sys.argv) > 1 else "datasets/ibge_ipca_1737.yml"

    job = load_job(dataset_path)
    text, content_type = fetch_payload(job.url)

    df_raw = parse_payload(text)
    df = clean(df_raw)

    df_out = df
    df_ordered = reshape_like_sidra_but_ordered(df)

    meta = pd.DataFrame(
        {
            "name": [job.name],
            "dataset_path": [dataset_path],
            "url": [job.url],
            "content_type": [content_type],
            "rows_raw": [len(df_out)],
            "rows_ordered": [len(df_ordered)],
        }
    )

    os.makedirs(os.path.dirname(job.output_xlsx), exist_ok=True)
    with pd.ExcelWriter(job.output_xlsx, engine="openpyxl") as writer:
        # Aba “data” no formato que você quer (ordem certa)
        df_ordered.to_excel(writer, index=False, sheet_name="data")

        # Aba “raw” preserva exportação SIDRA (para auditoria)
        df_out.to_excel(writer, index=False, sheet_name="raw")

        # Aba meta
        meta.to_excel(writer, index=False, sheet_name="meta")

    print(f"OK: {job.output_xlsx} (raw={len(df_out)}, data={len(df_ordered)})")


if __name__ == "__main__":
    main()
