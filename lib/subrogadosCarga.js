// Fase B · Guardar folios de subrogados y ligarlos a facturas (30/10/2026).
import { supabase } from "./supabaseClient";
import { leerTodo } from "./paginar";
import { claveContrato, PEDIDO_A_SAI } from "./subrogadosComun";

const soloAlnum = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Estatus de un folio: facturado (ligado o con número de factura del Excel) · cancelado · devengo
export const estatusFolio = (f) => (f.factura_id || f.factura_txt ? "facturado" : f.cancelado ? "cancelado" : "devengo");

export async function cargarDatosFolios() {
  const [rC, rF, rS] = await Promise.all([
    leerTodo((d, h) => supabase.from("contratos").select("id, numero_interno, numero_alterno").order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("facturas").select("id, contrato_id, folio_ingreso, folio_proveedor, importe_factura").eq("anulada", false).order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("subrogados_folios").select("clave, factura_id, factura_txt, cancelado").order("clave").range(d, h)),
  ]);
  const err = [rC, rF].find((r) => r.error); if (err) throw new Error(err.error.message);
  if (rS.error) throw new Error(rS.error.message + " (¿ya se corrió la migración 053?)");
  return { contratos: rC.data || [], facturas: rF.data || [], existentes: new Map((rS.data || []).map((x) => [x.clave, x])) };
}

// Contrato de SIGAF para el texto del archivo (S6M0047, N12225025 o 050GYR032N12225-025-00)
function mapaContratos(contratos) {
  const m = new Map();
  for (const c of contratos) { m.set(claveContrato(c.numero_interno), c.id); if (c.numero_alterno) m.set(claveContrato(c.numero_alterno), c.id); }
  return (txt) => {
    const k = claveContrato(txt); if (!k) return null;
    if (m.has(k)) return m.get(k);
    const sai = PEDIDO_A_SAI[Object.keys(PEDIDO_A_SAI).find((p) => claveContrato(p) === k)];
    return sai ? m.get(claveContrato(sai)) || null : null;
  };
}

// Factura de SIGAF de ese contrato con ese número (exacto; si no, termina igual y es la única)
function buscadorFacturas(facturas) {
  const por = {}; for (const f of facturas) if (f.contrato_id) (por[f.contrato_id] ||= []).push(f);
  return (contratoId, txt) => {
    const k = soloAlnum(txt); if (!k || !contratoId) return null;
    const fs = por[contratoId] || [];
    const exactas = fs.filter((f) => soloAlnum(f.folio_proveedor) === k); if (exactas.length === 1) return exactas[0];
    const fin = fs.filter((f) => { const p = soloAlnum(f.folio_proveedor); return p.endsWith(k) || k.endsWith(p); });
    return fin.length === 1 ? fin[0] : null;
  };
}

// Prepara lo que se va a guardar y el resumen para la revisión
export function prepararFolios(filas, datos) {
  const contratoDe = mapaContratos(datos.contratos), facturaDe = buscadorFacturas(datos.facturas);
  const items = [], sinContrato = new Set(), facturasNoEncontradas = {};
  let nuevos = 0, actualizados = 0, ligadas = 0;
  for (const f of filas) {
    const contrato_id = contratoDe(f.contrato_txt);
    if (!contrato_id) sinContrato.add(f.contrato_txt);
    const it = { ...f, contrato_id }; delete it.hoja_;
    const prev = datos.existentes.get(f.clave);
    if (prev) actualizados++; else nuevos++;
    if (f.factura_txt) {
      const fac = facturaDe(contrato_id, f.factura_txt);
      if (fac) { it.factura_id = fac.id; ligadas++; }
      else { const k = `${f.contrato_txt} · factura ${f.factura_txt}`; facturasNoEncontradas[k] = r2((facturasNoEncontradas[k] || 0) + f.importe); }
    }
    items.push(it);
  }
  // Devengo por contrato de SIGAF (S6M0047 y su pedido 050GYR… son el mismo)
  const nombre = new Map(datos.contratos.map((c) => [c.id, c.numero_interno]));
  const devengo = {};
  for (const it of items) if (estatusFolio({ ...it, factura_id: it.factura_id || datos.existentes.get(it.clave)?.factura_id }) === "devengo") {
    const k = it.contrato_id ? nombre.get(it.contrato_id) : it.contrato_txt;
    devengo[k] = r2((devengo[k] || 0) + it.importe);
  }
  return { items, nuevos, actualizados, ligadas, sinContrato: [...sinContrato], facturasNoEncontradas, devengo };
}

// Guarda en lotes. Solo manda las columnas que trae cada renglón: así una liga hecha a mano no se borra
// cuando se vuelve a subir el CD_SMS (que no trae factura).
export async function guardarFolios(items, onAvance = () => {}) {
  const grupos = {};
  for (const it of items) {
    const fila = { ...it, actualizado_at: new Date().toISOString() };
    for (const k of Object.keys(fila)) if (fila[k] === undefined) delete fila[k];
    const forma = Object.keys(fila).sort().join(",");
    (grupos[forma] ||= []).push(fila);
  }
  let hechos = 0;
  for (const lista of Object.values(grupos)) {
    for (let i = 0; i < lista.length; i += 500) {
      const { error } = await supabase.from("subrogados_folios").upsert(lista.slice(i, i + 500), { onConflict: "clave" });
      if (error) throw new Error("Folios de subrogados: " + error.message);
      hechos += Math.min(500, lista.length - i); onAvance(`Guardando folios de subrogados… ${hechos} de ${items.length}`);
    }
  }
  return hechos;
}

// ---------- Uso desde la factura (captura y detalle) ----------
export async function foliosDelContrato(contratoId) {
  if (!contratoId) return [];
  const r = await leerTodo((d, h) => supabase.from("subrogados_folios")
    .select("clave, folio, fecha, anio, mes, paciente, estudio, cantidad, importe, cancelado, factura_id, factura_txt, origen")
    .eq("contrato_id", contratoId).order("fecha").order("folio").range(d, h));
  return r.error ? [] : r.data || [];
}
export async function ligarFolios(claves, facturaId) {
  if (!claves.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  for (let i = 0; i < claves.length; i += 200) {
    const { error } = await supabase.from("subrogados_folios").update({ factura_id: facturaId, ligado_por: user?.id || null, ligado_at: new Date().toISOString() }).in("clave", claves.slice(i, i + 200));
    if (error) throw new Error("No se pudieron ligar los folios: " + error.message);
  }
}
export async function desligarFolios(claves) {
  if (!claves.length) return;
  for (let i = 0; i < claves.length; i += 200) {
    const { error } = await supabase.from("subrogados_folios").update({ factura_id: null, factura_txt: null, ligado_por: null, ligado_at: null }).in("clave", claves.slice(i, i + 200));
    if (error) throw new Error("No se pudieron quitar los folios: " + error.message);
  }
}
