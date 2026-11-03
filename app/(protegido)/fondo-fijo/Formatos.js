"use client";
// Oficio y Relación de Gastos, listos para imprimir. Los firmantes salen de SIGAF.
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import OficioReembolso from "../../../lib/OficioReembolso";
import RelacionGastos from "../../../lib/RelacionGastos";

export default function Formatos({ reembolso, folio, acciones }) {
  const [firmante, setFirmante] = useState(null);
  useEffect(() => {
    supabase.from("administradores").select("nombre, cargo").ilike("cargo", "%subdirector%adm%").eq("activo", true).limit(1).then(({ data }) => { if (data?.length) setFirmante(data[0]); });
  }, []);
  const conFirma = firmante ? { ...reembolso, firma2: firmante.nombre, cargoFirma2: firmante.cargo } : reembolso;
  return (
    <div>
      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>{acciones}</div>
      <div className="hoja-formatos"><OficioReembolso reembolso={reembolso} folio={folio} {...(firmante ? { firmante } : {})} /><RelacionGastos reembolso={conFirma} /></div>
      <style>{`@media print { body * { visibility: hidden !important; } .hoja-formatos, .hoja-formatos * { visibility: visible !important; } .hoja-formatos { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
    </div>
  );
}
