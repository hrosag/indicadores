import { supabase } from "./supabaseClient";
import type { IndicatorRowBase, MetricKey } from "./indicatorTypes";

export type { MetricKey };

export type IpcaRow = IndicatorRowBase & {
  ano: number | null;
  mes: string | null;
  num_indice?: number | null;
};

type FetchParams = {
  start?: string;
  end?: string;
  auto: boolean;
};

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toStringValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
};

export const parseRow = (row: Record<string, string | number | null>): IpcaRow => ({
  data: String(row.data ?? ""),
  ano: toNumber(row.ano),
  mes: toStringValue(row.mes),
  num_indice: toNumber(row.num_indice),
  var_m: toNumber(row.var_m),
  var_3_m: toNumber(row.var_3_m),
  var_6_m: toNumber(row.var_6_m),
  var_ano: toNumber(row.var_ano),
  var_12_m: toNumber(row.var_12_m),
});

export const getMinMaxDate = (rows: IpcaRow[]) => {
  if (rows.length === 0) return { min: "", max: "" };
  const sorted = [...rows].sort((a, b) => a.data.localeCompare(b.data));
  return { min: sorted[0].data, max: sorted[sorted.length - 1].data };
};

export const fetchIpcaMinMaxDate = async () => {
  const qMin = supabase
    .from("vw_ipca_1737_monthly")
    .select("data")
    .order("data", { ascending: true })
    .limit(1);
  const qMax = supabase
    .from("vw_ipca_1737_monthly")
    .select("data")
    .order("data", { ascending: false })
    .limit(1);

  const [
    { data: minData, error: minErr },
    { data: maxData, error: maxErr },
  ] = await Promise.all([qMin, qMax]);

  if (minErr) throw new Error(minErr.message);
  if (maxErr) throw new Error(maxErr.message);

  return {
    min: (minData?.[0]?.data ?? "") as string,
    max: (maxData?.[0]?.data ?? "") as string,
  };
};

export const fetchIpcaMonthly = async ({ start, end, auto }: FetchParams) => {
  let query = supabase
    .from("vw_ipca_1737_monthly")
    .select("*")
    .order("data", { ascending: true });

  if (!auto) {
    if (start) query = query.gte("data", start);
    if (end) query = query.lte("data", end);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => parseRow(row as Record<string, string | number | null>));
};
