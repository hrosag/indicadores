"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [ibgeOpen, setIbgeOpen] = useState(true);

  const isIpcaActive = useMemo(() => pathname === "/ibge/ipca", [pathname]);

  const sidebarWidth = collapsed ? 64 : 260;

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

      <div style={{ flex: 1 }} />

      <div style={{ fontSize: 12, color: "#666" }}>{collapsed ? "v1" : "v1 — IBGE/SIDRA"}</div>
    </aside>
  );
}
