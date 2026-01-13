"use client";

import { useMemo } from "react";
import { IpcaRow, MetricKey } from "../lib/ipca";
import { MetricOption } from "./IpcaToolbar";

const sparklinePoints = (rows: IpcaRow[], metric: MetricKey) => {
  const values = rows.map((row) => row[metric]).filter((value) => value !== null) as number[];
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, idx) => {
      const x = (idx / Math.max(values.length - 1, 1)) * 120;
      const y = 40 - ((value - min) / range) * 40;
      return `${x},${y}`;
    })
    .join(" ");
};

type MiniMetricChartsProps = {
  rows: IpcaRow[];
  metrics: MetricOption[];
  activeMetric: MetricKey;
  onSelect: (metric: MetricKey) => void;
};

export default function MiniMetricCharts({
  rows,
  metrics,
  activeMetric,
  onSelect,
}: MiniMetricChartsProps) {
  const points = useMemo(
    () =>
      metrics.reduce<Record<string, string>>((acc, metric) => {
        acc[metric.key] = sparklinePoints(rows, metric.key);
        return acc;
      }, {}),
    [metrics, rows]
  );

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      {metrics.map((metric) => (
        <button
          key={metric.key}
          type="button"
          onClick={() => onSelect(metric.key)}
          style={{
            padding: 12,
            borderRadius: 12,
            border: activeMetric === metric.key ? "2px solid #1d4ed8" : "1px solid #e5e7eb",
            background: "#fff",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>{metric.label}</div>
          <svg viewBox="0 0 120 40" style={{ width: "100%", height: 48, marginTop: 8 }}>
            <polyline
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              points={points[metric.key]}
            />
          </svg>
        </button>
      ))}
    </section>
  );
}
