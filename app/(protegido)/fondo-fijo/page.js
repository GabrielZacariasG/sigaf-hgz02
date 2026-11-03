"use client";
// Fondo fijo del hospital: pliegos, otras cuentas, reembolsos a OOAD, resumen, proyección y banco.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { leerTodo } from "../../../lib/fondoFijo";
import { pestana, tarjeta } from "./comun";
import Pliegos from "./Pliegos";
import OtrosGastos from "./OtrosGastos";
import Reembolsos from "./Reembolsos";
import Enviados from "./Enviados";
import Resumen from "./Resumen";
import Banco from "./Banco";
import Carga from "./Carga";

export default function FondoFijo() {
  const [vista, setVista] = useState("pliegos");
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const recargar = useCallback(async () => {
    try {
      const [gastos, precarga, comisionados, reembolsos] = await Promise.all([
        leerTodo(() => supabase.from("ff_gastos").select("*").order("fecha", { ascending: false, nullsFirst: false }).order("id")),
        leerTodo(() => supabase.from("ff_precarga").select("*").order("clave")),
        leerTodo(() => supabase.from("ff_comisionados").select("*").order("nombre")),
        leerTodo(() => supabase.from("ff_reembolsos").select("*").order("created_at").order("id")),
      ]);
      setD({ gastos, precarga, comisionados, reembolsos });
      setError("");
    } catch (e) {
      setError(/ff_|relation|schema cache/i.test(e.message || "") ? "Falta correr la migración 059_fondo_fijo.sql en Supabase." : e.message);
    }
  }, []);
  useEffect(() => { recargar(); }, [recargar]);

  if (error) return <div style={{ ...tarjeta, color: "var(--rojo)" }}>{error}</div>;
  if (!d) return <p>Cargando fondo fijo…</p>;
  const porLlegar = d.precarga.filter((p) => !p.gasto_id).length;
  const porReembolsar = d.gastos.filter((g) => !g.reembolso_id && !g.anulado).length;
  const TABS = [["pliegos", `Pliegos${porLlegar ? ` (${porLlegar} por llegar)` : ""}`], ["otros", "Otras cuentas"], ["reembolso", `Armar reembolso (${porReembolsar})`], ["enviados", "Enviados a OOAD"], ["resumen", "Resumen y proyección"], ["banco", "Banco y arqueo"], ["carga", "Carga y plantilla"]];
  const comun = { ...d, recargar };
  return (
    <div>
      <h1 className="no-print" style={{ fontSize: 22, margin: 0 }}>Fondo fijo</h1>
      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        {TABS.map(([k, t]) => <button key={k} style={pestana(vista === k)} onClick={() => setVista(k)}>{t}</button>)}
      </div>
      {vista === "pliegos" && <Pliegos {...comun} />}
      {vista === "otros" && <OtrosGastos {...comun} />}
      {vista === "reembolso" && <Reembolsos {...comun} />}
      {vista === "enviados" && <Enviados {...comun} />}
      {vista === "resumen" && <Resumen {...comun} />}
      {vista === "banco" && <Banco {...comun} />}
      {vista === "carga" && <Carga {...comun} />}
    </div>
  );
}
