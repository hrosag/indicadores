"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  ano: number;
  mes: string;
  data: string; // "YYYY-MM"
  num_indice: number | null;
  var_m: number | null;
  var_3_m: number | null;
  var_6_m: number | null;
  var_ano: number | null;
  var_12_m: number | null;
};

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("vw_ipca_1737_monthly")
        .select("ano,mes,data,num_indice,var_m,var_3_m,var_6_m,var_ano,var_12_m")
        .order("data", { ascending: false })
        .limit(24);

      if (error) setError(error.message);
      else setRows((data ?? []) as Row[]);

      setLoading(false);
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Indicadores — IPCA (IBGE/SIDRA)</h1>

      {loading && <p>Carregando…</p>}
      {error && (
        <pre style={{ whiteSpace: "pre-wrap", color: "crimson" }}>
          {error}
        </pre>
      )}

      {!loading && !error && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
            <tr>
              <th>data</th>
              <th>num_indice</th>
              <th>var_m</th>
              <th>var_3_m</th>
              <th>var_6_m</th>
              <th>var_ano</th>
              <th>var_12_m</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.data}>
                <td>{r.data}</td>
                <td>{r.num_indice ?? ""}</td>
                <td>{r.var_m ?? ""}</td>
                <td>{r.var_3_m ?? ""}</td>
                <td>{r.var_6_m ?? ""}</td>
                <td>{r.var_ano ?? ""}</td>
                <td>{r.var_12_m ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
