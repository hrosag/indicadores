# src/app/fetch_cub_residencial_medio.py
# Objetivo:
# 1) abrir https://sinduscon-fpolis.org.br/servico/cub-mensal/
# 2) navegar pelos 3 cliques
# 3) capturar automaticamente (via interceptação de rede) a URL final do recurso do Drive:
#    - preferencialmente uma imagem lh3.googleusercontent.com/... (para OCR)
#    - ou um link exportável do Google Sheets, se aparecer
# 4) baixar imagem, OCR, gerar XLSX
# 5) salvar evidências em output/ (logs + screenshots)

from __future__ import annotations

import os
import re
import json
from pathlib import Path
from typing import Optional, List, Dict

import requests
from PIL import Image
import pytesseract
from openpyxl import Workbook
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError


URL = "https://sinduscon-fpolis.org.br/servico/cub-mensal/"

OUT_DIR = Path("output")
OUT_DIR.mkdir(parents=True, exist_ok=True)

IMG_PATH = OUT_DIR / "sheet.png"
OCR_TXT_PATH = OUT_DIR / "ocr.txt"
XLSX_PATH = OUT_DIR / "cub_residencial_medio.xlsx"

DEBUG_REQ_LOG = OUT_DIR / "admin_ajax_requests.log"
DEBUG_RES_LOG = OUT_DIR / "admin_ajax_responses.log"
DEBUG_SCREEN_1 = OUT_DIR / "debug_step1.png"
DEBUG_SCREEN_2 = OUT_DIR / "debug_step2.png"
DEBUG_SCREEN_3 = OUT_DIR / "debug_step3.png"
DEBUG_FINAL = OUT_DIR / "debug_final.png"


COOKIE_SELECTORS = [
    "button#onetrust-accept-btn-handler",
    "button:has-text('Aceitar')",
    "button:has-text('ACEITAR')",
    "button:has-text('Accept')",
    "button:has-text('Concordo')",
    "button:has-text('Entendi')",
]


def _append(path: Path, s: str) -> None:
    path.write_text((path.read_text(encoding="utf-8") if path.exists() else "") + s, encoding="utf-8")


def maybe_accept_cookies(page) -> None:
    for sel in COOKIE_SELECTORS:
        try:
            btn = page.locator(sel).first
            if btn.is_visible():
                btn.click(timeout=2_000)
                page.wait_for_timeout(400)
                return
        except Exception:
            continue


def safe_click_text(page, text: str, timeout: int = 90_000) -> None:
    page.wait_for_load_state("domcontentloaded")
    try:
        page.wait_for_load_state("networkidle", timeout=15_000)
    except Exception:
        pass

    maybe_accept_cookies(page)

    loc = page.get_by_text(text, exact=False).first
    loc.wait_for(timeout=timeout)
    try:
        loc.scroll_into_view_if_needed(timeout=timeout)
    except Exception:
        pass

    try:
        loc.click(timeout=timeout)
    except PWTimeoutError:
        # overlay/viewport
        loc.click(timeout=timeout, force=True)


def extract_best_image_url_from_text(blob: str) -> Optional[str]:
    """
    Procura uma URL de imagem estável para OCR.
    Preferência: lh3.googleusercontent.com/drive-storage/... (png/jpg/webp ou com parâmetros w=...)
    """
    if not blob:
        return None

    # 1) lh3 googleusercontent (muito comum no viewer)
    m = re.search(r"(https://lh3\.googleusercontent\.com/drive-storage/[^\s\"'<>]+)", blob)
    if m:
        return m.group(1)

    # 2) drive-storage em outros hosts googleusercontent
    m = re.search(r"(https://[a-z0-9\-]+\.googleusercontent\.com/drive-storage/[^\s\"'<>]+)", blob)
    if m:
        return m.group(1)

    # 3) qualquer png/jpg/webp googleusercontent (último recurso)
    m = re.search(r"(https://[^\s\"'<>]*googleusercontent\.com[^\s\"'<>]*\.(png|jpg|jpeg|webp)[^\s\"'<>]*)", blob, re.I)
    if m:
        return m.group(1)

    return None


def download_binary(url: str, out: Path, timeout: int = 60) -> None:
    r = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    out.write_bytes(r.content)


def preprocess_for_ocr(img: Image.Image) -> Image.Image:
    # escala de cinza + threshold leve para tabelas
    gray = img.convert("L")
    bw = gray.point(lambda x: 0 if x < 180 else 255, "1")
    return bw


