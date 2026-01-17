"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import useIsAdmin from "../../../../lib/useIsAdmin";

type FinanceSimulationRow = {
  id: string;
  title: string | null;
  created_at: string;
};

export default function LoadFinancingSimulationPage() {
  const { isAdmin, loading } = useIsAdmin();
  const [simulations, setSimulations] = useState<FinanceSimulationRow[]>([]);
  const [status, setStatus] = useState("Carregando simulações...");

  useEffect(() => {
    let active = true;

    const loadSimulations = async () => {
      if (!isAdmin) {
        if (active) {
          setStatus("Acesso restrito. Apenas administradores podem visualizar simulações.");
        }
        return;
      }

      const { data, error } = await supabase
        .from("finance_simulations")
        .select("id, title, created_at")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setStatus("Falha ao carregar simulações.");
        return;
      }

      setSimulations(data ?? []);
      setStatus(data && data.length > 0 ? "" : "Nenhuma simulação cadastrada.");
    };

    if (!loading) {
      void loadSimulations();
    }

    return () => {
      active = false;
    };
  }, [isAdmin, loading]);

  if (loading) {
    return <main style={{ padding: 24 }}>Carregando...</main>;
  }

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Carregar simulação</h1>
      <p>{status}</p>

      <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
        {simulations.map((simulation) => (
          <Link
            key={simulation.id}
            href={`/simulador/financiamento/${simulation.id}`}
            style={{
              border: "1px solid #eee",
              borderRadius: 10,
              padding: "12px 14px",
              textDecoration: "none",
              color: "inherit",
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {simulation.title || "Simulação sem título"}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Criada em {new Date(simulation.created_at).toLocaleString("pt-BR")}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
