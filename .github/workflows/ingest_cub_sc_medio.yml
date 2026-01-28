name: Ingest CUB SC Médio (manual)

on:
  workflow_dispatch:

jobs:
  run:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install system deps (tesseract)
        run: |
          sudo apt-get update
          sudo apt-get install -y tesseract-ocr
          tesseract --version

      - name: Install Python deps + Playwright Chromium
        run: |
          pip install -r requirements.txt
          python -m playwright install --with-deps chromium

      - name: Run ingest (2026 only)
        run: |
          python src/app/ingest_cub_sc_medio.py
          ls -la out

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: cub_sc_medio_test_output
          path: out/*
