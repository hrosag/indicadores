"use client";

import { useMemo, useState } from "react";
import { formatPercentBR } from "../lib/format";
import { IpcaRow, MetricKey } from "../lib/ipca";

const formatPercentLabel = (value: number | null) => {
  if (value === null) return "-";
  return formatPercentBR(value) || "-";
};

type MainMetricChartProps = {
  rows: IpcaRow[];
  metric: MetricKey;
  metricLabel: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export default function MainMetricChart({
  rows,
  metric,
  metricLabel,
  loading,
  error,
  onRetry,
}: MainMetricChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = useMemo(
    () =>
      rows
        .map((row, index) => ({
          index,
          data: row.data,
          value: row[metric],
        }))
        .filter((point) => point.value !== null),
    [rows, metric]
  );

  const chart = useMemo(() => {
    if (series.length === 0) return null;
    const values = series.map((point) => point.value as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const paddingX = 48;
    const paddingY = 32;
    const width = 900;
    const height = 320;
    const range = max - min || 1;

    const points = series.map((point, idx) => {
      const x =
        paddingX +
        (idx / Math.max(series.length - 1, 1)) * (width - paddingX * 2);
      const y =
        paddingY + ((max - (point.value as number)) / range) * (height - paddingY * 2);
      return { x, y, ...point };
    });

    return { points, min, max, width, height, paddingX, paddingY };
  }, [series]);

  if (loading) {
    return (
      <section
        style={{
          padding: 20,
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          background: "#fff",
        }}
      >
        <div style={{ height: 20, width: 120, background: "#e5e7eb", borderRadius: 8 }} />
        <div
          style={{
            marginTop: 16,
            height: 320,
            borderRadius: 12,
            background: "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)",
            backgroundSize: "200% 100%",
            animation: "pulse 1.5s infinite",
          }}
        />
      </section>
    );
  }

  if (error) {
    return (
      <section
        style={{
          padding: 20,
          borderRadius: 16,
          border: "1px solid #fecaca",
          background: "#fef2f2",
          color: "#991b1b",
        }}
      >
        <strong>Erro ao carregar gráfico</strong>
        <p style={{ marginTop: 8 }}>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 12,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #991b1b",
            background: "#fff",
            color: "#991b1b",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section
      style={{
        padding: 20,
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{metricLabel}</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            Série mensal — {rows.length} registros
          </p>
        </div>
        {hoverIndex !== null && chart && chart.points[hoverIndex] && (
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: "#111827",
              color: "#fff",
              fontSize: 12,
            }}
          >
            {chart.points[hoverIndex].data} · {formatPercentLabel(chart.points[hoverIndex].value)}
          </div>
        )}
      </div>

      {chart ? (
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          style={{ width: "100%", height: 320, marginTop: 16 }}
          role="img"
          aria-label={`Gráfico ${metricLabel}`}
        >
          <line
            x1={chart.paddingX}
            x2={chart.width - chart.paddingX}
            y1={chart.height - chart.paddingY}
            y2={chart.height - chart.paddingY}
            stroke="#e5e7eb"
          />
          <line
            x1={chart.paddingX}
            x2={chart.paddingX}
            y1={chart.paddingY}
            y2={chart.height - chart.paddingY}
            stroke="#e5e7eb"
          />
          <polyline
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            points={chart.points.map((point) => `${point.x},${point.y}`).join(" ")}
          />
          {chart.points.map((point, idx) => (
            <circle
              key={`${point.data}-${metric}`}
              cx={point.x}
              cy={point.y}
              r={4}
              fill={idx === hoverIndex ? "#1d4ed8" : "#93c5fd"}
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          ))}
          <text
            x={chart.width - chart.paddingX}
            y={chart.paddingY}
            textAnchor="end"
            fill="#6b7280"
            fontSize="12"
          >
            {formatPercentLabel(chart.max)}
          </text>
          <text
            x={chart.width - chart.paddingX}
            y={chart.height - chart.paddingY}
            textAnchor="end"
            fill="#6b7280"
            fontSize="12"
          >
            {formatPercentLabel(chart.min)}
          </text>
        </svg>
      ) : (
        <div
          style={{
            marginTop: 16,
            padding: 24,
            borderRadius: 12,
            border: "1px dashed #d1d5db",
            color: "#6b7280",
            textAlign: "center",
          }}
        >
          Nenhum dado disponível para o período selecionado.
        </div>
      )}
    </section>
  );
}
