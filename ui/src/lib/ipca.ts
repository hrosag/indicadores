import { supabase } from "./supabaseClient";

export type MetricKey = "var_m" | "var_3_m" | "var_6_m" | "var_ano" | "var_12_m";

export type IpcaRow = {
  data: string;
  var_m: number | null;
  var_3_m: number | null;
  var_6_m: number | null;
  var_ano: number | null;
  var_12_m: number | null;
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

export const parseRow = (row: Record<string, string | number | null>): IpcaRow => ({
  data: String(row.data ?? ""),
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
