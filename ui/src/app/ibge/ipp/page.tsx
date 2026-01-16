"use client";

import IndicatorPage from "../../../components/IndicatorPage";
import type { MetricOption } from "../../../components/IpcaToolbar";
import { fetchIppMinMaxDate, fetchIppMonthly, getMinMaxDate, IppRow } from "../../../lib/ipp";
import type { MetricKey } from "../../../lib/indicatorTypes";

const METRICS: MetricOption[] = [
  { key: "var_m", label: "Mês" },
  { key: "var_ano", label: "Ano" },
  { key: "var_12_m", label: "12 meses" },
];

const DEFAULT_METRIC: MetricKey = "var_12_m";

const exportHeaders = ["data", ...METRICS.map((metric) => metric.key), "num_indice"];

const buildMetricExport = (row: IppRow) =>
  METRICS.reduce<Record<string, string | number | null>>((acc, metric) => {
    acc[metric.key] = row[metric.key] ?? "";
    return acc;
  }, {});

export default function Page() {
  return (
    <IndicatorPage<IppRow>
      title="IPP"
      subtitle="Tabela 6904"
      metrics={METRICS}
      defaultMetric={DEFAULT_METRIC}
      fetchMinMaxDate={fetchIppMinMaxDate}
      fetchMonthly={fetchIppMonthly}
      getMinMaxDate={getMinMaxDate}
      exportConfig={{
        headers: exportHeaders,
        sheetName: "IPP",
        mapRow: (row) => ({
          data: row.data,
          ...buildMetricExport(row),
          num_indice: row.num_indice ?? "",
        }),
        getFileName: ({ isFullHistory, start, end, rangeLabel }) =>
          isFullHistory
            ? "ipp_6904_min_max.xlsx"
            : `ipp_6904_${start || rangeLabel.min}_${end || rangeLabel.max}.xlsx`,
      }}
    />
  );
}
