"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IpcaRow, MetricKey } from "../lib/ipca";

const formatValue = (value: number | null) => (value === null ? "" : value.toFixed(2));

type SortState = {
  key: keyof IpcaRow;
  direction: "asc" | "desc";
};

type NumericFilter = {
  min: string;
  max: string;
};

type IpcaTableProps = {
  rows: IpcaRow[];
  loading: boolean;
  resetKey: number;
};

const metricKeys: MetricKey[] = ["var_m", "var_3_m", "var_6_m", "var_ano", "var_12_m"];

export default function IpcaTable({ rows, loading, resetKey }: IpcaTableProps) {
  const [sort, setSort] = useState<SortState>({ key: "data", direction: "desc" });
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [filterText, setFilterText] = useState("");
  const [numericFilters, setNumericFilters] = useState<Record<MetricKey, NumericFilter>>({
    var_m: { min: "", max: "" },
    var_3_m: { min: "", max: "" },
    var_6_m: { min: "", max: "" },
    var_ano: { min: "", max: "" },
    var_12_m: { min: "", max: "" },
  });
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSort({ key: "data", direction: "desc" });
    setPageSize(25);
    setPage(1);
    setFilterText("");
    setNumericFilters({
      var_m: { min: "", max: "" },
      var_3_m: { min: "", max: "" },
      var_6_m: { min: "", max: "" },
      var_ano: { min: "", max: "" },
      var_12_m: { min: "", max: "" },
    });
  }, [resetKey]);

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
  }, [rows, filterText, numericFilters]);

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

  const handleSort = (key: keyof IpcaRow) => {
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

      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: 12 }}>Filtro data</label>
        <input
          value={filterText}
          onChange={(event) => {
            setFilterText(event.target.value);
            setPage(1);
          }}
          placeholder="YYYY-MM"
          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
        />
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ padding: 8, textAlign: "left" }}>
                <button type="button" onClick={() => handleSort("data")}>
                  data {sort.key === "data" ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                </button>
              </th>
              {metricKeys.map((key) => (
                <th key={key} style={{ padding: 8, textAlign: "right" }}>
                  <button type="button" onClick={() => handleSort(key)}>
                    {key} {sort.key === key ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ padding: 8 }} />
              {metricKeys.map((key) => (
                <th key={key} style={{ padding: 8 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      value={numericFilters[key].min}
                      onChange={(event) => {
                        setNumericFilters((current) => ({
                          ...current,
                          [key]: { ...current[key], min: event.target.value },
                        }));
                        setPage(1);
                      }}
                      placeholder="min"
                      style={{ width: 60, padding: "4px 6px" }}
                    />
                    <input
                      value={numericFilters[key].max}
                      onChange={(event) => {
                        setNumericFilters((current) => ({
                          ...current,
                          [key]: { ...current[key], max: event.target.value },
                        }));
                        setPage(1);
                      }}
                      placeholder="max"
                      style={{ width: 60, padding: "4px 6px" }}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div
          ref={containerRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          style={{
            maxHeight: viewportHeight,
            overflowY: "auto",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          {loading ? (
            <div style={{ padding: 16 }}>Carregando tabela...</div>
          ) : pageRows.length === 0 ? (
            <div style={{ padding: 16 }}>Nenhum registro.</div>
          ) : (
            <div style={{ height: totalHeight, position: "relative" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody
                  style={{
                    position: "absolute",
                    top: startIndex * rowHeight,
                    left: 0,
                    right: 0,
                  }}
                >
                  {visibleRows.map((row) => (
                    <tr key={row.data} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 8px", height: rowHeight }}>{row.data}</td>
                      {metricKeys.map((key) => (
                        <td
                          key={key}
                          style={{ padding: "8px 8px", textAlign: "right", height: rowHeight }}
                        >
                          {formatValue(row[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
