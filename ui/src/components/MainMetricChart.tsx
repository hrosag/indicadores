"use client";

import { useMemo, useState } from "react";
import { formatPercentBR } from "../lib/format";
import { IpcaRow, MetricKey } from "../lib/ipca";

const formatPercentLabel = (value: number | null) => {
  if (value === null) return "-";
  return formatPercentBR(value) || "-";
};

const formatYMShort = (ym: string) => {
  const [year, month] = ym.split("-");
  return `${month}/${year.slice(2)}`;
};

type MainMetricChartProps = {
  rows: IpcaRow[];
  metric: MetricKey;
  metricLabel: string;
  loading: boolean;
  error: string | null;
  showDataLabels?: boolean;
  onShowDataLabelsChange?: (value: boolean) => void;
  onRetry: () => void;
};

export default function MainMetricChart({
  rows,
  metric,
  metricLabel,
  loading,
  error,
  showDataLabels,
  onShowDataLabelsChange,
  onRetry,
}: MainMetricChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipBounds, setTooltipBounds] = useState<{ width: number; height: number } | null>(
    null
  );

  // Canvas interno fixo (estável) + SVG responsivo por CSS
  const W = 1000;
  const H = 320;

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

    const width = W;
    const height = H;

    // Padding (deixe maior à esquerda por conta dos labels do eixo Y)
    const paddingX = 56;
    const paddingY = 32;

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

    const isShortSeries = series.length <= 14;

    const xTickIndexes = isShortSeries
      ? []
      : (() => {
          const ticksCount = Math.min(6, series.length);
          return Array.from({ length: ticksCount }, (_, idx) => {
            if (ticksCount === 1) return 0;
            return Math.round((idx * (series.length - 1)) / (ticksCount - 1));
          }).filter((value, index, array) => array.indexOf(value) === index);
        })();

    const xTicks = isShortSeries
      ? points.filter((point) => {
          const month = Number(point.data.split("-")[1]);
          return [3, 6, 9, 12].includes(month);
        })
      : xTickIndexes.map((index) => points[index]).filter(Boolean);

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
      xTicks,
      isShortSeries,
    };
  }, [series, W, H]);

  const canShowLabels = Boolean(showDataLabels) && series.length <= 36;

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
        {onShowDataLabelsChange && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={Boolean(showDataLabels)}
              onChange={(event) => onShowDataLabelsChange(event.target.checked)}
            />
            <span style={{ fontWeight: 600, color: "#334155" }}>Exibir valores</span>
          </label>
        )}
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
              {(() => {
                const point = chart.points[hoverIndex];
                const label = formatPercentBR(point.value as number) || "-";
                const suffix = (point.value as number) < 0 ? " (negativo)" : "";
                return `${point.data} · ${label}${suffix}`;
              })()}
            </div>
          )}

          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: 360, display: "block" }}
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
            {(() => {
              const hasZero = chart.min < 0 && chart.max > 0;
              if (!hasZero) return null;

              const yZero =
                chart.paddingY +
                ((chart.max - 0) / (chart.max - chart.min)) * (chart.height - chart.paddingY * 2);

              return (
                <g>
                  <rect
                    x={chart.paddingX}
                    y={yZero}
                    width={chart.width - chart.paddingX * 2}
                    height={chart.height - yZero - chart.paddingY}
                    fill="#fef2f2"
                  />
                  <line
                    x1={chart.paddingX}
                    x2={chart.width - chart.paddingX}
                    y1={yZero}
                    y2={yZero}
                    stroke="#e5e7eb"
                    strokeDasharray="4 4"
                  />
                </g>
              );
            })()}

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

            {chart.xTicks.map((point) => {
              if (!point) return null;
              const label = formatYMShort(point.data);
              return (
                <g key={`x-tick-${point.data}`}>
                  <line
                    x1={point.x}
                    x2={point.x}
                    y1={chart.paddingY}
                    y2={chart.height - chart.paddingY}
                    stroke="#f1f5f9"
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

            {chart.points.map((point, idx) => {
              const isNegative = (point.value as number) < 0;
              return (
                <g key={`${point.data}-${metric}`}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isNegative ? 5 : 4}
                    fill={isNegative ? "#ef4444" : idx === hoverIndex ? "#1d4ed8" : "#93c5fd"}
                    onMouseEnter={() => setHoverIndex(idx)}
                    onMouseLeave={() => setHoverIndex(null)}
                  />
                  {canShowLabels && (
                    <text x={point.x + 6} y={point.y - 6} fontSize="11" fill="#6b7280">
                      {formatPercentBR(point.value as number)}
                    </text>
                  )}
                </g>
              );
            })}
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
