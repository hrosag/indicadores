export type MetricKey = "var_m" | "var_3_m" | "var_6_m" | "var_ano" | "var_12_m";

export type IndicatorRowBase = {
  data: string;
} & Record<MetricKey, number | null>;
