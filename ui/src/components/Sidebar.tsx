"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import useIsAdmin from "../lib/useIsAdmin";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [ibgeOpen, setIbgeOpen] = useState(true);
  const { isAdmin } = useIsAdmin();

  const isIpcaActive = useMemo(() => pathname === "/ibge/ipca", [pathname]);
  const isIpca15Active = useMemo(() => pathname === "/ibge/ipca15", [pathname]);
  const isInpcActive = useMemo(() => pathname === "/ibge/inpc", [pathname]);
  const isIppActive = useMemo(() => pathname === "/ibge/ipp", [pathname]);
  const isPibActive = useMemo(() => pathname === "/ibge/pib", [pathname]);

  const sidebarWidth = collapsed ? 64 : 260;
  const adminHref = isAdmin ? "/admin/db" : "/admin/login";

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
        href={adminHref}
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
            <Link
              href="/ibge/ipca15"
              style={{
                display: "block",
                borderRadius: 8,
                padding: "10px 10px",
                textDecoration: "none",
                border: "1px solid #eee",
                background: isIpca15Active ? "#f3f3f3" : "#fff",
                fontWeight: isIpca15Active ? 700 : 500,
              }}
            >
              {collapsed ? "I15" : "IPCA-15"}
            </Link>
            <Link
              href="/ibge/inpc"
              style={{
                display: "block",
                borderRadius: 8,
                padding: "10px 10px",
                textDecoration: "none",
                border: "1px solid #eee",
                background: isInpcActive ? "#f3f3f3" : "#fff",
                fontWeight: isInpcActive ? 700 : 500,
              }}
            >
              {collapsed ? "IN" : "INPC"}
            </Link>
            <Link
              href="/ibge/ipp"
              style={{
                display: "block",
                borderRadius: 8,
                padding: "10px 10px",
                textDecoration: "none",
                border: "1px solid #eee",
                background: isIppActive ? "#f3f3f3" : "#fff",
                fontWeight: isIppActive ? 700 : 500,
              }}
            >
              {collapsed ? "IPP" : "IPP"}
            </Link>
            <Link
              href="/ibge/pib"
              style={{
                display: "block",
                borderRadius: 8,
                padding: "10px 10px",
                textDecoration: "none",
                border: "1px solid #eee",
                background: isPibActive ? "#f3f3f3" : "#fff",
                fontWeight: isPibActive ? 700 : 500,
              }}
            >
              {collapsed ? "PIB" : "PIB"}
            </Link>
          </div>
        )}
      </div>

      {isAdmin && (
        <Link
          href="/admin/db"
          style={{
            display: "block",
            borderRadius: 8,
            padding: "10px 10px",
            textDecoration: "none",
            border: "1px solid #eee",
            background: pathname?.startsWith("/admin/db") ? "#f3f3f3" : "#fff",
            fontWeight: pathname?.startsWith("/admin/db") ? 700 : 600,
            textAlign: "left",
          }}
        >
          {collapsed ? "BD" : "Banco de Dados"}
        </Link>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ fontSize: 12, color: "#666" }}>{collapsed ? "v1" : "v1 — IBGE/SIDRA"}</div>
    </aside>
  );
}
