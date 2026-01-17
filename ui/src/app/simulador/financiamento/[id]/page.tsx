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

const buildEmptyCostItem = (): CostItemInput => ({
  code: "",
  label: "",
  amount: "",
  is_financed: false,
});

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

  const updateInput = <K extends keyof FinanceSimulationInputs>(
    key: K,
    value: FinanceSimulationInputs[K],
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const updateCostItem = (index: number, next: CostItemInput) => {
    setInputs((prev) => {
      const updated = [...prev.cost_items];
      updated[index] = next;
      return { ...prev, cost_items: updated };
    });
  };

  const addCostItem = () => {
    setInputs((prev) => ({
      ...prev,
      cost_items: [...prev.cost_items, buildEmptyCostItem()],
    }));
  };

  const removeCostItem = (index: number) => {
    setInputs((prev) => ({
      ...prev,
      cost_items: prev.cost_items.filter((_, itemIndex) => itemIndex !== index),
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
        <h2 style={{ margin: 0 }}>Valores principais</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div>
            <div style={labelStyle}>Budget total</div>
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
            <div style={labelStyle}>Valor a incorrer</div>
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
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Prazos</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div>
            <div style={labelStyle}>Meses de obra</div>
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
            <div style={labelStyle}>Prazo total (meses)</div>
            <input
              type="number"
              value={formatNumberInput(inputs.term_months)}
              onChange={(event) =>
                updateInput("term_months", event.target.value === "" ? "" : Number(event.target.value))
              }
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Taxas</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div>
            <div style={labelStyle}>Taxa fixa a.m.</div>
            <input
              type="number"
              step="0.0001"
              value={formatNumberInput(inputs.fixed_rate_am)}
              onChange={(event) =>
                updateInput("fixed_rate_am", event.target.value === "" ? "" : Number(event.target.value))
              }
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Indexador</div>
            <input
              value={inputs.correction_label}
              onChange={(event) => updateInput("correction_label", event.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Structuring fee (%)</div>
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
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={inputs.structuring_fee_is_unique}
              onChange={(event) => updateInput("structuring_fee_is_unique", event.target.checked)}
            />
            <span>Structuring fee é parcela única</span>
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={inputs.structuring_fee_is_financed}
              onChange={(event) => updateInput("structuring_fee_is_financed", event.target.checked)}
            />
            <span>Structuring fee financiada</span>
          </label>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Itens de custo</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {costItems.map((item, index) => (
            <div
              key={`${item.code}-${index}`}
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "minmax(80px, 120px) minmax(160px, 1fr) minmax(120px, 160px) auto",
                alignItems: "center",
              }}
            >
              <input
                value={item.code}
                onChange={(event) =>
                  updateCostItem(index, {
                    ...item,
                    code: event.target.value,
                  })
                }
                placeholder="Código"
                style={inputStyle}
              />
              <input
                value={item.label}
                onChange={(event) =>
                  updateCostItem(index, {
                    ...item,
                    label: event.target.value,
                  })
                }
                placeholder="Descrição"
                style={inputStyle}
              />
              <input
                type="number"
                value={formatNumberInput(item.amount)}
                onChange={(event) =>
                  updateCostItem(index, {
                    ...item,
                    amount: event.target.value === "" ? "" : Number(event.target.value),
                  })
                }
                placeholder="Valor"
                style={inputStyle}
              />
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={item.is_financed}
                  onChange={(event) =>
                    updateCostItem(index, {
                      ...item,
                      is_financed: event.target.checked,
                    })
                  }
                />
                <span>Financiado</span>
              </label>
              {costItems.length > 1 && (
                <button
                  onClick={() => removeCostItem(index)}
                  style={{
                    border: "1px solid #ddd",
                    background: "#fff",
                    borderRadius: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
        <div>
          <button
            onClick={addCostItem}
            style={{
              border: "1px solid #222",
              background: "#222",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Adicionar item
          </button>
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
