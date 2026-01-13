"use client";

import { MetricKey } from "../lib/ipca";

export type MetricOption = {
  key: MetricKey;
  label: string;
};

type IpcaToolbarProps = {
  start: string;
  end: string;
  auto: boolean;
  metric: MetricKey;
  metrics: MetricOption[];
  loading: boolean;
  isAdmin: boolean;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onAutoChange: (value: boolean) => void;
  onMetricChange: (value: MetricKey) => void;
  onLoad: () => void;
  onReset: () => void;
  onExport: () => void;
};

export default function IpcaToolbar({
  start,
  end,
  auto,
  metric,
  metrics,
  loading,
  isAdmin,
  onStartChange,
  onEndChange,
  onAutoChange,
  onMetricChange,
  onLoad,
  onReset,
  onExport,
}: IpcaToolbarProps) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        borderRadius: 12,
        background: "#f5f5f7",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#444" }}>Start (YYYY-MM)</span>
          <input
            type="month"
            value={start}
            onChange={(event) => onStartChange(event.target.value)}
            disabled={auto}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#444" }}>End (YYYY-MM)</span>
          <input
            type="month"
            value={end}
            onChange={(event) => onEndChange(event.target.value)}
            disabled={auto}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={auto}
            onChange={(event) => onAutoChange(event.target.checked)}
          />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Auto (min→max)</span>
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <div
          role="radiogroup"
          aria-label="Métrica principal"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          {metrics.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onMetricChange(option.key)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: metric === option.key ? "1px solid #0f172a" : "1px solid #ccc",
                background: metric === option.key ? "#0f172a" : "#fff",
                color: metric === option.key ? "#fff" : "#111",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onLoad}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #1d4ed8",
              background: "#1d4ed8",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {loading ? "Carregando..." : "Carregar"}
          </button>
          <button
            type="button"
            onClick={onReset}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fff",
              color: "#111",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Limpar
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={onExport}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #15803d",
                background: "#15803d",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Exportar XLSX
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
