"use client";

import IndicatorPage from "../../../components/IndicatorPage";
import type { MetricOption } from "../../../components/IpcaToolbar";
import {
  fetchIpcaMinMaxDate,
  fetchIpcaMonthly,
  getMinMaxDate,
  IpcaRow,
} from "../../../lib/ipca15";
import type { MetricKey } from "../../../lib/indicatorTypes";

const METRICS: MetricOption[] = [
  { key: "var_m", label: "Mês" },
  { key: "var_3_m", label: "3 meses" },
  { key: "var_6_m", label: "6 meses" },
  { key: "var_ano", label: "Ano" },
  { key: "var_12_m", label: "12 meses" },
];

const DEFAULT_METRIC: MetricKey = "var_12_m";

const exportHeaders = ["data", ...METRICS.map((metric) => metric.key)];

const buildMetricExport = (row: IpcaRow) =>
  METRICS.reduce<Record<string, string | number | null>>((acc, metric) => {
    acc[metric.key] = row[metric.key] ?? "";
    return acc;
  }, {});

export default function Page() {
  return (
    <IndicatorPage<IpcaRow>
      title="IPCA-15"
      subtitle="Tabela 3065"
      metrics={METRICS}
      defaultMetric={DEFAULT_METRIC}
      fetchMinMaxDate={fetchIpcaMinMaxDate}
      fetchMonthly={fetchIpcaMonthly}
      getMinMaxDate={getMinMaxDate}
      exportConfig={{
        headers: exportHeaders,
        sheetName: "IPCA-15",
        mapRow: (row) => ({
          data: row.data,
          ...buildMetricExport(row),
        }),
        getFileName: ({ isFullHistory, start, end, rangeLabel }) =>
          isFullHistory
            ? "ipca15_3065_min_max.xlsx"
            : `ipca15_3065_${start || rangeLabel.min}_${end || rangeLabel.max}.xlsx`,
      }}
    />
  );
}
