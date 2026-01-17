"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MainMetricChart from "../../../components/MainMetricChart";
import MiniMetricCharts from "../../../components/MiniMetricCharts";
import PibTable from "../../../components/PibTable";
import PibToolbar, { PibMetricOption } from "../../../components/PibToolbar";
import { shiftMonth } from "../../../lib/date";
import {
  fetchPibMinMaxDate,
  fetchPibQuarterly,
  getMinMaxDate,
  PibMetricKey,
  PibRow,
} from "../../../lib/pib";
import useIsAdmin from "../../../lib/useIsAdmin";

const METRICS: PibMetricOption[] = [
  { key: "var_qoq", label: "Trim/Trim" },
  { key: "var_yoy", label: "Mesmo tri ano ant." },
  { key: "var_ytd", label: "Acum. no ano" },
  { key: "var_4q", label: "Acum. 4 trimestres" },
];

const DEFAULT_METRIC: PibMetricKey = "var_qoq";

const exportHeaders = ["data", ...METRICS.map((metric) => metric.key)];

const buildMetricExport = (row: PibRow) =>
  METRICS.reduce<Record<string, string | number | null>>((acc, metric) => {
    acc[metric.key] = row[metric.key] ?? "";
    return acc;
  }, {});

export default function Page() {
  const [rows, setRows] = useState<PibRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDefault12q, setIsDefault12q] = useState(true);
  const [isFullHistory, setIsFullHistory] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<PibMetricKey>(DEFAULT_METRIC);
  const [resetKey, setResetKey] = useState(0);
  const [rangeLabel, setRangeLabel] = useState({ min: "", max: "" });
  const [availableRange, setAvailableRange] = useState({ min: "", max: "" });
  const [helperMessage, setHelperMessage] = useState<string | null>(null);
  const [showDataLabels, setShowDataLabels] = useState(false);

  const { isAdmin } = useIsAdmin();

  const getDefaultRange = useCallback(
    (maxValue: string) => ({
      start: shiftMonth(maxValue, -33),
      end: maxValue,
    }),
    []
  );

  const clampManualRange = useCallback(
    (valueStart: string, valueEnd: string) => {
      let nextStart = valueStart;
      let nextEnd = valueEnd;
      let message: string | null = null;

      if (availableRange.min && nextStart && nextStart < availableRange.min) {
        nextStart = availableRange.min;
        message = "Intervalo ajustado ao mínimo disponível.";
      }

      if (availableRange.max && nextEnd && nextEnd > availableRange.max) {
        nextEnd = availableRange.max;
        message = "Intervalo ajustado ao máximo disponível.";
      }

      if (nextStart && nextEnd && nextStart > nextEnd) {
        [nextStart, nextEnd] = [nextEnd, nextStart];
        message = "Intervalo ajustado para manter início ≤ fim.";
      }

      return { start: nextStart, end: nextEnd, message };
    },
    [availableRange.max, availableRange.min]
  );

  const loadData = useCallback(
    async (options?: {
      auto?: boolean;
      start?: string;
      end?: string;
      keepLoading?: boolean;
    }) => {
      if (!options?.keepLoading) setLoading(true);
      setError(null);

      try {
        const auto = options?.auto ?? false;
        const startValue = options?.start ?? start;
        const endValue = options?.end ?? end;
        const data = await fetchPibQuarterly({ start: startValue, end: endValue, auto });
        setRows(data);
        const minMax = getMinMaxDate(data);
        setRangeLabel(minMax);
        if (!auto) {
          setStart(startValue);
          setEnd(endValue);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro inesperado ao buscar dados.";
        setError(message.includes("Failed to fetch") ? "Falha de conexão. Tente novamente." : message);
      } finally {
        setLoading(false);
      }
    },
    [end, fetchPibQuarterly, getMinMaxDate, start]
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const range = await fetchPibMinMaxDate();
        setAvailableRange(range);
        const defaultRange = range.max ? getDefaultRange(range.max) : { start: "", end: "" };
        setIsDefault12q(true);
        setIsFullHistory(false);
        setStart(defaultRange.start);
        setEnd(defaultRange.end);
        await loadData({
          auto: false,
          start: defaultRange.start,
          end: defaultRange.end,
          keepLoading: true,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro inesperado ao buscar intervalo.";
        setError(message);
        setLoading(false);
      }
    };
    void bootstrap();
  }, [fetchPibMinMaxDate, getDefaultRange, loadData]);

  const metricLabel = useMemo(
    () => METRICS.find((metric) => metric.key === selectedMetric)?.label ?? "",
    [selectedMetric]
  );

  const otherMetrics = useMemo(
    () => METRICS.filter((metric) => metric.key !== selectedMetric),
    [selectedMetric]
  );

  const handleReset = async () => {
    setSelectedMetric(DEFAULT_METRIC);
    setResetKey((prev) => prev + 1);
    setHelperMessage(null);
    setError(null);
    try {
      const range = await fetchPibMinMaxDate();
      setAvailableRange(range);
      const defaultRange = range.max ? getDefaultRange(range.max) : { start: "", end: "" };
      setIsDefault12q(true);
      setIsFullHistory(false);
      setStart(defaultRange.start);
      setEnd(defaultRange.end);
      await loadData({ auto: false, start: defaultRange.start, end: defaultRange.end });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao resetar.";
      setError(message);
    }
  };

  const handleLoad = () => {
    if (isDefault12q || isFullHistory) return;

    let nextStart = start;
    let nextEnd = end;
    let message: string | null = null;

    if (!nextStart || !nextEnd) {
      if (availableRange.max) {
        const defaultRange = getDefaultRange(availableRange.max);
        nextStart = defaultRange.start;
        nextEnd = defaultRange.end;
        message = "Intervalo padrão aplicado (últimos 12 trimestres).";
      }
    }

    if (!nextStart || !nextEnd) {
      setError("Informe Start e End para o modo manual.");
      return;
    }

    const clamped = clampManualRange(nextStart, nextEnd);
    setHelperMessage(message ?? clamped.message);
    setIsFullHistory(false);
    void loadData({ auto: false, start: clamped.start, end: clamped.end });
  };

  const handleDefaultChange = (value: boolean) => {
    if (value) {
      const nextRange = availableRange.max ? getDefaultRange(availableRange.max) : { start, end };
      setIsDefault12q(true);
      setIsFullHistory(false);
      setStart(nextRange.start);
      setEnd(nextRange.end);
      setHelperMessage(null);
      void loadData({ auto: false, start: nextRange.start, end: nextRange.end });
      return;
    }
    setIsDefault12q(false);
  };

  const handleLoadFullHistory = () => {
    setIsDefault12q(false);
    setIsFullHistory(true);
    setHelperMessage(null);
    void loadData({ auto: true });
  };

  const handleRetry = () => {
    if (isFullHistory) {
      void loadData({ auto: true });
      return;
    }
    if (isDefault12q) {
      const nextRange = availableRange.max ? getDefaultRange(availableRange.max) : { start, end };
      setStart(nextRange.start);
      setEnd(nextRange.end);
      void loadData({ auto: false, start: nextRange.start, end: nextRange.end });
      return;
    }
    handleLoad();
  };

  const handleExport = async () => {
    if (!isAdmin) return;
    const XLSX = await import("xlsx");
    const exportRows = rows.map((row) => ({
      data: row.data,
      ...buildMetricExport(row),
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      header: exportHeaders,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PIB");
    const filename = isFullHistory
      ? "pib_5932_min_max.xlsx"
      : `pib_5932_${start || rangeLabel.min}_${end || rangeLabel.max}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <header>
        <h1 style={{ margin: 0 }}>PIB</h1>
        <p style={{ marginTop: 6, color: "#6b7280" }}>SIDRA 5932</p>
      </header>

      <PibToolbar
        start={start}
        end={end}
        auto={isDefault12q}
        metric={selectedMetric}
        metrics={METRICS}
        loading={loading}
        isAdmin={isAdmin}
        availableMin={availableRange.min}
        availableMax={availableRange.max}
        helperMessage={helperMessage}
        disableLoad={isFullHistory}
        onStartChange={setStart}
        onEndChange={setEnd}
        onAutoChange={handleDefaultChange}
        onMetricChange={setSelectedMetric}
        onLoad={handleLoad}
        onLoadFullHistory={handleLoadFullHistory}
        onReset={handleReset}
        onExport={handleExport}
      />

      <section style={{ display: "grid", gap: 16 }}>
        <MainMetricChart
          rows={rows}
          metric={selectedMetric}
          metricLabel={metricLabel}
          loading={loading}
          error={error}
          showDataLabels={showDataLabels}
          onShowDataLabelsChange={setShowDataLabels}
          onRetry={handleRetry}
          seriesLabel="Série trimestral"
        />

        {otherMetrics.length > 0 && (
          <MiniMetricCharts<PibMetricKey>
            rows={rows}
            metrics={otherMetrics}
            activeMetric={selectedMetric}
            onSelect={setSelectedMetric}
          />
        )}
      </section>

      <PibTable rows={rows} loading={loading} resetKey={resetKey} metrics={METRICS} />

      {!loading && !error && rows.length > 0 && (
        <footer style={{ color: "#6b7280", fontSize: 12 }}>
          Range atual:{" "}
          {isFullHistory
            ? "Histórico completo (min→max)"
            : isDefault12q
              ? "Padrão (últimos 12 trimestres)"
              : `${start} → ${end}`}{" "}
          · Disponível: {availableRange.min} → {availableRange.max}
        </footer>
      )}
    </main>
  );
}
