#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
from io import BytesIO
from dataclasses import dataclass

import pandas as pd
import requests
import openpyxl
import pytesseract
from PIL import Image


# --------- ajuste aqui ----------
DOWNLOAD_URL = "COLE_AQUI_O_LINK_DIRETO_DE_DOWNLOAD_DO_XLSX"
TARGET_SHEET = "2026"
OUTPUT_XLSX = "cub_sc_residencial_medio_2026_teste.xlsx"
# --------------------------------


MONTHS = {
    "JAN": 1, "FEV": 2, "MAR": 3, "ABR": 4, "MAI": 5, "JUN": 6,
    "JUL": 7, "AGO": 8, "SET": 9, "OUT": 10, "NOV": 11, "DEZ": 12,
}


def br_to_float(s: str) -> float:
    s = s.replace("%", "").strip()
    s = s.replace(".", "").replace(",", ".")
    return float(s)


@dataclass
class CubRow:
    ano: int
    mes_uso: str
    competencia: str
    mes_referencia: str
    competencia_referencia: str
    cub_medio: float
    var_mes: float
    var_ano: float
    var_12m: float


def download_xlsx(url: str) -> bytes:
    r = requests.get(url, timeout=120)
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

    # normalmente é 1 imagem colada por aba
    img = imgs[0]
    return img._data()


def ocr_image_bytes(img_bytes: bytes) -> str:
    im = Image.open(BytesIO(img_bytes))
    # OCR em PT (tesseract instalado no SO costuma aceitar 'por')
    return pytesseract.image_to_string(im, lang="por")


def parse_cub_ocr(text: str, target_year: int) -> CubRow:
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # 1) meses (ex.: "DEZ", "JAN")
    months_found = [l for l in lines if l in MONTHS]
    if len(months_found) < 2:
        raise RuntimeError(f"Não consegui achar 2 meses (DEZ/JAN etc.) no OCR. Texto:\n{text}")

    mes_ref = months_found[0]
    mes_uso = months_found[1]

    # 2) números (ex.: "3.012,64", "0,13%", "4,32%", "4,32%")
    nums = [l for l in lines if re.search(r"\d", l) and ("," in l or "." in l)]
    # tenta manter só os 4 primeiros “característicos”
    nums = nums[:4]
    if len(nums) < 4:
        raise RuntimeError(f"Não consegui achar 4 números no OCR. Achei: {nums}. Texto:\n{text}")

    cub_medio = br_to_float(nums[0])
    var_mes = br_to_float(nums[1])
    var_ano = br_to_float(nums[2])
    var_12m = br_to_float(nums[3])

    # Regras de competência (padrão dessas planilhas):
    # "Dados do mês de DEZ" -> mês de referência (ano anterior)
    # "Para ser usado em JAN" -> competência do ano da aba (target_year)
    ref_month_num = MONTHS[mes_ref]
    use_month_num = MONTHS[mes_uso]

    # referência costuma ser mês anterior ao "uso"
    # exemplo: aba 2026, uso=JAN => ref=DEZ do ano anterior
    ref_year = target_year if use_month_num != 1 else target_year - 1
    if use_month_num == 1:
        ref_year = target_year - 1

    competencia = f"{target_year}-{use_month_num:02d}"
    competencia_ref = f"{ref_year}-{ref_month_num:02d}"

    return CubRow(
        ano=target_year,
        mes_uso=mes_uso,
        competencia=competencia,
        mes_referencia=mes_ref,
        competencia_referencia=competencia_ref,
        cub_medio=cub_medio,
        var_mes=var_mes,
        var_ano=var_ano,
        var_12m=var_12m,
    )


def main():
    if "COLE_AQUI" in DOWNLOAD_URL:
        raise SystemExit("Edite o script e preencha DOWNLOAD_URL com o link direto do XLSX.")

    xlsx_bytes = download_xlsx(DOWNLOAD_URL)
    img_bytes = extract_first_image_from_sheet(xlsx_bytes, TARGET_SHEET)
    text = ocr_image_bytes(img_bytes)

    row = parse_cub_ocr(text, target_year=int(TARGET_SHEET))

    df = pd.DataFrame([{
        "competencia": row.competencia,
        "competencia_referencia": row.competencia_referencia,
        "cub_medio_r$": row.cub_medio,
        "var_mes_%": row.var_mes,
        "var_ano_%": row.var_ano,
        "var_12m_%": row.var_12m,
        "fonte": "Sinduscon GF - pseudo-planilha (imagem + OCR)",
    }])

    with pd.ExcelWriter(OUTPUT_XLSX, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name=TARGET_SHEET)

    print(f"OK: gerado {OUTPUT_XLSX}")
    print(df.to_string(index=False))


if __name__ == "__main__":
    main()
