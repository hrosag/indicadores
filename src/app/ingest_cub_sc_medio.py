#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import hashlib
import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import openpyxl
import pandas as pd
import pytesseract
import requests
from PIL import Image


# Link direto (export XLSX) — CI-safe
XLSX_URL = (
    "https://docs.google.com/spreadsheets/export"
    "?id=1_XfU1kxOT36xot8o6iRMBOPZ63VYNhvTtXHFMw4Hr2E&exportFormat=xlsx"
)

TARGET_SHEET = "2026"  # teste: apenas aba 2026

OUTPUT_DIR = Path("out")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MONTHS = {
    "JAN": 1, "FEV": 2, "MAR": 3, "ABR": 4, "MAI": 5, "JUN": 6,
    "JUL": 7, "AGO": 8, "SET": 9, "OUT": 10, "NOV": 11, "DEZ": 12,
}


@dataclass
class CubMedioRow:
    competencia: str
    competencia_referencia: str
    cub_medio_r: float
    var_mes_pct: float
    var_ano_pct: float
    var_12m_pct: float
    xlsx_sha256: str
    fonte: str


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def br_to_float(s: str) -> float:
    s = s.strip().replace("%", "")
    s = s.replace(".", "").replace(",", ".")
    return float(s)


def download_xlsx() -> bytes:
    r = requests.get(XLSX_URL, timeout=90)
    r.raise_for_status()

    ct = (r.headers.get("content-type") or "").lower()

    # XLSX é um ZIP e começa com "PK"
    if not (r.content[:2] == b"PK" or "spreadsheetml" in ct):
        raise RuntimeError(
            f"Download não parece ser XLSX (content-type={ct}). "
            "Provável falta de permissão/compartilhamento no Google Sheets."
        )

    return r.content


def extract_first_image_from_sheet(xlsx_bytes: bytes, sheet_name: str) -> bytes:
    wb = openpyxl.load_workbook(BytesIO(xlsx_bytes))
    if sheet_name not in wb.sheetnames:
        raise RuntimeError(f"Aba '{sheet_name}' não encontrada. Abas: {wb.sheetnames}")

    ws = wb[sheet_name]
    imgs = getattr(ws, "_images", [])
    if not imgs:
        raise RuntimeError(f"Nenhuma imagem encontrada na aba '{sheet_name}' (ws._images vazio).")

    return imgs[0]._data()


def ocr_image_bytes(img_bytes: bytes) -> str:
    im = Image.open(BytesIO(img_bytes)).convert("L")  # grayscale
    return pytesseract.image_to_string(im, lang="por")


def parse_row_from_ocr(text: str, sheet_year: int) -> CubMedioRow:
    t = text.upper()

    # Meses (ex: "DEZ" e "JAN")
    months = re.findall(r"\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b", t)
    if len(months) < 2:
        raise RuntimeError(f"Não consegui extrair meses do OCR.\nOCR:\n{text}")

    mes_ref, mes_uso = months[0], months[1]
    use_month_num = MONTHS[mes_uso]
    ref_month_num = MONTHS[mes_ref]

    # Números no padrão BR: 3.012,64 e 0,13%
    nums = re.findall(r"\b\d{1,3}(?:\.\d{3})*,\d{2}%?\b", t.replace(" ", ""))
    if len(nums) < 4:
        raise RuntimeError(f"Não consegui extrair 4 números (CUB + 3%). Achei: {nums}\nOCR:\n{text}")

    cub_medio = br_to_float(nums[0])
    var_mes = br_to_float(nums[1])
    var_ano = br_to_float(nums[2])
    var_12m = br_to_float(nums[3])

    # Regra: JAN usa DEZ do ano anterior; demais meses usam o mesmo ano da aba
    ref_year = sheet_year - 1 if use_month_num == 1 else sheet_year

    competencia = f"{sheet_year:04d}-{use_month_num:02d}"
    competencia_ref = f"{ref_year:04d}-{ref_month_num:02d}"

    return CubMedioRow(
        competencia=competencia,
        competencia_referencia=competencia_ref,
        cub_medio_r=cub_medio,
        var_mes_pct=var_mes,
        var_ano_pct=var_ano,
        var_12m_pct=var_12m,
        xlsx_sha256="",
        fonte="Sinduscon GF – CUB M2 Residencial Médio (XLSX espelho em Google Sheets; OCR da imagem)",
    )


def write_output_xlsx(row: CubMedioRow, year: int) -> Path:
    df = pd.DataFrame([{
        "competencia": row.competencia,
        "competencia_referencia": row.competencia_referencia,
        "cub_medio_r$": row.cub_medio_r,
        "var_mes_%": row.var_mes_pct,
        "var_ano_%": row.var_ano_pct,
        "var_12m_%": row.var_12m_pct,
        "xlsx_sha256": row.xlsx_sha256,
        "fonte": row.fonte,
    }])

    out_path = OUTPUT_DIR / f"cub_sc_residencial_medio_{year}_teste.xlsx"
    with pd.ExcelWriter(out_path, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name=str(year))
    return out_path


def main() -> int:
    year = int(TARGET_SHEET)

    xlsx_bytes = download_xlsx()
    xlsx_hash = sha256_bytes(xlsx_bytes)

    img_bytes = extract_first_image_from_sheet(xlsx_bytes, TARGET_SHEET)
    ocr_text = ocr_image_bytes(img_bytes)

    row = parse_row_from_ocr(ocr_text, sheet_year=year)
    row.xlsx_sha256 = xlsx_hash

    out_path = write_output_xlsx(row, year=year)

    (OUTPUT_DIR / f"debug_ocr_{year}.txt").write_text(ocr_text, encoding="utf-8")

    print("OK")
    print(
        f"competencia={row.competencia} cub_medio={row.cub_medio_r} "
        f"var_mes={row.var_mes_pct} var_ano={row.var_ano_pct} var_12m={row.var_12m_pct}"
    )
    print(f"OUTPUT_XLSX={out_path.as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
