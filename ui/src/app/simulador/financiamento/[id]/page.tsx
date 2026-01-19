"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import useIsAdmin from "../../../../lib/useIsAdmin";
import {
  FinanceSimulationInputs,
  FinanceInputValue,
  defaultFinanceSimulationInputs,
  hydrateFinanceInputs,
  normalizeFinanceInputs,
} from "../../../../lib/financeSimulation";

type SimulationRecord = {
  id: string;
  title: string | null;
  inputs: Record<string, unknown> | null;
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  marginBottom: 4,
  color: "#444",
};

const sectionStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const compactInputStyle: CSSProperties = {
  ...inputStyle,
  maxWidth: 160,
};

const formatNumberInput = (value: number | "") => (value === "" ? "" : String(value));

type StructuringFeeInstallment = { month: FinanceInputValue; amount: FinanceInputValue };
const EMPTY_STRUCTURING_INSTALLMENT: StructuringFeeInstallment = { month: "", amount: "" };

const sumValues = (values: Array<{ amount: FinanceInputValue }>) =>
  values.reduce<number>((total, value) => {
    const add = value.amount === "" ? 0 : Number(value.amount);
    return total + (Number.isNaN(add) ? 0 : add);
  }, 0);

const sumSimpleValues = (values: FinanceInputValue[]) =>
  values.reduce<number>((total, value) => {
    const add = value === "" ? 0 : Number(value);
    return total + (Number.isNaN(add) ? 0 : add);
  }, 0);

const ensureArrayLength = (values: FinanceInputValue[], count: number) =>
  Array.from({ length: count }, (_, index) => values[index] ?? "");

const ensureStructuringFeeLength = (
  values: StructuringFeeInstallment[],
  count: number,
) =>
  Array.from({ length: count }, (_, index) => values[index] ?? EMPTY_STRUCTURING_INSTALLMENT);

const toSafeCount = (value: FinanceInputValue) => {
  if (value === "") {
    return 0;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Math.max(0, Math.trunc(numeric));
};

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 6,
});

const formatPercentValue = (value: FinanceInputValue) =>
  value === "" ? "" : percentFormatter.format(Number(value));

