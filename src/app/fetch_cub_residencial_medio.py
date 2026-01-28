import os
import re
import time
from pathlib import Path

import requests
from openpyxl import Workbook
from PIL import Image
import pytesseract
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError


URL = "https://sinduscon-fpolis.org.br/servico/cub-mensal/"

OUT_DIR = Path("output")
OUT_DIR.mkdir(parents=True, exist_ok=True)

IMG_PATH = OUT_DIR / "sheet.png"
SHOT_PATH = OUT_DIR / "sheet_fallback.png"
XLSX_PATH = OUT_DIR / "cub_residencial_medio.xlsx"
OCR_TXT_PATH = OUT_DIR / "ocr.txt"


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _parse_ocr(text: str) -> dict:
    """
    Extrai do OCR algo como:
      ano: 2026
      dados_mes: DEZ
      usado_em: JAN
      cub_medio: 3.012,64
      pct_mes: 0,13%
      pct_ano: 4,32%
      pct_12m: 4,32%
    """
    t = text.upper()

    def m(pattern: str):
        mm = re.search(pattern, t, re.DOTALL)
        return _clean(mm.group(1)) if mm else None

    ano = m(r"\b(20\d{2})\b")
    dados_mes = m(r"DADOS DO M[EÊ]S DE[:\s]*([A-Z]{3})")
    usado_em = m(r"PARA SER USADO EM[:\s]*([A-Z]{3})")

    # Números BR: 3.012,64
    cub_medio = m(r"CUB\s*M[ÉE]DIO.*?(\d{1,3}(\.\d{3})*,\d{2})")
    pct_mes = m(r"%\s*M[ÊE]S.*?(\d{1,3},\d{2}\s*%)")
    pct_ano = m(r"%\s*ANO.*?(\d{1,3},\d{2}\s*%)")
    pct_12m = m(r"%\s*12\s*MESES.*?(\d{1,3},\d{2}\s*%)")

    return {
        "ano": ano,
        "dados_mes": dados_mes,
        "usado_em": usado_em,
        "cub_medio": cub_medio,
        "pct_mes": pct_mes,
        "pct_ano": pct_ano,
        "pct_12m": pct_12m,
    }


def _write_xlsx(parsed: dict, ocr_raw: str):
    wb = Workbook()
    ws = wb.active
    ws.title = "cub_residencial_medio"

    ws.append(["campo", "valor"])
    for k in ["ano", "dados_mes", "usado_em", "cub_medio", "pct_mes", "pct_ano", "pct_12m"]:
        ws.append([k, parsed.get(k)])

    ws2 = wb.create_sheet("ocr_raw")
    for line in ocr_raw.splitlines():
        ws2.append([line])

    wb.save(XLSX_PATH)


def main():
    # Tesseract path (no Actions vai estar no PATH após apt-get)
    # Se quiser fixar: pytesseract.pytesseract.tesseract_cmd = "/usr/bin/tesseract"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1400, "height": 900},
            locale="pt-BR",
        )
        page = ctx.new_page()

        page.goto(URL, wait_until="domcontentloaded", timeout=60_000)

        # 1) clique: "1 - CUB NORMA 2006"
        page.get_by_text("1 - CUB NORMA 2006", exact=False).first.click(timeout=30_000)

        # 2) clique: "1 - CUB RESIDENCIAL MÉDIO"
        page.get_by_text("1 - CUB RESIDENCIAL", exact=False).first.click(timeout=30_000)

        # 3) clique: "CUB M2 RESIDENCIAL MÉDIO - ANUAL" (o card do arquivo)
        page.get_by_text("CUB M2 RESIDENCIAL", exact=False).first.click(timeout=30_000)

        # Agora abre um “viewer” (geralmente overlay/iframe).
        # Estratégia A: achar um <img> grande e baixar o src.
        img_src = None

        # Dá um tempo pro overlay/render carregar
        page.wait_for_timeout(2_000)

        # Tenta achar imagem mais “óbvia”
        try:
            # pega qualquer img visível com tamanho razoável
            imgs = page.locator("img").all()
            best = None
            best_area = 0
            for loc in imgs:
                try:
                    box = loc.bounding_box()
                    if not box:
                        continue
                    area = box["width"] * box["height"]
                    if area > best_area and box["width"] > 600 and box["height"] > 300:
                        best_area = area
                        best = loc
                except Exception:
                    continue

            if best:
                src = best.get_attribute("src")
                if src and ("http" in src or src.startswith("//")):
                    img_src = src if src.startswith("http") else ("https:" + src)

        except Exception:
            img_src = None

        if img_src:
            r = requests.get(img_src, timeout=60)
            r.raise_for_status()
            IMG_PATH.write_bytes(r.content)
        else:
            # Estratégia B (fallback): screenshot do page e usa isso como base do OCR
            page.screenshot(path=str(SHOT_PATH), full_page=True)
            IMG_PATH.write_bytes(SHOT_PATH.read_bytes())

        browser.close()

    # OCR
    img = Image.open(IMG_PATH)

    # Dica: melhorar OCR em tabelas (simples):
    # - converter pra escala de cinza e aumentar contraste
    gray = img.convert("L")
    # um threshold leve
    bw = gray.point(lambda x: 0 if x < 180 else 255, "1")

    # OCR (português)
    # No Actions vamos instalar tesseract-ocr-por
    text = pytesseract.image_to_string(bw, lang="por")
    OCR_TXT_PATH.write_text(text, encoding="utf-8")

    parsed = _parse_ocr(text)
    _write_xlsx(parsed, text)

    print("OK")
    print(f"- image: {IMG_PATH}")
    print(f"- ocr: {OCR_TXT_PATH}")
    print(f"- xlsx: {XLSX_PATH}")


if __name__ == "__main__":
    main()
