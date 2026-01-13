"use client";

import { useEffect, useMemo, useState } from "react";
import IpcaTable from "../../../components/IpcaTable";
import IpcaToolbar, { MetricOption } from "../../../components/IpcaToolbar";
import MainMetricChart from "../../../components/MainMetricChart";
import MiniMetricCharts from "../../../components/MiniMetricCharts";
import { fetchIpcaMonthly, getMinMaxDate, IpcaRow, MetricKey } from "../../../lib/ipca";

const METRICS: MetricOption[] = [
  { key: "var_m", label: "Mês" },
  { key: "var_3_m", label: "3 meses" },
  { key: "var_6_m", label: "6 meses" },
  { key: "var_ano", label: "Ano" },
  { key: "var_12_m", label: "12 meses" },
];

const DEFAULT_METRIC: MetricKey = "var_12_m";

export default function Page() {
  const [rows, setRows] = useState<IpcaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRange, setAutoRange] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(DEFAULT_METRIC);
  const [resetKey, setResetKey] = useState(0);
  const [rangeLabel, setRangeLabel] = useState({ min: "", max: "" });

  // TODO: integrar com o mecanismo real de role/claims.
  const isAdmin = false;

  const loadData = async (options?: { keepLoading?: boolean }) => {
    if (!options?.keepLoading) setLoading(true);
    setError(null);

    try {
      const data = await fetchIpcaMonthly({ start, end, auto: autoRange });
      setRows(data);
      const minMax = getMinMaxDate(data);
      setRangeLabel(minMax);
      if (autoRange) {
        setStart(minMax.min);
        setEnd(minMax.max);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao buscar dados.";
      setError(message.includes("Failed to fetch") ? "Falha de conexão. Tente novamente." : message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metricLabel = useMemo(
    () => METRICS.find((metric) => metric.key === selectedMetric)?.label ?? "",
    [selectedMetric]
  );

  const otherMetrics = useMemo(
    () => METRICS.filter((metric) => metric.key !== selectedMetric),
    [selectedMetric]
  );

  const handleReset = () => {
    setAutoRange(true);
    setStart("");
    setEnd("");
    setSelectedMetric(DEFAULT_METRIC);
    setResetKey((prev) => prev + 1);
    void loadData();
  };

  const handleLoad = () => {
    if (!autoRange && (!start || !end)) {
      setError("Informe Start e End para o modo manual.");
      return;
    }
    void loadData();
  };

  const handleExport = async () => {
    if (!isAdmin) return;
    const XLSX = await import("xlsx");
    const exportRows = rows.map((row) => ({
      data: row.data,
      var_m: row.var_m ?? "",
      var_3_m: row.var_3_m ?? "",
      var_6_m: row.var_6_m ?? "",
      var_ano: row.var_ano ?? "",
      var_12_m: row.var_12_m ?? "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      header: ["data", "var_m", "var_3_m", "var_6_m", "var_ano", "var_12_m"],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "IPCA");
    const filename = autoRange
      ? "ipca_min_max.xlsx"
      : `ipca_${start || rangeLabel.min}_${end || rangeLabel.max}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <header>
        <h1 style={{ margin: 0 }}>Indicadores — IPCA (IBGE/SIDRA)</h1>
        <p style={{ marginTop: 6, color: "#6b7280" }}>
          Série mensal do IPCA (1737) com seleção de métrica e análise detalhada.
        </p>
      </header>

      <IpcaToolbar
        start={start}
        end={end}
        auto={autoRange}
        metric={selectedMetric}
        metrics={METRICS}
        loading={loading}
        isAdmin={isAdmin}
        onStartChange={setStart}
        onEndChange={setEnd}
        onAutoChange={setAutoRange}
        onMetricChange={setSelectedMetric}
        onLoad={handleLoad}
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
          onRetry={handleLoad}
        />

        <MiniMetricCharts
          rows={rows}
          metrics={otherMetrics}
          activeMetric={selectedMetric}
          onSelect={setSelectedMetric}
        />
      </section>

      <IpcaTable rows={rows} loading={loading} resetKey={resetKey} />

      {!loading && !error && rows.length > 0 && (
        <footer style={{ color: "#6b7280", fontSize: 12 }}>
          Range atual: {autoRange ? "Auto (min→max)" : `${start} → ${end}`} · Disponível: {rangeLabel.min} → {rangeLabel.max}
        </footer>
      )}
    </main>
  );
}
