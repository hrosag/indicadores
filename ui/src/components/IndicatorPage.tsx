"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import IndicatorTable from "./IndicatorTable";
import IpcaToolbar, { MetricOption } from "./IpcaToolbar";
import MainMetricChart from "./MainMetricChart";
import MiniMetricCharts from "./MiniMetricCharts";
import { shiftMonth } from "../lib/date";
import type { IndicatorRowBase, MetricKey } from "../lib/indicatorTypes";
import useIsAdmin from "../lib/useIsAdmin";

type FetchParams = {
  start?: string;
  end?: string;
  auto: boolean;
};

type ExportConfig<Row extends IndicatorRowBase> = {
  headers: string[];
  sheetName: string;
  mapRow: (row: Row) => Record<string, string | number | null>;
  getFileName: (params: {
    isFullHistory: boolean;
    start: string;
    end: string;
    rangeLabel: { min: string; max: string };
  }) => string;
};

type IndicatorPageProps<Row extends IndicatorRowBase> = {
  title: string;
  subtitle?: string;
  metrics: MetricOption[];
  defaultMetric: MetricKey;
  fetchMinMaxDate: () => Promise<{ min: string; max: string }>;
  fetchMonthly: (params: FetchParams) => Promise<Row[]>;
  getMinMaxDate: (rows: Row[]) => { min: string; max: string };
  exportConfig?: ExportConfig<Row>;
  footerText?: string;
};

export default function IndicatorPage<Row extends IndicatorRowBase>({
  title,
  subtitle,
  metrics,
  defaultMetric,
  fetchMinMaxDate,
  fetchMonthly,
  getMinMaxDate,
  exportConfig,
  footerText,
}: IndicatorPageProps<Row>) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDefault12m, setIsDefault12m] = useState(true);
  const [isFullHistory, setIsFullHistory] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(defaultMetric);
  const [resetKey, setResetKey] = useState(0);
  const [rangeLabel, setRangeLabel] = useState({ min: "", max: "" });
  const [availableRange, setAvailableRange] = useState({ min: "", max: "" });
  const [helperMessage, setHelperMessage] = useState<string | null>(null);
  const [showDataLabels, setShowDataLabels] = useState(false);
  const startRef = useRef(start);
  const endRef = useRef(end);

  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  useEffect(() => {
    endRef.current = end;
  }, [end]);

  const getDefaultRange = useCallback(
    (maxValue: string) => ({
      start: shiftMonth(maxValue, -11),
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
        const startValue = options?.start ?? startRef.current;
        const endValue = options?.end ?? endRef.current;
        const data = await fetchMonthly({ start: startValue, end: endValue, auto });
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
    [fetchMonthly, getMinMaxDate]
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const range = await fetchMinMaxDate();
        setAvailableRange(range);
        const defaultRange = range.max ? getDefaultRange(range.max) : { start: "", end: "" };
        setIsDefault12m(true);
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
  }, [fetchMinMaxDate, getDefaultRange, loadData]);

  const metricLabel = useMemo(
    () => metrics.find((metric) => metric.key === selectedMetric)?.label ?? "",
    [metrics, selectedMetric]
  );

  const otherMetrics = useMemo(
    () => metrics.filter((metric) => metric.key !== selectedMetric),
    [metrics, selectedMetric]
  );

  const handleReset = async () => {
    setSelectedMetric(defaultMetric);
    setResetKey((prev) => prev + 1);
    setHelperMessage(null);
    setError(null);
    try {
      const range = await fetchMinMaxDate();
      setAvailableRange(range);
      const defaultRange = range.max ? getDefaultRange(range.max) : { start: "", end: "" };
      setIsDefault12m(true);
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
    if (isDefault12m || isFullHistory) return;

    let nextStart = start;
    let nextEnd = end;
    let message: string | null = null;

    if (!nextStart || !nextEnd) {
      if (availableRange.max) {
        const defaultRange = getDefaultRange(availableRange.max);
        nextStart = defaultRange.start;
        nextEnd = defaultRange.end;
        message = "Intervalo padrão aplicado (últimos 12 meses).";
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
      setIsDefault12m(true);
      setIsFullHistory(false);
      setStart(nextRange.start);
      setEnd(nextRange.end);
      setHelperMessage(null);
      void loadData({ auto: false, start: nextRange.start, end: nextRange.end });
      return;
    }
    setIsDefault12m(false);
  };

  const handleLoadFullHistory = () => {
    setIsDefault12m(false);
    setIsFullHistory(true);
    setHelperMessage(null);
    void loadData({ auto: true });
  };

  const handleRetry = () => {
    if (isFullHistory) {
      void loadData({ auto: true });
      return;
    }
    if (isDefault12m) {
      const nextRange = availableRange.max ? getDefaultRange(availableRange.max) : { start, end };
      setStart(nextRange.start);
      setEnd(nextRange.end);
      void loadData({ auto: false, start: nextRange.start, end: nextRange.end });
      return;
    }
    handleLoad();
  };

  const handleExport = async () => {
    if (!isAdmin || !exportConfig) return;
    const XLSX = await import("xlsx");
    const exportRows = rows.map((row) => exportConfig.mapRow(row));
    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      header: exportConfig.headers,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, exportConfig.sheetName);
    const filename = exportConfig.getFileName({ isFullHistory, start, end, rangeLabel });
    XLSX.writeFile(workbook, filename);
  };

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <header>
        <h1 style={{ margin: 0 }}>{title}</h1>
        {subtitle && (
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            {subtitle}
          </p>
        )}
      </header>

      <IpcaToolbar
        start={start}
        end={end}
        auto={isDefault12m}
        metric={selectedMetric}
        metrics={metrics}
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
        />

        {otherMetrics.length > 0 && (
          <MiniMetricCharts<MetricKey>
            rows={rows}
            metrics={otherMetrics}
            activeMetric={selectedMetric}
            onSelect={setSelectedMetric}
          />
        )}
      </section>

      <IndicatorTable rows={rows} loading={loading} resetKey={resetKey} metrics={metrics} />

      {!loading && !error && rows.length > 0 && (
        <footer style={{ color: "#6b7280", fontSize: 12 }}>
          Range atual:{" "}
          {isFullHistory
            ? "Histórico completo (min→max)"
            : isDefault12m
              ? "Padrão (últimos 12 meses)"
              : `${start} → ${end}`}{" "}
          · Disponível: {availableRange.min} → {availableRange.max}
          {footerText ? ` · ${footerText}` : ""}
        </footer>
      )}
    </main>
  );
}
