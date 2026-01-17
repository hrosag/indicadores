"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import useIsAdmin from "../../../../lib/useIsAdmin";
import {
  CostItemInput,
  FinanceSimulationInputs,
  defaultFinanceSimulationInputs,
  fixedCostItemDefinitions,
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

  const costItems = useMemo(() => inputs.cost_items, [inputs.cost_items]);

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
    const construction =
      inputs.construction_months === "" ? null : Number(inputs.construction_months);
    const grace = inputs.grace_months === "" ? null : Number(inputs.grace_months);
    const nextTerm = construction === null || grace === null ? "" : construction + grace;

    if (inputs.term_months !== nextTerm) {
      setInputs((prev) => ({ ...prev, term_months: nextTerm }));
    }
  }, [inputs.construction_months, inputs.grace_months, inputs.term_months]);

  const updateInput = <K extends keyof FinanceSimulationInputs>(
    key: K,
    value: FinanceSimulationInputs[K],
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const updateCostItem = (code: string, updates: Partial<CostItemInput>) => {
    setInputs((prev) => ({
      ...prev,
      cost_items: prev.cost_items.map((item) =>
        item.code === code ? { ...item, ...updates } : item,
      ),
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
          Preencha os campos da simulação comercial (bullet) e salve para seguir.
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
        <h2 style={{ margin: 0 }}>Projeto</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div>
            <div style={labelStyle}>Orçamento total (R$)</div>
            <input
              type="number"
              value={formatNumberInput(inputs.budget_total)}
              onChange={(event) =>
                updateInput("budget_total", event.target.value === "" ? "" : Number(event.target.value))
              }
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Valor a incorrer (R$)</div>
            <input
              type="number"
              value={formatNumberInput(inputs.value_to_incur)}
              onChange={(event) =>
                updateInput(
                  "value_to_incur",
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Valor financiado (R$)</div>
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
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Prazo</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div>
            <div style={labelStyle}>Prazo de obra (meses)</div>
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
            <div style={labelStyle}>Carência p/ pagamento (meses)</div>
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
            <div style={labelStyle}>Prazo total (meses)</div>
            <input
              type="number"
              value={formatNumberInput(inputs.term_months)}
              readOnly
              style={{ ...inputStyle, background: "#f5f5f5" }}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Condições</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div>
              <div style={labelStyle}>Taxa de juros (a.m.)</div>
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
              <div style={labelStyle}>Correção monetária</div>
              <select
                value={inputs.correction_label}
                onChange={(event) => updateInput("correction_label", event.target.value)}
                style={inputStyle}
              >
                <option value="IPCA">IPCA</option>
                <option value="IPCA (embutido)">IPCA (embutido)</option>
              </select>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "minmax(180px, 1fr) auto auto",
              alignItems: "center",
            }}
          >
            <div>
              <div style={labelStyle}>Taxa de estruturação (%)</div>
              <input
                type="number"
                step="0.0001"
                value={formatNumberInput(inputs.structuring_fee_pct)}
                onChange={(event) =>
                  updateInput(
                    "structuring_fee_pct",
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
                style={inputStyle}
              />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 22 }}>
              <input
                type="checkbox"
                checked={inputs.structuring_fee_is_unique}
                onChange={(event) => updateInput("structuring_fee_is_unique", event.target.checked)}
              />
              <span>Estruturação única</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 22 }}>
              <input
                type="checkbox"
                checked={inputs.structuring_fee_is_financed}
                onChange={(event) => updateInput("structuring_fee_is_financed", event.target.checked)}
              />
              <span>Estruturação financiada</span>
            </label>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Custos adicionais</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {fixedCostItemDefinitions.map((definition) => {
            const item = costItems.find((entry) => entry.code === definition.code);
            return (
              <div
                key={definition.code}
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "minmax(180px, 1fr) minmax(140px, 180px) auto",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{definition.label}</div>
                <input
                  type="number"
                  value={formatNumberInput(item?.amount ?? "")}
                  onChange={(event) =>
                    updateCostItem(definition.code, {
                      amount: event.target.value === "" ? "" : Number(event.target.value),
                    })
                  }
                  placeholder="Valor (R$)"
                  style={inputStyle}
                />
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={item?.is_financed ?? false}
                    onChange={(event) =>
                      updateCostItem(definition.code, { is_financed: event.target.checked })
                    }
                  />
                  <span>Financiado</span>
                </label>
              </div>
            );
          })}
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
