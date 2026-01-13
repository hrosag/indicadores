"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type IngestAction = "initial" | "current";

export default function AdminDbPage() {
  const router = useRouter();
  const [ibgeOpen, setIbgeOpen] = useState(true);
  const [ipcaOpen, setIpcaOpen] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(false);

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

  const runIngest = async (action: IngestAction) => {
    setMsg(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return router.push("/admin/login");

    if (action === "initial") {
      setLoadingInitial(true);
    } else {
      setLoadingCurrent(true);
    }

    try {
      const r = await fetch("/api/admin/ingest/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dataset: "ibge_ipca_1737",
          action,
        }),
      });

      const p = await r.json().catch(() => null);
      if (!r.ok) return setMsg(p?.error ?? "Falha ao disparar ingest.");

      setMsg(`Ingest enfileirado (job ${p.job_id}).`);
    } catch {
      setMsg("Erro ao conectar com o servidor.");
    } finally {
      setLoadingInitial(false);
      setLoadingCurrent(false);
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
                  onClick={() => runIngest("initial")}
                  disabled={loadingInitial}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingInitial ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingInitial ? "Rodando..." : "Carga inicial (histórico)"}
                </button>

                <button
                  onClick={() => runIngest("current")}
                  disabled={loadingCurrent}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #222",
                    background: loadingCurrent ? "#444" : "#222",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loadingCurrent ? "Rodando..." : "Atualizar mês atual"}
                </button>

                {msg && <div style={{ fontSize: 13, color: "#444" }}>{msg}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
