"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPercentBR } from "../lib/format";
import type { PibMetricKey } from "../lib/pib";
import type { PibMetricOption } from "./PibToolbar";

type SortState = {
  key: "data" | PibMetricKey;
  direction: "asc" | "desc";
};

type NumericFilter = {
  min: string;
  max: string;
};

type PibTableProps = {
  rows: Array<{
    data: string;
  } & Record<PibMetricKey, number | null>>;
  loading: boolean;
  resetKey: number;
  metrics: PibMetricOption[];
};

const columnLabelByKey: Record<PibMetricKey | "data", string> = {
  data: "Data",
  var_qoq: "Trim/Trim",
  var_yoy: "Mesmo tri ano ant.",
  var_ytd: "Acum. no ano",
  var_4q: "Acum. 4 trimestres",
};

type FilterPopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

function FilterPopover({ isOpen, onClose, children }: FilterPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!popoverRef.current || popoverRef.current.contains(event.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: 6,
        padding: 12,
        width: 180,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#fff",
        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
        zIndex: 10,
      }}
    >
      {children}
    </div>
  );
}

export default function PibTable({ rows, loading, resetKey, metrics }: PibTableProps) {
  const [sort, setSort] = useState<SortState>({ key: "data", direction: "desc" });
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [filterText, setFilterText] = useState("");
  const [numericFilters, setNumericFilters] = useState<Record<PibMetricKey, NumericFilter>>(
    () =>
      metrics.reduce(
        (acc, metric) => {
          acc[metric.key] = { min: "", max: "" };
          return acc;
        },
        {} as Record<PibMetricKey, NumericFilter>
      )
  );
  const [openFilter, setOpenFilter] = useState<"data" | PibMetricKey | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSort({ key: "data", direction: "desc" });
    setPageSize(25);
    setPage(1);
    setFilterText("");
    setNumericFilters(
      metrics.reduce(
        (acc, metric) => {
          acc[metric.key] = { min: "", max: "" };
          return acc;
        },
        {} as Record<PibMetricKey, NumericFilter>
      )
    );
    setOpenFilter(null);
  }, [metrics, resetKey]);

  const metricKeys = useMemo(() => metrics.map((metric) => metric.key), [metrics]);

  const filteredRows = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    return rows.filter((row) => {
      if (text && !row.data.toLowerCase().includes(text)) return false;
      return metricKeys.every((key) => {
        const { min, max } = numericFilters[key];
        const value = row[key];
        if (min && (value === null || value < Number(min))) return false;
        if (max && (value === null || value > Number(max))) return false;
        return true;
      });
    });
  }, [rows, filterText, numericFilters, metricKeys]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const aValue = a[sort.key];
      const bValue = b[sort.key];
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sort.direction === "asc" ? aValue - bValue : bValue - aValue;
      }
      return sort.direction === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
    return sorted;
  }, [filteredRows, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const rowHeight = 36;
  const viewportHeight = 360;
  const totalHeight = pageRows.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const endIndex = Math.min(pageRows.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 4);
  const visibleRows = pageRows.slice(startIndex, endIndex);

  const handleSort = (key: "data" | PibMetricKey) => {
    setSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const handlePageSize = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(event.target.value));
    setPage(1);
  };

  const handleApplyTextFilter = (value: string) => {
    setFilterText(value);
    setPage(1);
  };

  const handleApplyNumericFilter = (key: PibMetricKey, min: string, max: string) => {
    setNumericFilters((current) => ({
      ...current,
      [key]: { min, max },
    }));
    setPage(1);
  };

  const gridTemplateColumns = useMemo(
    () => `minmax(110px, 1.2fr) repeat(${metricKeys.length}, minmax(140px, 1fr))`,
    [metricKeys.length]
  );
  const gridMinWidth = 110 + metricKeys.length * 150;

  return (
    <section
      style={{
        marginTop: 24,
        padding: 20,
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Tabela</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12 }}>Registros por página</label>
          <select value={pageSize} onChange={handlePageSize} style={{ padding: "4px 6px" }}>
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto", width: "100%" }}>
        <div style={{ minWidth: gridMinWidth, width: "100%" }}>
          <div
            ref={containerRef}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            style={{
              maxHeight: viewportHeight,
              overflowY: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns,
                gap: 0,
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#f3f4f6",
                borderBottom: "1px solid #e5e7eb",
                padding: "8px 0",
                width: "100%",
              }}
            >
              <div
                style={{
                  padding: "0 8px",
                  position: "relative",
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button type="button" onClick={() => handleSort("data")} style={{ fontWeight: 600 }}>
                    {columnLabelByKey.data}{" "}
                    {sort.key === "data" ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                  </button>
                  <button
                    type="button"
                    aria-label="Filtrar data"
                    onClick={() => setOpenFilter((current) => (current === "data" ? null : "data"))}
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      padding: "0 6px",
                      fontSize: 12,
                      background: "#fff",
                    }}
                  >
                    ⏷
                  </button>
                </div>
                <FilterPopover isOpen={openFilter === "data"} onClose={() => setOpenFilter(null)}>
                  <DataFilterForm
                    value={filterText}
                    onApply={(value) => {
                      handleApplyTextFilter(value);
                      setOpenFilter(null);
                    }}
                    onClear={() => {
                      handleApplyTextFilter("");
                      setOpenFilter(null);
                    }}
                  />
                </FilterPopover>
              </div>
              {metricKeys.map((key, index) => (
                <div
                  key={key}
                  style={{
                    padding: "0 8px",
                    position: "relative",
                    textAlign: "right",
                    borderRight: index < metricKeys.length - 1 ? "1px solid #e5e7eb" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                    <button type="button" onClick={() => handleSort(key)} style={{ fontWeight: 600 }}>
                      {metrics.find((metric) => metric.key === key)?.label ?? columnLabelByKey[key]}{" "}
                      {sort.key === key ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                    </button>
                    <button
                      type="button"
                      aria-label={`Filtrar ${
                        metrics.find((metric) => metric.key === key)?.label ?? columnLabelByKey[key]
                      }`}
                      onClick={() => setOpenFilter((current) => (current === key ? null : key))}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        padding: "0 6px",
                        fontSize: 12,
                        background: "#fff",
                      }}
                    >
                      ⏷
                    </button>
                  </div>
                  <FilterPopover isOpen={openFilter === key} onClose={() => setOpenFilter(null)}>
                    <NumericFilterForm
                      filter={numericFilters[key]}
                      onApply={(min, max) => {
                        handleApplyNumericFilter(key, min, max);
                        setOpenFilter(null);
                      }}
                      onClear={() => {
                        handleApplyNumericFilter(key, "", "");
                        setOpenFilter(null);
                      }}
                    />
                  </FilterPopover>
                </div>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: 16 }}>Carregando tabela...</div>
            ) : pageRows.length === 0 ? (
              <div style={{ padding: 16 }}>Nenhum registro.</div>
            ) : (
              <div style={{ height: totalHeight, position: "relative", width: "100%" }}>
                <div
                  style={{
                    position: "absolute",
                    top: startIndex * rowHeight,
                    left: 0,
                    width: "100%",
                  }}
                >
                  {visibleRows.map((row) => (
                    <div
                      key={row.data}
                      style={{
                        display: "grid",
                        gridTemplateColumns,
                        borderBottom: "1px solid #f3f4f6",
                        alignItems: "center",
                        height: rowHeight,
                        width: "100%",
                      }}
                    >
                      <div
                        style={{ padding: "0 8px", textAlign: "left", borderRight: "1px solid #f3f4f6" }}
                      >
                        {row.data}
                      </div>
                      {metricKeys.map((key, index) => (
                        <div
                          key={key}
                          style={{
                            padding: "0 8px",
                            textAlign: "right",
                            borderRight: index < metricKeys.length - 1 ? "1px solid #f3f4f6" : "none",
                          }}
                        >
                          {formatPercentBR(row[key])}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
        }}
      >
        <span>
          Página {currentPage} de {totalPages} ({sortedRows.length} registros)
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
}

type NumericFilterFormProps = {
  filter: NumericFilter;
  onApply: (min: string, max: string) => void;
  onClear: () => void;
};

function NumericFilterForm({ filter, onApply, onClear }: NumericFilterFormProps) {
  const [min, setMin] = useState(filter.min);
  const [max, setMax] = useState(filter.max);

  useEffect(() => {
    setMin(filter.min);
    setMax(filter.max);
  }, [filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={min}
          onChange={(event) => setMin(event.target.value)}
          placeholder="min"
          style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: "1px solid #d1d5db" }}
        />
        <input
          value={max}
          onChange={(event) => setMax(event.target.value)}
          placeholder="max"
          style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: "1px solid #d1d5db" }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={() => onApply(min, max)}>
          Aplicar
        </button>
        <button type="button" onClick={onClear}>
          Limpar
        </button>
      </div>
    </div>
  );
}

type DataFilterFormProps = {
  value: string;
  onApply: (value: string) => void;
  onClear: () => void;
};

function DataFilterForm({ value, onApply, onClear }: DataFilterFormProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 600 }}>Contém</label>
      <input
        value={draft}
        placeholder="YYYY-MM"
        onChange={(event) => setDraft(event.target.value)}
        style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={() => onApply(draft)}>
          Aplicar
        </button>
        <button type="button" onClick={onClear}>
          Limpar
        </button>
      </div>
    </div>
  );
}