const parseDecimalText = (text: string): FinanceInputValue => {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(/[^\d,.-]/g, "");
  if (!normalized) {
    return "";
  }
  const value = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? "" : parsed;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatCurrencyValue = (value: FinanceInputValue | number) => {
  if (value === "" || value === null || Number.isNaN(Number(value))) {
    return "";
  }
  return currencyFormatter.format(Number(value));
};
export default function FinancingSimulationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { isAdmin, loading } = useIsAdmin();
  const [title, setTitle] = useState("Nova simulação");
  const [inputs, setInputs] = useState<FinanceSimulationInputs>(
    defaultFinanceSimulationInputs,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [financedValueText, setFinancedValueText] = useState("");
  const [financedExpensesText, setFinancedExpensesText] = useState("");
  const [guaranteeValueText, setGuaranteeValueText] = useState("");
  const [insuranceText, setInsuranceText] = useState("");
  const [guaranteePctText, setGuaranteePctText] = useState("");
  const [structuringFeeAmountTexts, setStructuringFeeAmountTexts] = useState<string[]>([]);
  const [managementFeeFixedText, setManagementFeeFixedText] = useState("");
  const [managementFeeValueTexts, setManagementFeeValueTexts] = useState<string[]>([]);

  const simulationId = params.id;

  const structuringFeeTotal = useMemo(
    () => sumValues(inputs.structuring_fee_installments),
    [inputs.structuring_fee_installments],
  );
  const managementFeeTotal = useMemo(
    () => sumSimpleValues(inputs.management_fee_values),
    [inputs.management_fee_values],
  );
  const totalGranted = useMemo(() => {
    const financedValue = inputs.financed_value === "" ? 0 : Number(inputs.financed_value);
    const financedExpenses =
      inputs.financed_expenses_amount === "" ? 0 : Number(inputs.financed_expenses_amount);
    return financedValue + financedExpenses + structuringFeeTotal;
  }, [inputs.financed_expenses_amount, inputs.financed_value, structuringFeeTotal]);
  const termMonths = useMemo(() => {
    const construction =
      inputs.construction_months === "" ? null : Number(inputs.construction_months);
    const grace = inputs.grace_months === "" ? null : Number(inputs.grace_months);
    if (construction === null || grace === null) {
      return "";
    }
    return construction + grace;
  }, [inputs.construction_months, inputs.grace_months]);

  useEffect(() => {
    let active = true;

    const fetchSimulation = async () => {
      if (!isAdmin) {
        setStatus("Acesso restrito. Apenas administradores podem editar simulações.");
        return;
      }

      const { data, error } = await supabase
        .from("finance_simulations")
        .select("id, title, inputs")
        .eq("id", simulationId)
        .single();

      if (!active) return;

      if (error || !data) {
        setStatus("Simulação não encontrada.");
        return;
      }

      const record = data as SimulationRecord;
      setTitle(record.title || "Nova simulação");
      setInputs(hydrateFinanceInputs(record.inputs ?? undefined));
      setStatus(null);
    };

    if (!loading) {
      void fetchSimulation();
    }

    return () => {
      active = false;
    };
  }, [isAdmin, loading, simulationId]);

  useEffect(() => {
    setFinancedValueText(formatCurrencyValue(inputs.financed_value));
  }, [inputs.financed_value]);

  useEffect(() => {
    setFinancedExpensesText(formatCurrencyValue(inputs.financed_expenses_amount));
  }, [inputs.financed_expenses_amount]);

  useEffect(() => {
    setGuaranteeValueText(formatCurrencyValue(inputs.guarantee_value));
  }, [inputs.guarantee_value]);

  useEffect(() => {
    setInsuranceText(formatPercentValue(inputs.insurance_pct));
  }, [inputs.insurance_pct]);

  useEffect(() => {
    setGuaranteePctText(formatPercentValue(inputs.guarantee_pct));
  }, [inputs.guarantee_pct]);

  useEffect(() => {
    setStructuringFeeAmountTexts(
      inputs.structuring_fee_installments.map((entry) => formatCurrencyValue(entry.amount)),
    );
  }, [inputs.structuring_fee_installments]);

  useEffect(() => {
    setManagementFeeFixedText(formatCurrencyValue(inputs.management_fee_fixed_amount));
  }, [inputs.management_fee_fixed_amount]);

  useEffect(() => {
    setManagementFeeValueTexts(
      inputs.management_fee_values.map((entry) => formatCurrencyValue(entry)),
    );
  }, [inputs.management_fee_values]);

  const updateInput = <K extends keyof FinanceSimulationInputs>(
    key: K,
    value: FinanceSimulationInputs[K],
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const updateStructuringFeeCount = (value: FinanceInputValue) => {
    const count = toSafeCount(value);
    setInputs((prev) => ({
      ...prev,
      structuring_fee_installments_count: value,
      structuring_fee_installments: ensureStructuringFeeLength(
        prev.structuring_fee_installments,
        count,
      ),
    }));
  };

  const updateManagementFeeMonths = (value: FinanceInputValue) => {
    const count = toSafeCount(value);
    setInputs((prev) => ({
      ...prev,
      management_fee_months: value,
      management_fee_values: prev.management_fee_is_fixed
        ? Array.from({ length: count }, () =>
            prev.management_fee_fixed_amount === "" ? "" : prev.management_fee_fixed_amount,
          )
        : ensureArrayLength(prev.management_fee_values, count),
    }));
  };

  const handleSave = async () => {
    setStatus(null);
    setSaving(true);

    const { error } = await supabase
      .from("finance_simulations")
      .update({
        title,
        inputs: normalizeFinanceInputs(inputs),
      })
      .eq("id", simulationId);

    if (error) {
      setStatus("Não foi possível salvar a simulação.");
    } else {
      setStatus("Simulação salva com sucesso.");
    }

    setSaving(false);
  };

  const handleBack = () => router.push("/simulador/financiamento");

  if (loading) {
    return <main style={{ padding: 24 }}>Carregando...</main>;
  }

  if (!isAdmin) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Simulador — Financiamento</h1>
        <p>Área disponível apenas para administradores.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 20 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <button
          onClick={handleBack}
          style={{
            width: "fit-content",
            border: "1px solid #ddd",
            background: "#fff",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          ← Voltar
        </button>
        <h1 style={{ margin: 0 }}>Simulador — Financiamento</h1>
        <p style={{ margin: 0, color: "#555" }}>
          Preencha os campos da simulação de financiamento e salve para seguir.
        </p>
      </header>

      {status && (
        <div
          style={{
            border: "1px solid #eee",
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          {status}
        </div>
      )}

      <section style={sectionStyle}>
        <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <div>
            <div style={labelStyle}>Título</div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              style={inputStyle}
              placeholder="Nome da simulação"
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Tipo de financiamento</h2>
        <div style={{ display: "grid", gap: 12, maxWidth: 320 }}>
          <div>
            <div style={labelStyle}>Tipo de financiamento</div>
            <select
              value={inputs.amortization_type}
              onChange={(event) =>
                updateInput(
                  "amortization_type",
                  event.target.value as FinanceSimulationInputs["amortization_type"],
                )
              }
              style={{ ...inputStyle, maxWidth: 240 }}
            >
              <option value="SAC">SAC</option>
              <option value="PRICE">PRICE</option>
              <option value="BULLET">BULLET</option>
            </select>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Valores (R$)</h2>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div>
            <div style={labelStyle}>Valor financiado</div>
            <input
              type="text"
              inputMode="decimal"
              value={financedValueText}
              onFocus={() =>
                setFinancedValueText(
                  inputs.financed_value === "" ? "" : String(inputs.financed_value),
                )
              }
              onChange={(event) => setFinancedValueText(event.target.value)}
              onBlur={(event) => {
                const parsed = parseDecimalText(event.target.value);
                updateInput("financed_value", parsed);
                setFinancedValueText(parsed === "" ? "" : formatCurrencyValue(parsed));
              }}
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Desp. financiada</div>
            <input
              type="text"
              inputMode="decimal"
              value={financedExpensesText}
              onFocus={() =>
                setFinancedExpensesText(
                  inputs.financed_expenses_amount === ""
                    ? ""
                    : String(inputs.financed_expenses_amount),
                )
              }
              onChange={(event) => setFinancedExpensesText(event.target.value)}
              onBlur={(event) => {
                const parsed = parseDecimalText(event.target.value);
                updateInput("financed_expenses_amount", parsed);
                setFinancedExpensesText(parsed === "" ? "" : formatCurrencyValue(parsed));
              }}
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Garantias</h2>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div>
            <div style={labelStyle}>Valor da garantia (R$)</div>
            <input
              type="text"
              inputMode="decimal"
              value={guaranteeValueText}
              onFocus={() =>
                setGuaranteeValueText(
                  inputs.guarantee_value === "" ? "" : String(inputs.guarantee_value),
                )
              }
              onChange={(event) => setGuaranteeValueText(event.target.value)}
              onBlur={(event) => {
                const parsed = parseDecimalText(event.target.value);
                updateInput("guarantee_value", parsed);
                setGuaranteeValueText(parsed === "" ? "" : formatCurrencyValue(parsed));
              }}
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>% de garantia</div>
            <input
              type="text"
              inputMode="decimal"
              value={guaranteePctText}
              onFocus={() => setGuaranteePctText(formatPercentValue(inputs.guarantee_pct))}
              onChange={(event) => setGuaranteePctText(event.target.value)}
              onBlur={(event) => {
                const parsed = parseDecimalText(event.target.value);
                updateInput("guarantee_pct", parsed);
                setGuaranteePctText(parsed === "" ? "" : formatPercentValue(parsed));
              }}
              style={{ ...inputStyle, maxWidth: 160 }}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Taxa de estruturação</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ maxWidth: 220 }}>
            <div style={labelStyle}>Em quantas parcelas?</div>
            <input
              type="number"
              value={formatNumberInput(inputs.structuring_fee_installments_count)}
              onChange={(event) =>
                updateStructuringFeeCount(event.target.value === "" ? "" : Number(event.target.value))
              }
              style={compactInputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {inputs.structuring_fee_installments.map((value, index) => (
              <div
                key={`structuring-fee-${index}`}
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <div>
                  <div style={labelStyle}>{`Parcela ${index + 1} – Mês`}</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formatNumberInput(value.month)}
                    onChange={(event) => {
                      const nextValue = event.target.value === "" ? "" : Number(event.target.value);
                      setInputs((prev) => {
                        const nextInstallments = [...prev.structuring_fee_installments];
                        nextInstallments[index] = {
                          ...nextInstallments[index],
                          month: nextValue,
                        };
                        return { ...prev, structuring_fee_installments: nextInstallments };
                      });
                    }}
                    style={compactInputStyle}
                  />
                </div>
                <div>
                  <div style={labelStyle}>{`Parcela ${index + 1} – Valor (R$)`}</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={structuringFeeAmountTexts[index] ?? ""}
                    onFocus={() =>
                      setStructuringFeeAmountTexts((prev) => {
                        const next = [...prev];
                        next[index] = value.amount === "" ? "" : String(value.amount);
                        return next;
                      })
                    }
                    onChange={(event) =>
                      setStructuringFeeAmountTexts((prev) => {
                        const next = [...prev];
                        next[index] = event.target.value;
                        return next;
                      })
                    }
                    onBlur={(event) => {
                      const parsed = parseDecimalText(event.target.value);
                      setInputs((prev) => {
                        const nextInstallments = [...prev.structuring_fee_installments];
                        nextInstallments[index] = {
                          ...nextInstallments[index],
                          amount: parsed,
                        };
                        return { ...prev, structuring_fee_installments: nextInstallments };
                      });
                      setStructuringFeeAmountTexts((prev) => {
                        const next = [...prev];
                        next[index] = parsed === "" ? "" : formatCurrencyValue(parsed);
                        return next;
                      });
                    }}
                    style={inputStyle}
                  />
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={labelStyle}>Total taxa de estruturação (R$)</div>
            <input
              type="text"
              value={formatCurrencyValue(structuringFeeTotal)}
              readOnly
              style={{ ...inputStyle, background: "#f5f5f5" }}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Valor total concedido</h2>
        <div style={{ maxWidth: 240 }}>
          <div style={labelStyle}>Total concedido (R$)</div>
          <input
            type="text"
            value={formatCurrencyValue(totalGranted)}
            readOnly
            style={{ ...inputStyle, background: "#f5f5f5" }}
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Prazos (meses)</h2>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <div>
            <div style={labelStyle}>Prazo de obra</div>
            <input
              type="number"
              value={formatNumberInput(inputs.construction_months)}
              onChange={(event) =>
                updateInput(
                  "construction_months",
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              style={compactInputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Tempo de carência</div>
            <input
              type="number"
              value={formatNumberInput(inputs.grace_months)}
              onChange={(event) =>
                updateInput("grace_months", event.target.value === "" ? "" : Number(event.target.value))
              }
              style={compactInputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Prazo total p/ pgto</div>
            <input
              type="number"
              value={formatNumberInput(termMonths)}
              readOnly
              style={{ ...compactInputStyle, background: "#f5f5f5" }}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Taxas</h2>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div>
            <div style={labelStyle}>Taxa simulada (a.m.)</div>
            <input
              type="number"
              step="0.0001"
              value={formatNumberInput(inputs.fixed_rate_am)}
              onChange={(event) =>
                updateInput(
                  "fixed_rate_am",
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              style={{ ...inputStyle, maxWidth: 200 }}
            />
          </div>
          <div>
            <div style={labelStyle}>Seguro (%)</div>
            <input
              type="text"
              inputMode="decimal"
              value={insuranceText}
              onFocus={() => setInsuranceText(formatPercentValue(inputs.insurance_pct))}
              onChange={(event) => setInsuranceText(event.target.value)}
              onBlur={(event) => {
                const parsed = parseDecimalText(event.target.value);
                updateInput("insurance_pct", parsed);
                setInsuranceText(parsed === "" ? "" : formatPercentValue(parsed));
              }}
              style={{ ...inputStyle, maxWidth: 200 }}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Taxa de gestão (mensal)</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ maxWidth: 260 }}>
            <div style={labelStyle}>Incide por quantos meses?</div>
            <input
              type="number"
              value={formatNumberInput(inputs.management_fee_months)}
              onChange={(event) =>
                updateManagementFeeMonths(event.target.value === "" ? "" : Number(event.target.value))
              }
              style={compactInputStyle}
            />
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#444",
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={inputs.management_fee_is_fixed}
              onChange={(event) => {
                const nextChecked = event.target.checked;
                setInputs((prev) => {
                  const count = toSafeCount(prev.management_fee_months);
                  return {
                    ...prev,
                    management_fee_is_fixed: nextChecked,
                    management_fee_values: nextChecked
                      ? Array.from({ length: count }, () =>
                          prev.management_fee_fixed_amount === ""
                            ? ""
                            : prev.management_fee_fixed_amount,
                        )
                      : prev.management_fee_values,
                  };
                });
              }}
            />
            A taxa de gestão é fixa?
          </label>
          {inputs.management_fee_is_fixed ? (
            <div style={{ maxWidth: 240 }}>
              <div style={labelStyle}>Valor mensal (R$)</div>
              <input
                type="text"
                inputMode="decimal"
                value={managementFeeFixedText}
                onFocus={() =>
                  setManagementFeeFixedText(
                    inputs.management_fee_fixed_amount === ""
                      ? ""
                      : String(inputs.management_fee_fixed_amount),
                  )
                }
                onChange={(event) => setManagementFeeFixedText(event.target.value)}
                onBlur={(event) => {
                  const parsed = parseDecimalText(event.target.value);
                  setInputs((prev) => {
                    const count = toSafeCount(prev.management_fee_months);
                    return {
                      ...prev,
                      management_fee_fixed_amount: parsed,
                      management_fee_values: Array.from({ length: count }, () =>
                        parsed === "" ? "" : parsed,
                      ),
                    };
                  });
                  setManagementFeeFixedText(parsed === "" ? "" : formatCurrencyValue(parsed));
                }}
                style={inputStyle}
              />
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {inputs.management_fee_values.map((value, index) => (
                <div key={`management-fee-${index}`}>
                  <div style={labelStyle}>{`Mês ${index + 1} – Taxa de gestão (R$)`}</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={managementFeeValueTexts[index] ?? ""}
                    onFocus={() =>
                      setManagementFeeValueTexts((prev) => {
                        const next = [...prev];
                        next[index] = value === "" ? "" : String(value);
                        return next;
                      })
                    }
                    onChange={(event) =>
                      setManagementFeeValueTexts((prev) => {
                        const next = [...prev];
                        next[index] = event.target.value;
                        return next;
                      })
                    }
                    onBlur={(event) => {
                      const parsed = parseDecimalText(event.target.value);
                      setInputs((prev) => {
                        const nextValues = [...prev.management_fee_values];
                        nextValues[index] = parsed;
                        return { ...prev, management_fee_values: nextValues };
                      });
                      setManagementFeeValueTexts((prev) => {
                        const next = [...prev];
                        next[index] = parsed === "" ? "" : formatCurrencyValue(parsed);
                        return next;
                      });
                    }}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          )}
          <div>
            <div style={labelStyle}>Total taxa de gestão (R$)</div>
            <input
              type="text"
              value={formatCurrencyValue(managementFeeTotal)}
              readOnly
              style={{ ...inputStyle, background: "#f5f5f5" }}
            />
          </div>
        </div>
      </section>

      <section style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            border: "1px solid #222",
            background: saving ? "#444" : "#222",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 18px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <span style={{ color: "#666" }}>
          {saving ? "" : "As entradas são salvas na simulação selecionada."}
        </span>
      </section>
    </main>
  );
}
