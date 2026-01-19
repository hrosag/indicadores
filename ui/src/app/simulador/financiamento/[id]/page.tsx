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
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
};

const sectionStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const formatNumberInput = (value: number | "") => (value === "" ? "" : String(value));

const sumValues = (values: FinanceInputValue[]) =>
  values.reduce((total, value) => total + (value === "" ? 0 : Number(value)), 0);

const ensureArrayLength = (values: FinanceInputValue[], count: number) =>
  Array.from({ length: count }, (_, index) => values[index] ?? "");

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

  const simulationId = params.id;

  const structuringFeeTotal = useMemo(
    () => sumValues(inputs.structuring_fee_installments),
    [inputs.structuring_fee_installments],
  );
  const managementFeeTotal = useMemo(
    () => sumValues(inputs.management_fee_values),
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
      structuring_fee_installments: ensureArrayLength(
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
      management_fee_values: ensureArrayLength(prev.management_fee_values, count),
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
        <div style={{ display: "grid", gap: 12, maxWidth: 260 }}>
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
              style={inputStyle}
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
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <div>
            <div style={labelStyle}>Valor financiado</div>
            <input
              type="number"
              value={formatNumberInput(inputs.financed_value)}
              onChange={(event) =>
                updateInput(
                  "financed_value",
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Desp. financiada</div>
            <input
              type="number"
              value={formatNumberInput(inputs.financed_expenses_amount)}
              onChange={(event) =>
                updateInput(
                  "financed_expenses_amount",
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Garantias</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <div>
            <div style={labelStyle}>Valor da garantia (R$)</div>
            <input
              type="number"
              value={formatNumberInput(inputs.guarantee_value)}
              onChange={(event) =>
                updateInput("guarantee_value", event.target.value === "" ? "" : Number(event.target.value))
              }
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>% de garantia</div>
            <input
              type="number"
              value={formatNumberInput(inputs.guarantee_pct)}
              onChange={(event) =>
                updateInput("guarantee_pct", event.target.value === "" ? "" : Number(event.target.value))
              }
              style={inputStyle}
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
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {inputs.structuring_fee_installments.map((value, index) => (
              <div key={`structuring-fee-${index}`}>
                <div style={labelStyle}>{`Parcela ${index + 1} (R$)`}</div>
                <input
                  type="number"
                  value={formatNumberInput(value)}
                  onChange={(event) => {
                    const nextValue = event.target.value === "" ? "" : Number(event.target.value);
                    setInputs((prev) => {
                      const nextInstallments = [...prev.structuring_fee_installments];
                      nextInstallments[index] = nextValue;
                      return { ...prev, structuring_fee_installments: nextInstallments };
                    });
                  }}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div>
            <div style={labelStyle}>Total taxa de estruturação (R$)</div>
            <input
              type="number"
              value={formatNumberInput(structuringFeeTotal)}
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
            type="number"
            value={formatNumberInput(totalGranted)}
            readOnly
            style={{ ...inputStyle, background: "#f5f5f5" }}
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Prazos (meses)</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
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
              style={inputStyle}
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
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Prazo total p/ pgto</div>
            <input
              type="number"
              value={formatNumberInput(termMonths)}
              readOnly
              style={{ ...inputStyle, background: "#f5f5f5" }}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Taxas</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
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
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Seguro (%)</div>
            <input
              type="number"
              step="0.0001"
              value={formatNumberInput(inputs.insurance_pct)}
              onChange={(event) =>
                updateInput(
                  "insurance_pct",
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Taxa de gestão (mensal)</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ maxWidth: 220 }}>
            <div style={labelStyle}>Incide por quantos meses?</div>
            <input
              type="number"
              value={formatNumberInput(inputs.management_fee_months)}
              onChange={(event) =>
                updateManagementFeeMonths(event.target.value === "" ? "" : Number(event.target.value))
              }
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {inputs.management_fee_values.map((value, index) => (
              <div key={`management-fee-${index}`}>
                <div style={labelStyle}>{`Mês ${index + 1} – Taxa de gestão (R$)`}</div>
                <input
                  type="number"
                  value={formatNumberInput(value)}
                  onChange={(event) => {
                    const nextValue = event.target.value === "" ? "" : Number(event.target.value);
                    setInputs((prev) => {
                      const nextValues = [...prev.management_fee_values];
                      nextValues[index] = nextValue;
                      return { ...prev, management_fee_values: nextValues };
                    });
                  }}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div>
            <div style={labelStyle}>Total taxa de gestão (R$)</div>
            <input
              type="number"
              value={formatNumberInput(managementFeeTotal)}
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
