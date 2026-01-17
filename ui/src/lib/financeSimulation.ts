export type FinanceInputValue = number | "";

export type CostItemInput = {
  code: string;
  label: string;
  amount: FinanceInputValue;
  is_financed: boolean;
};

export type FinanceSimulationInputs = {
  budget_total: FinanceInputValue;
  value_to_incur: FinanceInputValue;
  financed_value: FinanceInputValue;
  construction_months: FinanceInputValue;
  grace_months: FinanceInputValue;
  term_months: FinanceInputValue;
  fixed_rate_am: FinanceInputValue;
  correction_label: string;
  structuring_fee_pct: FinanceInputValue;
  structuring_fee_is_unique: boolean;
  structuring_fee_is_financed: boolean;
  cost_items: CostItemInput[];
};

export const fixedCostItemDefinitions = [
  { code: "EVAL_PROJECT", label: "Avaliação do projeto" },
  { code: "EVAL_COMMERCIAL", label: "Avaliação comercial" },
  { code: "INS_RCC", label: "Seguro RCC" },
  { code: "INS_PERFORMANCE", label: "Seguro Performance" },
  { code: "REGISTRY", label: "Registro de imóveis" },
  { code: "INS_MIP", label: "Seguro MIP" },
];

const toNumberInput = (value: unknown, fallback: FinanceInputValue) => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const toStringValue = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

const normalizeCorrectionLabel = (value: string) =>
  value === "IPCA embutido" ? "IPCA (embutido)" : value;

const seedFixedCostItems = (items: CostItemInput[]) => {
  const mapped = new Map(items.map((item) => [item.code, item]));
  return fixedCostItemDefinitions.map((definition) => {
    const existing = mapped.get(definition.code);
    return {
      code: definition.code,
      label: definition.label,
      amount: existing?.amount ?? "",
      is_financed: existing?.is_financed ?? false,
    };
  });
};

export const defaultFinanceSimulationInputs: FinanceSimulationInputs = {
  budget_total: "",
  value_to_incur: "",
  financed_value: "",
  construction_months: "",
  grace_months: 12,
  term_months: "",
  fixed_rate_am: 0.0145,
  correction_label: "IPCA (embutido)",
  structuring_fee_pct: 0.05,
  structuring_fee_is_unique: false,
  structuring_fee_is_financed: false,
  cost_items: seedFixedCostItems([]),
};

const normalizeCostItems = (items: unknown) => {
  if (!Array.isArray(items)) {
    return seedFixedCostItems([]);
  }

  const mapped = items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      return {
        code: toStringValue(record.code, ""),
        label: toStringValue(record.label, ""),
        amount: toNumberInput(record.amount, ""),
        is_financed: toBoolean(record.is_financed, false),
      };
    })
    .filter(Boolean) as CostItemInput[];

  return seedFixedCostItems(mapped);
};

export const hydrateFinanceInputs = (raw?: Record<string, unknown>) => {
  if (!raw) {
    return { ...defaultFinanceSimulationInputs, cost_items: seedFixedCostItems([]) };
  }

  return {
    budget_total: toNumberInput(raw.budget_total, defaultFinanceSimulationInputs.budget_total),
    value_to_incur: toNumberInput(
      raw.value_to_incur,
      defaultFinanceSimulationInputs.value_to_incur,
    ),
    financed_value: toNumberInput(
      raw.financed_value,
      defaultFinanceSimulationInputs.financed_value,
    ),
    construction_months: toNumberInput(
      raw.construction_months,
      defaultFinanceSimulationInputs.construction_months,
    ),
    grace_months: toNumberInput(raw.grace_months, defaultFinanceSimulationInputs.grace_months),
    term_months: toNumberInput(raw.term_months, defaultFinanceSimulationInputs.term_months),
    fixed_rate_am: toNumberInput(raw.fixed_rate_am, defaultFinanceSimulationInputs.fixed_rate_am),
    correction_label: normalizeCorrectionLabel(
      toStringValue(raw.correction_label, defaultFinanceSimulationInputs.correction_label),
    ),
    structuring_fee_pct: toNumberInput(
      raw.structuring_fee_pct,
      defaultFinanceSimulationInputs.structuring_fee_pct,
    ),
    structuring_fee_is_unique: toBoolean(
      raw.structuring_fee_is_unique,
      defaultFinanceSimulationInputs.structuring_fee_is_unique,
    ),
    structuring_fee_is_financed: toBoolean(
      raw.structuring_fee_is_financed,
      defaultFinanceSimulationInputs.structuring_fee_is_financed,
    ),
    cost_items: normalizeCostItems(raw.cost_items),
  };
};

const toNumberValue = (value: FinanceInputValue) => (value === "" ? null : Number(value));

const isCostItemEmpty = (item: CostItemInput) => item.amount === "" && !item.is_financed;

export const normalizeFinanceInputs = (inputs: FinanceSimulationInputs) => ({
  budget_total: toNumberValue(inputs.budget_total),
  value_to_incur: toNumberValue(inputs.value_to_incur),
  financed_value: toNumberValue(inputs.financed_value),
  construction_months: toNumberValue(inputs.construction_months),
  grace_months: toNumberValue(inputs.grace_months),
  term_months: toNumberValue(inputs.term_months),
  fixed_rate_am: toNumberValue(inputs.fixed_rate_am),
  correction_label: inputs.correction_label,
  structuring_fee_pct: toNumberValue(inputs.structuring_fee_pct),
  structuring_fee_is_unique: inputs.structuring_fee_is_unique,
  structuring_fee_is_financed: inputs.structuring_fee_is_financed,
  cost_items: fixedCostItemDefinitions
    .map((definition) => inputs.cost_items.find((item) => item.code === definition.code))
    .filter((item): item is CostItemInput => Boolean(item))
    .filter((item) => !isCostItemEmpty(item))
    .map((item) => ({
      code: item.code,
      label: item.label,
      amount: toNumberValue(item.amount),
      is_financed: item.is_financed,
    })),
});
