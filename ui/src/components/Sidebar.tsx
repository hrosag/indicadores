"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [ibgeOpen, setIbgeOpen] = useState(true);
  const [dbOpen, setDbOpen] = useState(true);
  const [dbIbgeOpen, setDbIbgeOpen] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);

  const isIpcaActive = useMemo(() => pathname === "/ibge/ipca", [pathname]);

  const sidebarWidth = collapsed ? 64 : 260;

  const loadAdminStatus = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setIsAdmin(false);
      return;
    }

    const { data } = await supabase
      .from("admin_users")
      .select("is_active")
      .eq("user_id", currentSession.user.id)
      .eq("is_active", true)
      .maybeSingle();

    setIsAdmin(Boolean(data?.is_active));
  };

  useEffect(() => {
    let active = true;

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) {
        return;
      }
      setSession(data.session);
      await loadAdminStatus(data.session);
    };

    initSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }
      setSession(nextSession);
      loadAdminStatus(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const handleIngest = async () => {
    setIngestMessage(null);
    const activeSession = session ?? (await supabase.auth.getSession()).data.session;

    if (!activeSession?.access_token) {
      router.push("/admin/login");
      return;
    }

    setIngestLoading(true);

    try {
      const response = await fetch("/api/admin/ingest/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeSession.access_token}`,
        },
        body: JSON.stringify({
          dataset: "ibge_ipca_1737_monthly",
          params: { from: "2000-01", to: "2025-12" },
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setIngestMessage(payload?.error ?? "Falha ao disparar ingest.");
        return;
      }

      setIngestMessage(`Ingest enfileirado (job ${payload.job_id}).`);
    } catch (error) {
      setIngestMessage("Erro ao conectar com o servidor.");
    } finally {
      setIngestLoading(false);
    }
  };

  return (
    <aside
      style={{
        width: sidebarWidth,
        transition: "width 180ms ease",
        borderRight: "1px solid #eee",
        padding: 12,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700 }}>{collapsed ? "I" : "Indicadores"}</div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={{
            border: "1px solid #ddd",
            background: "#fff",
            borderRadius: 6,
            padding: "6px 8px",
            cursor: "pointer",
          }}
          aria-label="Toggle sidebar"
        >
          ≡
        </button>
      </div>

      <Link
        href="/admin/login"
        style={{
          display: "block",
          borderRadius: 8,
          padding: "10px 10px",
          textDecoration: "none",
          border: "1px solid #eee",
          background: pathname?.startsWith("/admin") ? "#f3f3f3" : "#fff",
          fontWeight: pathname?.startsWith("/admin") ? 700 : 500,
          textAlign: "center",
        }}
      >
        {collapsed ? "AD" : "Admin"}
      </Link>

      <div>
        <button
          onClick={() => setIbgeOpen((v) => !v)}
          style={{
            width: "100%",
            textAlign: "left",
            border: "1px solid #ddd",
            background: "#fff",
            borderRadius: 8,
            padding: "10px 10px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {collapsed ? "IB" : "IBGE"} {collapsed ? "" : ibgeOpen ? "▾" : "▸"}
        </button>

        {ibgeOpen && (
          <div style={{ marginTop: 8, paddingLeft: collapsed ? 0 : 12 }}>
            <Link
              href="/ibge/ipca"
              style={{
                display: "block",
                borderRadius: 8,
                padding: "10px 10px",
                textDecoration: "none",
                border: "1px solid #eee",
                background: isIpcaActive ? "#f3f3f3" : "#fff",
                fontWeight: isIpcaActive ? 700 : 500,
              }}
            >
              {collapsed ? "IP" : "IPCA"}
            </Link>
          </div>
        )}
      </div>

      {isAdmin && (
        <div>
          <button
            onClick={() => setDbOpen((v) => !v)}
            style={{
              width: "100%",
              textAlign: "left",
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: 8,
              padding: "10px 10px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {collapsed ? "BD" : "Banco de Dados"} {collapsed ? "" : dbOpen ? "▾" : "▸"}
          </button>

          {dbOpen && (
            <div style={{ marginTop: 8, paddingLeft: collapsed ? 0 : 12 }}>
              <button
                onClick={() => setDbIbgeOpen((v) => !v)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid #eee",
                  background: "#fff",
                  borderRadius: 8,
                  padding: "10px 10px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {collapsed ? "IB" : "IBGE"} {collapsed ? "" : dbIbgeOpen ? "▾" : "▸"}
              </button>

              {dbIbgeOpen && (
                <div style={{ marginTop: 8, paddingLeft: collapsed ? 0 : 12 }}>
                  <div
                    style={{
                      borderRadius: 8,
                      padding: "10px 10px",
                      border: "1px solid #eee",
                      fontWeight: 600,
                      background: "#fff",
                    }}
                  >
                    {collapsed ? "IP" : "IPCA"}
                  </div>
                  <button
                    onClick={handleIngest}
                    disabled={ingestLoading}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      borderRadius: 8,
                      padding: "10px 10px",
                      border: "1px solid #222",
                      background: ingestLoading ? "#444" : "#222",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {ingestLoading ? "Rodando..." : collapsed ? "In" : "Rodar Ingest"}
                  </button>
                  {ingestMessage && !collapsed && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#444" }}>{ingestMessage}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ fontSize: 12, color: "#666" }}>{collapsed ? "v1" : "v1 — IBGE/SIDRA"}</div>
    </aside>
  );
}
