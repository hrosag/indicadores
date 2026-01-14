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
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipBounds, setTooltipBounds] = useState<{ width: number; height: number } | null>(
    null
  );

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
    const yMin = Math.floor(min * 100) / 100;
    const yMax = Math.ceil(max * 100) / 100;
    const range = yMax - yMin || 1;

    const points = series.map((point, idx) => {
      const x =
        paddingX +
        (idx / Math.max(series.length - 1, 1)) * (width - paddingX * 2);
      const y =
        paddingY + ((yMax - (point.value as number)) / range) * (height - paddingY * 2);
      return { x, y, ...point };
    });

    const yTicksCount = 5;
    const yStep = range / (yTicksCount - 1);
    const yTicks = Array.from({ length: yTicksCount }, (_, idx) => yMin + yStep * idx);

    const xTicksCount = Math.min(6, series.length);
    const xTickIndexes = Array.from({ length: xTicksCount }, (_, idx) => {
      if (xTicksCount === 1) return 0;
      return Math.round((idx * (series.length - 1)) / (xTicksCount - 1));
    }).filter((value, index, array) => array.indexOf(value) === index);

    return {
      points,
      min,
      max,
      width,
      height,
      paddingX,
      paddingY,
      yMin,
      yMax,
      yTicks,
      xTickIndexes,
    };
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
      </div>

      {chart ? (
        <div style={{ position: "relative", marginTop: 16 }}>
          {hoverIndex !== null && tooltipPos && chart.points[hoverIndex] && (
            <div
              style={{
                position: "absolute",
                left: (() => {
                  const nextX = tooltipPos.x + 12;
                  const maxX = (tooltipBounds?.width ?? chart.width) - 12;
                  return Math.min(Math.max(nextX, 8), maxX);
                })(),
                top: (() => {
                  const nextY = tooltipPos.y - 12;
                  const maxY = (tooltipBounds?.height ?? chart.height) - 8;
                  return Math.min(Math.max(nextY, 8), maxY);
                })(),
                padding: "6px 10px",
                borderRadius: 8,
                background: "#111827",
                color: "#fff",
                fontSize: 12,
                pointerEvents: "none",
                transform: "translateY(-100%)",
                whiteSpace: "nowrap",
              }}
            >
              {chart.points[hoverIndex].data} · {formatPercentLabel(chart.points[hoverIndex].value)}
            </div>
          )}
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            style={{ width: "100%", height: 320 }}
            role="img"
            aria-label={`Gráfico ${metricLabel}`}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
              setTooltipBounds({ width: rect.width, height: rect.height });
            }}
            onMouseLeave={() => {
              setHoverIndex(null);
              setTooltipPos(null);
              setTooltipBounds(null);
            }}
          >
            {chart.yTicks.map((tick) => {
              const y =
                chart.paddingY +
                ((chart.yMax - tick) / (chart.yMax - chart.yMin || 1)) *
                  (chart.height - chart.paddingY * 2);
              return (
                <g key={`y-tick-${tick}`}>
                  <line
                    x1={chart.paddingX}
                    x2={chart.width - chart.paddingX}
                    y1={y}
                    y2={y}
                    stroke="#eef2f7"
                  />
                  <line
                    x1={chart.paddingX - 4}
                    x2={chart.paddingX}
                    y1={y}
                    y2={y}
                    stroke="#cbd5f5"
                  />
                  <text
                    x={chart.paddingX - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="#6b7280"
                    fontSize="12"
                  >
                    {formatPercentLabel(tick)}
                  </text>
                </g>
              );
            })}

            {chart.xTickIndexes.map((tickIndex) => {
              const point = chart.points[tickIndex];
              if (!point) return null;
              const [year, month] = point.data.split("-");
              const label = month && year ? `${month}/${year.slice(-2)}` : point.data;
              return (
                <g key={`x-tick-${point.data}`}>
                  <line
                    x1={point.x}
                    x2={point.x}
                    y1={chart.paddingY}
                    y2={chart.height - chart.paddingY}
                    stroke="#f3f4f6"
                  />
                  <line
                    x1={point.x}
                    x2={point.x}
                    y1={chart.height - chart.paddingY}
                    y2={chart.height - chart.paddingY + 4}
                    stroke="#d1d5db"
                  />
                  <text
                    x={point.x}
                    y={chart.height - chart.paddingY + 18}
                    textAnchor="middle"
                    fill="#6b7280"
                    fontSize="12"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
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
          </svg>
        </div>
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
