"use client";

import IndicatorPage from "../../../components/IndicatorPage";
import type { MetricOption } from "../../../components/IpcaToolbar";
import { fetchInpcMinMaxDate, fetchInpcMonthly, getMinMaxDate, InpcRow } from "../../../lib/inpc";
import type { MetricKey } from "../../../lib/indicatorTypes";

const METRICS: MetricOption[] = [
  { key: "var_m", label: "Mês" },
  { key: "var_3_m", label: "3 meses" },
  { key: "var_6_m", label: "6 meses" },
  { key: "var_ano", label: "Ano" },
  { key: "var_12_m", label: "12 meses" },
];

const DEFAULT_METRIC: MetricKey = "var_m";

const exportHeaders = ["data", ...METRICS.map((metric) => metric.key)];

const buildMetricExport = (row: InpcRow) =>
  METRICS.reduce<Record<string, string | number | null>>((acc, metric) => {
    acc[metric.key] = row[metric.key] ?? "";
    return acc;
  }, {});

export default function Page() {
  return (
    <IndicatorPage<InpcRow>
      title="INPC"
      subtitle="Tabela 1736"
      metrics={METRICS}
      defaultMetric={DEFAULT_METRIC}
      fetchMinMaxDate={fetchInpcMinMaxDate}
      fetchMonthly={fetchInpcMonthly}
      getMinMaxDate={getMinMaxDate}
      exportConfig={{
        headers: exportHeaders,
        sheetName: "INPC",
        mapRow: (row) => ({
          data: row.data,
          ...buildMetricExport(row),
        }),
        getFileName: ({ isFullHistory, start, end, rangeLabel }) =>
          isFullHistory
            ? "inpc_1736_min_max.xlsx"
            : `inpc_1736_${start || rangeLabel.min}_${end || rangeLabel.max}.xlsx`,
      }}
    />
  );
}
