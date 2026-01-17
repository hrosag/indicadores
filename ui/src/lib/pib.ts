import { supabase } from "./supabaseClient";

export type PibMetricKey = "var_qoq" | "var_yoy" | "var_ytd" | "var_4q";

export type PibRow = {
  data: string;
  ano: number | null;
  trimestre: number | null;
  var_qoq: number | null;
  var_yoy: number | null;
  var_ytd: number | null;
  var_4q: number | null;
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

const parseRow = (row: Record<string, string | number | null>): PibRow => ({
  data: String(row.data ?? ""),
  ano: toNumber(row.ano),
  trimestre: toNumber(row.trimestre),
  var_qoq: toNumber(row.var_qoq),
  var_yoy: toNumber(row.var_yoy),
  var_ytd: toNumber(row.var_ytd),
  var_4q: toNumber(row.var_4q),
});

export const getMinMaxDate = (rows: PibRow[]) => {
  if (rows.length === 0) return { min: "", max: "" };
  const sorted = [...rows].sort((a, b) => a.data.localeCompare(b.data));
  return { min: sorted[0].data, max: sorted[sorted.length - 1].data };
};

export const fetchPibMinMaxDate = async () => {
  const qMin = supabase
    .from("vw_pib_5932_quarterly")
    .select("data")
    .order("data", { ascending: true })
    .limit(1);
  const qMax = supabase
    .from("vw_pib_5932_quarterly")
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
    min: toStringValue(minData?.[0]?.data) ?? "",
    max: toStringValue(maxData?.[0]?.data) ?? "",
  };
};

export const fetchPibQuarterly = async ({ start, end, auto }: FetchParams) => {
  let query = supabase
    .from("vw_pib_5932_quarterly")
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
