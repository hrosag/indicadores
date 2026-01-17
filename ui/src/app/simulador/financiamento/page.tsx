"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import useIsAdmin from "../../../lib/useIsAdmin";

const cardStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  textDecoration: "none",
  color: "inherit",
  display: "grid",
  gap: 8,
};

export default function FinancingSimulatorPage() {
  const { isAdmin, loading } = useIsAdmin();

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
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Simulador — Financiamento</h1>
      <p>Escolha como deseja iniciar uma simulação comercial (bullet).</p>

      <div style={{ display: "grid", gap: 16, maxWidth: 520 }}>
        <Link href="/simulador/financiamento/nova" style={cardStyle}>
          <strong>Nova simulação</strong>
          <span>Crie uma simulação do zero e salve as entradas iniciais.</span>
        </Link>
        <Link href="/simulador/financiamento/carregar" style={cardStyle}>
          <strong>Carregar simulação</strong>
          <span>Abra uma simulação existente cadastrada anteriormente.</span>
        </Link>
      </div>
    </main>
  );
}