def parse_ocr(text: str) -> Dict[str, Optional[str]]:
    """
    Parser simples para os campos principais exibidos no “CUB RESIDENCIAL MÉDIO”.
    Ajuste conforme o OCR real.
    """
    t = (text or "").upper()

    def grab(pattern: str) -> Optional[str]:
        mm = re.search(pattern, t, re.DOTALL)
        return mm.group(1).strip() if mm else None

    ano = grab(r"\b(20\d{2})\b")
    dados_mes = grab(r"DADOS DO M[EÊ]S DE[:\s]*([A-Z]{3})")
    usado_em = grab(r"PARA SER USADO EM[:\s]*([A-Z]{3})")

    cub_medio = grab(r"CUB\s*M[ÉE]DIO.*?(\d{1,3}(?:\.\d{3})*,\d{2})")
    pct_mes = grab(r"%\s*M[ÊE]S.*?(\d{1,3},\d{2}\s*%)")
    pct_ano = grab(r"%\s*ANO.*?(\d{1,3},\d{2}\s*%)")
    pct_12m = grab(r"%\s*12\s*MESES.*?(\d{1,3},\d{2}\s*%)")

    return {
        "ano": ano,
        "dados_mes": dados_mes,
        "usado_em": usado_em,
        "cub_medio": cub_medio,
        "pct_mes": pct_mes,
        "pct_ano": pct_ano,
        "pct_12m": pct_12m,
    }


def write_xlsx(parsed: Dict[str, Optional[str]], ocr_raw: str) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "cub_residencial_medio"

    ws.append(["campo", "valor"])
    for k in ["ano", "dados_mes", "usado_em", "cub_medio", "pct_mes", "pct_ano", "pct_12m"]:
        ws.append([k, parsed.get(k)])

    ws2 = wb.create_sheet("ocr_raw")
    for line in (ocr_raw or "").splitlines():
        ws2.append([line])

    wb.save(XLSX_PATH)


def main() -> None:
    # Reset logs
    for p in [DEBUG_REQ_LOG, DEBUG_RES_LOG]:
        if p.exists():
            p.unlink()

    captured_image_urls: List[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1400, "height": 900},
            locale="pt-BR",
        )
        page = ctx.new_page()

        # Intercepta requests/responses do admin-ajax e tenta extrair URLs úteis
        def on_request(req):
            if "wp-admin/admin-ajax.php" in req.url and req.method == "POST":
                post = req.post_data or ""
                _append(DEBUG_REQ_LOG, f"URL: {req.url}\nMETHOD: {req.method}\nPOST_DATA: {post}\n\n")

        def on_response(res):
            url = res.url
            try:
                # Alguns retornos são json, outros html/texto
                txt = res.text()
            except Exception:
                return

            if "wp-admin/admin-ajax.php" in url:
                _append(DEBUG_RES_LOG, f"URL: {url}\nSTATUS: {res.status}\nBODY_HEAD:\n{txt[:4000]}\n\n")

            # Procura URLs de imagem/drive em qualquer resposta relevante
            img_url = extract_best_image_url_from_text(txt)
            if img_url and img_url not in captured_image_urls:
                captured_image_urls.append(img_url)

        page.on("request", on_request)
        page.on("response", on_response)

        page.goto(URL, wait_until="domcontentloaded", timeout=60_000)
        maybe_accept_cookies(page)

        # Passo 1
        try:
            safe_click_text(page, "1 - CUB NORMA 2006", timeout=120_000)
        except Exception:
            page.screenshot(path=str(DEBUG_SCREEN_1), full_page=True)
            raise
        page.wait_for_timeout(1_000)

        # Passo 2
        try:
            safe_click_text(page, "1 - CUB RESIDENCIAL", timeout=120_000)
        except Exception:
            page.screenshot(path=str(DEBUG_SCREEN_2), full_page=True)
            raise
        page.wait_for_timeout(1_000)

        # Passo 3
        try:
            safe_click_text(page, "CUB M2 RESIDENCIAL", timeout=120_000)
        except Exception:
            page.screenshot(path=str(DEBUG_SCREEN_3), full_page=True)
            raise

        # Dá tempo do viewer carregar + interceptar responses com URLs
        page.wait_for_timeout(6_000)
        page.screenshot(path=str(DEBUG_FINAL), full_page=True)

        browser.close()

    # Seleciona a melhor URL capturada
    img_url = None
    # Preferir lh3 drive-storage
    for u in captured_image_urls:
        if "lh3.googleusercontent.com/drive-storage/" in u:
            img_url = u
            break
    if not img_url and captured_image_urls:
        img_url = captured_image_urls[0]

    if not img_url:
        raise RuntimeError(
            "Não consegui capturar URL de imagem do viewer. "
            "Veja output/admin_ajax_responses.log e output/debug_final.png para ajustar seletores."
        )

    # Baixa a imagem e faz OCR
    download_binary(img_url, IMG_PATH)

    img = Image.open(IMG_PATH)
    pre = preprocess_for_ocr(img)

    # Requer: tesseract-ocr-por instalado no runner
    ocr_text = pytesseract.image_to_string(pre, lang="por")
    OCR_TXT_PATH.write_text(ocr_text, encoding="utf-8")

    parsed = parse_ocr(ocr_text)
    write_xlsx(parsed, ocr_text)

    print("OK")
    print(f"image_url={img_url}")
    print(f"image={IMG_PATH}")
    print(f"ocr={OCR_TXT_PATH}")
    print(f"xlsx={XLSX_PATH}")


if __name__ == "__main__":
    main()
