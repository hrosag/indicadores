"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type IngestAction = "initial" | "current";

export default function AdminDbPage() {
  const router = useRouter();
  const [ibgeOpen, setIbgeOpen] = useState(true);
  const [ipcaOpen, setIpcaOpen] = useState(true);
  const [ipca15Open, setIpca15Open] = useState(true);
  const [inpcOpen, setInpcOpen] = useState(true);
  const [ippOpen, setIppOpen] = useState(true);
  const [pibOpen, setPibOpen] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingInitialIpca, setLoadingInitialIpca] = useState(false);
  const [loadingCurrentIpca, setLoadingCurrentIpca] = useState(false);
  const [loadingInitialIpca15, setLoadingInitialIpca15] = useState(false);
  const [loadingCurrentIpca15, setLoadingCurrentIpca15] = useState(false);
  const [loadingInitialInpc, setLoadingInitialInpc] = useState(false);
  const [loadingCurrentInpc, setLoadingCurrentInpc] = useState(false);
  const [loadingInitialIpp, setLoadingInitialIpp] = useState(false);
  const [loadingCurrentIpp, setLoadingCurrentIpp] = useState(false);
  const [loadingInitialPib, setLoadingInitialPib] = useState(false);
  const [loadingCurrentPib, setLoadingCurrentPib] = useState(false);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      if (!data.session) {
        router.push("/admin/login");
        return;
      }

      const { data: adminData } = await supabase
        .from("admin_users")
        .select("is_active")
        .eq("user_id", data.session.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!alive) return;
      if (!adminData?.is_active) {
        router.push("/admin/login");
      }
    });

    return () => {
      alive = false;
    };
  }, [router]);

  const runIngest = async (
    action: IngestAction,
    dataset: string,
    setLoading: (value: boolean) => void,
  ) => {
    setMsg(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return router.push("/admin/login");

    setLoading(true);

    try {
      const r = await fetch("/api/admin/ingest/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dataset,
          action,
        }),
      });

      const p = await r.json().catch(() => null);
      if (!r.ok) return setMsg(p?.error ?? "Falha ao disparar ingest.");

      setMsg(`Ingest enfileirado (job ${p.job_id}).`);
    } catch {
      setMsg("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Banco de Dados</h1>

      <div style={{ maxWidth: 520, display: "grid", gap: 12 }}>
        <button
          onClick={() => setIbgeOpen((v) => !v)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            textAlign: "left",
            fontWeight: 700,
          }}
        >
          IBGE {ibgeOpen ? "▾" : "▸"}
        </button>

        {ibgeOpen && (
          <div style={{ paddingLeft: 12, display: "grid", gap: 10 }}>
            <button
              onClick={() => setIpcaOpen((v) => !v)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #eee",
                background: "#fff",
                textAlign: "left",
                fontWeight: 700,
              }}
            >
              IPCA {ipcaOpen ? "▾" : "▸"}
            </button>

            {ipcaOpen && (
              <div style={{ paddingLeft: 12, display: "grid", gap: 10 }}>
                <button
                  onClick={() =>
                    runIngest(
                      "initial",
                      "ibge_ipca_1737",
                      setLoadingInitialIpca,
                    )
                  }
                  disabled={loadingInitialIpca}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingInitialIpca ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingInitialIpca
                    ? "Rodando..."
                    : "Carga inicial (histórico)"}
                </button>

                <button
                  onClick={() =>
                    runIngest(
                      "current",
                      "ibge_ipca_1737",
                      setLoadingCurrentIpca,
                    )
                  }
                  disabled={loadingCurrentIpca}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingCurrentIpca ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingCurrentIpca ? "Rodando..." : "Atualizar mês atual"}
                </button>
              </div>
            )}

            <button
              onClick={() => setIpca15Open((v) => !v)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #eee",
                background: "#fff",
                textAlign: "left",
                fontWeight: 700,
              }}
            >
              IPCA-15 {ipca15Open ? "▾" : "▸"}
            </button>

            {ipca15Open && (
              <div style={{ paddingLeft: 12, display: "grid", gap: 10 }}>
                <button
                  onClick={() =>
                    runIngest(
                      "initial",
                      "ibge_ipca15_3065",
                      setLoadingInitialIpca15,
                    )
                  }
                  disabled={loadingInitialIpca15}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingInitialIpca15 ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingInitialIpca15
                    ? "Rodando..."
                    : "Carga inicial (histórico)"}
                </button>

                <button
                  onClick={() =>
                    runIngest(
                      "current",
                      "ibge_ipca15_3065",
                      setLoadingCurrentIpca15,
                    )
                  }
                  disabled={loadingCurrentIpca15}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingCurrentIpca15 ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingCurrentIpca15 ? "Rodando..." : "Atualizar mês atual"}
                </button>
              </div>
            )}

            <button
              onClick={() => setInpcOpen((v) => !v)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #eee",
                background: "#fff",
                textAlign: "left",
                fontWeight: 700,
              }}
            >
              INPC {inpcOpen ? "▾" : "▸"}
            </button>

            {inpcOpen && (
              <div style={{ paddingLeft: 12, display: "grid", gap: 10 }}>
                <button
                  onClick={() =>
                    runIngest(
                      "initial",
                      "ibge_inpc_1736",
                      setLoadingInitialInpc,
                    )
                  }
                  disabled={loadingInitialInpc}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingInitialInpc ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingInitialInpc
                    ? "Rodando..."
                    : "Carga inicial (histórico)"}
                </button>

                <button
                  onClick={() =>
                    runIngest(
                      "current",
                      "ibge_inpc_1736",
                      setLoadingCurrentInpc,
                    )
                  }
                  disabled={loadingCurrentInpc}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingCurrentInpc ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingCurrentInpc ? "Rodando..." : "Atualizar mês atual"}
                </button>
              </div>
            )}

            <button
              onClick={() => setIppOpen((v) => !v)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #eee",
                background: "#fff",
                textAlign: "left",
                fontWeight: 700,
              }}
            >
              IPP {ippOpen ? "▾" : "▸"}
            </button>

            {ippOpen && (
              <div style={{ paddingLeft: 12, display: "grid", gap: 10 }}>
                <button
                  onClick={() =>
                    runIngest(
                      "initial",
                      "ibge_ipp_6904",
                      setLoadingInitialIpp,
                    )
                  }
                  disabled={loadingInitialIpp}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingInitialIpp ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingInitialIpp ? "Rodando..." : "Carga inicial (histórico)"}
                </button>

                <button
                  onClick={() =>
                    runIngest(
                      "current",
                      "ibge_ipp_6904",
                      setLoadingCurrentIpp,
                    )
                  }
                  disabled={loadingCurrentIpp}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingCurrentIpp ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingCurrentIpp ? "Rodando..." : "Atualizar mês atual"}
                </button>
              </div>
            )}

            <button
              onClick={() => setPibOpen((v) => !v)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #eee",
                background: "#fff",
                textAlign: "left",
                fontWeight: 700,
              }}
            >
              PIB {pibOpen ? "▾" : "▸"}
            </button>

            {pibOpen && (
              <div style={{ paddingLeft: 12, display: "grid", gap: 10 }}>
                <button
                  onClick={() =>
                    runIngest(
                      "initial",
                      "ibge_pib_5932",
                      setLoadingInitialPib,
                    )
                  }
                  disabled={loadingInitialPib}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingInitialPib ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingInitialPib ? "Rodando..." : "Carga inicial (histórico)"}
                </button>

                <button
                  onClick={() =>
                    runIngest(
                      "current",
                      "ibge_pib_5932",
                      setLoadingCurrentPib,
                    )
                  }
                  disabled={loadingCurrentPib}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingCurrentPib ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingCurrentPib ? "Rodando..." : "Atualizar trimestre atual"}
                </button>
              </div>
            )}

            {msg && <div style={{ fontSize: 13, color: "#444" }}>{msg}</div>}
          </div>
        )}
      </div>
    </main>
  );
}
