export type FinanceInputValue = number | "";

export type FinanceAmortizationType = "SAC" | "PRICE" | "BULLET";

export type FinanceSimulationInputs = {
  amortization_type: FinanceAmortizationType;
  financed_value: FinanceInputValue;
  financed_expenses_amount: FinanceInputValue;
  guarantee_value: FinanceInputValue;
  guarantee_pct: FinanceInputValue;
  construction_months: FinanceInputValue;
  grace_months: FinanceInputValue;
  fixed_rate_am: FinanceInputValue;
  insurance_pct: FinanceInputValue;
  structuring_fee_installments_count: FinanceInputValue;
  structuring_fee_installments: FinanceInputValue[];
  management_fee_months: FinanceInputValue;
  management_fee_values: FinanceInputValue[];
};

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

const toAmortizationType = (value: unknown, fallback: FinanceAmortizationType) => {
  if (value === "SAC" || value === "PRICE" || value === "BULLET") {
    return value;
  }
  return fallback;
};

const toInputArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => toNumberInput(entry, ""));
};

const ensureArrayLength = (values: FinanceInputValue[], count: number) =>
  Array.from({ length: count }, (_, index) => values[index] ?? "");

const toCountValue = (value: FinanceInputValue) => {
  if (value === "") {
    return 0;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Math.max(0, Math.trunc(numeric));
};

export const defaultFinanceSimulationInputs: FinanceSimulationInputs = {
  amortization_type: "BULLET",
  financed_value: "",
  financed_expenses_amount: "",
  guarantee_value: "",
  guarantee_pct: "",
  construction_months: "",
  grace_months: "",
  fixed_rate_am: 0.0145,
  insurance_pct: "",
  structuring_fee_installments_count: "",
  structuring_fee_installments: [],
  management_fee_months: "",
  management_fee_values: [],
};

export const hydrateFinanceInputs = (raw?: Record<string, unknown>) => {
  if (!raw) {
    return { ...defaultFinanceSimulationInputs };
  }

  const amortization_type = toAmortizationType(
    raw.amortization_type,
    defaultFinanceSimulationInputs.amortization_type,
  );
  const structuring_fee_installments_count = toNumberInput(
    raw.structuring_fee_installments_count,
    defaultFinanceSimulationInputs.structuring_fee_installments_count,
  );
  const management_fee_months = toNumberInput(
    raw.management_fee_months,
    defaultFinanceSimulationInputs.management_fee_months,
  );
  const structuring_fee_installments = toInputArray(raw.structuring_fee_installments);
  const management_fee_values = toInputArray(raw.management_fee_values);
  const normalizedStructuringCount = toCountValue(structuring_fee_installments_count);
  const normalizedManagementCount = toCountValue(management_fee_months);

  return {
    amortization_type,
    financed_value: toNumberInput(
      raw.financed_value,
      defaultFinanceSimulationInputs.financed_value,
    ),
    financed_expenses_amount: toNumberInput(
      raw.financed_expenses_amount,
      defaultFinanceSimulationInputs.financed_expenses_amount,
    ),
    guarantee_value: toNumberInput(
      raw.guarantee_value,
      defaultFinanceSimulationInputs.guarantee_value,
    ),
    guarantee_pct: toNumberInput(raw.guarantee_pct, defaultFinanceSimulationInputs.guarantee_pct),
    construction_months: toNumberInput(
      raw.construction_months,
      defaultFinanceSimulationInputs.construction_months,
    ),
    grace_months: toNumberInput(raw.grace_months, defaultFinanceSimulationInputs.grace_months),
    fixed_rate_am: toNumberInput(raw.fixed_rate_am, defaultFinanceSimulationInputs.fixed_rate_am),
    insurance_pct: toNumberInput(raw.insurance_pct, defaultFinanceSimulationInputs.insurance_pct),
    structuring_fee_installments_count,
    structuring_fee_installments: ensureArrayLength(
      structuring_fee_installments,
      normalizedStructuringCount,
    ),
    management_fee_months,
    management_fee_values: ensureArrayLength(management_fee_values, normalizedManagementCount),
  };
};

const toNumberValue = (value: FinanceInputValue) => (value === "" ? null : Number(value));

const normalizeInputsArray = (values: FinanceInputValue[], count: number) =>
  ensureArrayLength(values, count).map((value) => toNumberValue(value));

export const normalizeFinanceInputs = (inputs: FinanceSimulationInputs) => {
  const structuringCount = toCountValue(inputs.structuring_fee_installments_count);
  const managementCount = toCountValue(inputs.management_fee_months);

  return {
    amortization_type: inputs.amortization_type,
    financed_value: toNumberValue(inputs.financed_value),
    financed_expenses_amount: toNumberValue(inputs.financed_expenses_amount),
    guarantee_value: toNumberValue(inputs.guarantee_value),
    guarantee_pct: toNumberValue(inputs.guarantee_pct),
    construction_months: toNumberValue(inputs.construction_months),
    grace_months: toNumberValue(inputs.grace_months),
    fixed_rate_am: toNumberValue(inputs.fixed_rate_am),
    insurance_pct: toNumberValue(inputs.insurance_pct),
    structuring_fee_installments_count: toNumberValue(inputs.structuring_fee_installments_count),
    structuring_fee_installments: normalizeInputsArray(
      inputs.structuring_fee_installments,
      structuringCount,
    ),
    management_fee_months: toNumberValue(inputs.management_fee_months),
    management_fee_values: normalizeInputsArray(inputs.management_fee_values, managementCount),
  };
};
