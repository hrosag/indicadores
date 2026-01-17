"use client";

import { useMemo } from "react";
import { formatPercentBR } from "../lib/format";
type MetricValue = number | string | null | undefined;

type MetricRow = {
  data: string;
} & Record<string, MetricValue>;

type MetricOption<K extends string = string> = {
  key: K;
  label: string;
};

const toNumber = (value: MetricValue) => (typeof value === "number" ? value : null);

const sparklinePoints = (rows: MetricRow[], metric: string) => {
  const values = rows
    .map((row) => toNumber(row[metric]))
    .filter((value): value is number => value !== null);
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

type MiniMetricChartsProps<K extends string = string> = {
  rows: MetricRow[];
  metrics: MetricOption<K>[];
  activeMetric: K;
  onSelect: (metric: K) => void;
};

export default function MiniMetricCharts<K extends string = string>({
  rows,
  metrics,
  activeMetric,
  onSelect,
}: MiniMetricChartsProps<K>) {
  const points = useMemo(
    () =>
      metrics.reduce<Record<string, string>>((acc, metric) => {
        acc[metric.key] = sparklinePoints(rows, metric.key);
        return acc;
      }, {}),
    [metrics, rows]
  );

  const lastValues = useMemo(
    () =>
      metrics.reduce<Record<string, number | null>>((acc, metric) => {
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          const value = toNumber(rows[i]?.[metric.key]);
          if (value !== null) {
            acc[metric.key] = value;
            return acc;
          }
        }
        acc[metric.key] = null;
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
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            {formatPercentBR(lastValues[metric.key] ?? null)}
          </div>
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
