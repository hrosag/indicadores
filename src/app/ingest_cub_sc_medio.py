#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import sys
import hashlib
from io import BytesIO
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import requests
import openpyxl
import pandas as pd
import pytesseract
from PIL import Image


# =========================
# Config (teste controlado)
# =========================
TARGET_SHEET = os.getenv("CUB_TARGET_SHEET", "2026")  # apenas 2026 para teste
DOWNLOAD_URL = os.getenv("CUB_XLSX_URL", "").strip()  # defina via env/secret
OUTPUT_DIR = Path(os.getenv("CUB_OUTPUT_DIR", "out"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


MONTHS = {
    "JAN": 1, "FEV": 2, "MAR": 3, "ABR": 4, "MAI": 5, "JUN": 6,
    "JUL": 7, "AGO": 8, "SET": 9, "OUT": 10, "NOV": 11, "DEZ": 12,
}


@dataclass
class CubMedioRow:
    ano: int
    mes_uso: str
    competencia: str
    mes_referencia: str
    competencia_referencia: str
    cub_medio: float
    var_mes: float
    var_ano: float
    var_12m: float
    xlsx_sha256: str
    fonte: str


def _br_to_float(s: str) -> float:
    s = s.strip().replace("%", "")
    s = s.replace(".", "").replace(",", ".")
    return float(s)


def _sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def download_xlsx(url: str) -> bytes:
    if not url or "http" not in url:
        raise SystemExit(
            "CUB_XLSX_URL não definido. Defina via env/secret (link direto do download do XLSX)."
        )

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; indicadores-bot/1.0)"
    }
    r = requests.get(url, headers=headers, timeout=120)
    r.raise_for_status()
    return r.content


def extract_first_image_from_sheet(xlsx_bytes: bytes, sheet_name: str) -> bytes:
    wb = openpyxl.load_workbook(BytesIO(xlsx_bytes))

    if sheet_name not in wb.sheetnames:
        raise RuntimeError(f"Aba '{sheet_name}' não encontrada. Abas: {wb.sheetnames}")

    ws = wb[sheet_name]
    imgs = getattr(ws, "_images", [])
    if not imgs:
        raise RuntimeError(f"Nenhuma imagem encontrada na aba '{sheet_name}'.")

    # Em geral é uma imagem por aba
    img = imgs[0]
    return img._data()


def ocr_image_bytes(img_bytes: bytes) -> str:
    im = Image.open(BytesIO(img_bytes))

    # Pequeno boost de legibilidade sem inventar muito
    im = im.convert("L")  # grayscale

    # OCR em português (se não existir, tesseract cai para eng; ainda costuma funcionar)
    return pytesseract.image_to_string(im, lang="por")


def _find_month_tokens(text: str) -> list[str]:
    # captura tokens de mês como palavras isoladas
    tokens = re.findall(r"\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b", text.upper())
    return tokens


def _find_numbers(text: str) -> list[str]:
    # captura:
    # - CUB: 3.012,64
    # - percentuais: 0,13% / 4,32%
    # Mantém ordem de aparição
    pat = re.compile(r"\b\d{1,3}(?:\.\d{3})*,\d{2}%?\b")
    return pat.findall(text.replace(" ", ""))


def parse_cub_medio_from_ocr(text: str, sheet_year: int) -> CubMedioRow:
    t = text.upper()

    months = _find_month_tokens(t)
    if len(months) < 2:
        raise RuntimeError(f"Não consegui extrair meses (DEZ/JAN etc.). OCR:\n{text}")

    mes_referencia = months[0]
    mes_uso = months[1]

    nums = _find_numbers(t)
    # Esperado: [CUB, %mes, %ano, %12m]
    if len(nums) < 4:
        raise RuntimeError(f"Não consegui extrair 4 números (CUB + 3 %). Encontrei {nums}. OCR:\n{text}")

    cub_medio = _br_to_float(nums[0])
    var_mes = _br_to_float(nums[1])
    var_ano = _br_to_float(nums[2])
    var_12m = _br_to_float(nums[3])

    use_month_num = MONTHS[mes_uso]
    ref_month_num = MONTHS[mes_referencia]

    # Regra típica desse quadro:
    # aba 2026: "Dados do mês de DEZ" -> referência 2025-12
    # "Para ser usado em JAN" -> competência 2026-01
    ref_year = sheet_year - 1 if use_month_num == 1 else sheet_year
    competencia = f"{sheet_year:04d}-{use_month_num:02d}"
    competencia_referencia = f"{ref_year:04d}-{ref_month_num:02d}"

    return CubMedioRow(
        ano=sheet_year,
        mes_uso=mes_uso,
        competencia=competencia,
        mes_referencia=mes_referencia,
        competencia_referencia=competencia_referencia,
        cub_medio=cub_medio,
        var_mes=var_mes,
        var_ano=var_ano,
        var_12m=var_12m,
        xlsx_sha256="",
        fonte="Sinduscon GF - CUB M2 Residencial Médio (planilha com imagem + OCR)",
    )


def write_output_xlsx(row: CubMedioRow) -> Path:
    df = pd.DataFrame([{
        "competencia": row.competencia,
        "competencia_referencia": row.competencia_referencia,
        "cub_medio_r$": row.cub_medio,
        "var_mes_%": row.var_mes,
        "var_ano_%": row.var_ano,
        "var_12m_%": row.var_12m,
        "xlsx_sha256": row.xlsx_sha256,
        "fonte": row.fonte,
    }])

    out_path = OUTPUT_DIR / f"cub_sc_residencial_medio_{row.ano}_teste.xlsx"
    with pd.ExcelWriter(out_path, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name=str(row.ano))
    return out_path


def main() -> int:
    sheet = TARGET_SHEET.strip()
    if not sheet.isdigit():
        print(f"CUB_TARGET_SHEET inválido: {sheet}. Use algo como '2026'.", file=sys.stderr)
        return 2

    year = int(sheet)

    xlsx_bytes = download_xlsx(DOWNLOAD_URL)
    xlsx_hash = _sha256_bytes(xlsx_bytes)

    img_bytes = extract_first_image_from_sheet(xlsx_bytes, sheet_name=sheet)
    ocr_text = ocr_image_bytes(img_bytes)

    row = parse_cub_medio_from_ocr(ocr_text, sheet_year=year)
    row.xlsx_sha256 = xlsx_hash

    out_path = write_output_xlsx(row)

    # log “operacional”
    print("OK: extraído CUB médio")
    print(f"competencia={row.competencia} cub_medio={row.cub_medio} var_mes={row.var_mes} var_ano={row.var_ano} var_12m={row.var_12m}")
    print(f"OUTPUT_XLSX={out_path.as_posix()}")

    # opcional: salvar OCR para debug em pipeline
    debug_path = OUTPUT_DIR / f"debug_ocr_{year}.txt"
    debug_path.write_text(ocr_text, encoding="utf-8")
    print(f"DEBUG_OCR={debug_path.as_posix()}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
