"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  defaultFinanceSimulationInputs,
  normalizeFinanceInputs,
} from "../../../../lib/financeSimulation";
import { supabase } from "../../../../lib/supabaseClient";
import useIsAdmin from "../../../../lib/useIsAdmin";

export default function NewFinancingSimulationPage() {
  const router = useRouter();
  const { isAdmin, loading } = useIsAdmin();
  const [status, setStatus] = useState("Criando simulação...");

  useEffect(() => {
    let active = true;

    const createSimulation = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/admin/login");
        return;
      }

      if (!isAdmin) {
        if (active) {
          setStatus("Acesso restrito. Você não possui permissão para criar simulações.");
        }
        return;
      }

      const { data: insertData, error } = await supabase
        .from("finance_simulations")
        .insert({
          title: "Nova simulação",
          inputs: normalizeFinanceInputs(defaultFinanceSimulationInputs),
        })
        .select("id")
        .single();

      if (!active) return;

      if (error || !insertData?.id) {
        setStatus("Não foi possível criar a simulação. Tente novamente.");
        return;
      }

      router.replace(`/simulador/financiamento/${insertData.id}`);
    };

    if (!loading) {
      void createSimulation();
    }

    return () => {
      active = false;
    };
  }, [isAdmin, loading, router]);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Nova simulação</h1>
      <p>{status}</p>
    </main>
  );
}
