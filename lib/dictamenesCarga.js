// Carga de PDF IMKK036 (dictámenes FINAT): datos de SIGAF, revisión y guardado.
// La usan la pantalla Dictámenes y la carga única de reportes (/comprobantes).
// Al guardar, iguala el enlace del contrato (dictamen PRINCIPAL de este año) a lo que FINAT asigna al HGZ 2:
// la diferencia queda como renglón "Ajuste para igualar al dictamen FINAT…" en Amp o red (el máximo no se toca).
import { supabase } from "./supabaseClient";
import { leerTodo } from "./paginar";
import { textoPDF, leerIMKK036, resumenUI } from "./imkk036";
import { ANIO, UI_HGZ2 } from "./contratos";

export const NOTA_AJUSTE = "Ajuste para igualar al dictamen FINAT";
const fechaTxt = (f) => (f ? new Date(String(f).slice(0, 10) + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

export async function cargarDatosDictamenes() {
  const [rD, rS, rC, rA, rL] = await Promise.all([
    supabase.from("dictamenes").select("*").order("numero"),
    leerTodo((d, h) => supabase.from("dictamen_saldos").select("dictamen, ui, definitivo, pagos, disponible").order("dictamen").order("ui").order("anio").order("mes").range(d, h)),
    leerTodo((d, h) => supabase.from("contratos").select("id, numero_interno, numero_alterno, concepto, dictamen_numero, monto_maximo, proveedores ( razon_social )").order("numero_interno").range(d, h)),
    leerTodo((d, h) => supabase.from("contrato_ampliaciones").select("id, contrato_id, importe, nota").order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("contrato_dictamenes").select("contrato_id, dictamen, tipo").order("contrato_id").range(d, h)),
  ]);
  const err = [rD, rS, rC, rA].find((r) => r.error);
  if (err) throw new Error(err.error.message + " (¿ya se corrió la migración 049?)");
  const saldos = {}; for (const s of rS.data || []) (saldos[s.dictamen] ||= []).push(s);
  return { dictamenes: rD.data || [], saldos, contratos: rC.data || [], amp: rA.data || [], ligas: rL.error ? [] : rL.data || [] };
}

// Contratos del dictamen: el principal (contratos.dictamen_numero) y los ligados en contrato_dictamenes (p. ej. pasivo)
export const contratosDelDictamen = (datos, num) => (datos?.contratos || [])
  .filter((c) => c.dictamen_numero === num || datos.ligas.some((l) => l.contrato_id === c.id && l.dictamen === num))
  .map((c) => (c.dictamen_numero === num ? c : { ...c, ligaPasivo: true }));
export const enlaceDe = (datos, c) => (Number(c.monto_maximo) || 0) + datos.amp.filter((a) => a.contrato_id === c.id).reduce((s, a) => s + (Number(a.importe) || 0), 0);

// Lee los PDF y dice qué pasará con cada uno (nuevo / se actualiza / más viejo / repetido / error)
export async function revisarDictamenes(files, datos) {
  const leidos = [];
  for (const f of files) {
    try { leidos.push({ archivo: f.name, ...leerIMKK036(await textoPDF(await f.arrayBuffer())) }); }
    catch (e) { leidos.push({ archivo: f.name, ok: false, problema: "No se pudo leer el PDF: " + e.message }); }
  }
  const mejor = {};
  for (const r of leidos.filter((x) => x.ok)) if (!mejor[r.dictamen] || mejor[r.dictamen].ejec < r.ejec) mejor[r.dictamen] = r;
  return leidos.map((r) => {
    if (!r.ok) return { ...r, accion: "error" };
    if (mejor[r.dictamen] !== r) return { ...r, accion: "repetido" };
    const actual = datos.dictamenes.find((d) => d.numero === r.dictamen);
    const cs = contratosDelDictamen(datos, r.dictamen);
    if (actual?.corte && r.corte < actual.corte) return { ...r, accion: "viejo", actual, cs };
    const hgNuevo = resumenUI(r.filas, UI_HGZ2);
    const hgAntes = actual ? resumenUI(datos.saldos[r.dictamen] || [], UI_HGZ2) : null;
    let igualar = null;
    // Solo se iguala el enlace con el dictamen PRINCIPAL del contrato (el de pasivo no cambia el enlace)
    if (cs.length === 1 && !cs[0].ligaPasivo && Number(r.dictamen.slice(-4)) === ANIO) {
      const c = cs[0];
      const ampSin = datos.amp.filter((a) => a.contrato_id === c.id && !String(a.nota || "").startsWith(NOTA_AJUSTE)).reduce((s, a) => s + (Number(a.importe) || 0), 0);
      const maximo = Number(c.monto_maximo) || 0;
      igualar = { contrato: c, maximo, ampSin, enlaceAntes: enlaceDe(datos, c), enlaceNuevo: hgNuevo.asignado, ajuste: maximo ? Math.round((hgNuevo.asignado - maximo - ampSin) * 100) / 100 : 0, nuevoMaximo: maximo ? null : Math.round((hgNuevo.asignado - ampSin) * 100) / 100 };
    }
    return { ...r, accion: actual ? "actualiza" : "nuevo", actual, hgNuevo, hgAntes, cs, igualar };
  });
}

export const aGuardar = (items) => (items || []).filter((r) => r.accion === "nuevo" || r.accion === "actualiza");

// Guarda los dictámenes revisados. Devuelve { n, renglones, igualados }.
export async function guardarDictamenes(items) {
  const lista = aGuardar(items);
  let renglones = 0, igualados = 0;
  for (const r of lista) {
    const { error: e1 } = await supabase.from("dictamenes").upsert({
      numero: r.dictamen, origen: r.origen, fecha_dictamen: r.fecha_dictamen, corte: r.corte, archivo: r.archivo,
      total_definitivo: r.totales.definitivo, total_pagos: r.totales.pagos, total_disponible: r.totales.disponible, actualizado_at: new Date().toISOString(),
    });
    if (e1) throw new Error(`${r.dictamen}: ${e1.message}`);
    const { error: e2 } = await supabase.from("dictamen_saldos").delete().eq("dictamen", r.dictamen);
    if (e2) throw new Error(`${r.dictamen}: ${e2.message}`);
    const { error: e3 } = await supabase.from("dictamen_saldos").insert(r.filas.map((f) => ({ dictamen: r.dictamen, ...f })));
    if (e3) throw new Error(`${r.dictamen}: ${e3.message}`);
    renglones += r.filas.length;
    const g = r.igualar;
    if (g) {
      const { error: e4 } = await supabase.from("contrato_ampliaciones").delete().eq("contrato_id", g.contrato.id).like("nota", `${NOTA_AJUSTE}%`);
      if (e4) throw new Error(`${g.contrato.numero_interno}: ${e4.message}`);
      if (g.nuevoMaximo != null) {
        const { error: e5 } = await supabase.from("contratos").update({ monto_maximo: g.nuevoMaximo }).eq("id", g.contrato.id);
        if (e5) throw new Error(`${g.contrato.numero_interno}: ${e5.message}`);
      } else if (Math.abs(g.ajuste) > 0.5) {
        const { error: e6 } = await supabase.from("contrato_ampliaciones").insert({ contrato_id: g.contrato.id, fecha: r.corte, importe: g.ajuste, nota: `${NOTA_AJUSTE} ${r.dictamen} (IMKK036 al ${fechaTxt(r.corte)})` });
        if (e6) throw new Error(`${g.contrato.numero_interno}: ${e6.message}`);
      }
      igualados++;
    }
  }
  if (lista.length) await supabase.from("cargas_nap").insert({
    archivo: items.map((r) => r.archivo).join(" | "), renglones, comprobantes: lista.length, aplicadas: igualados, confirmadas: 0,
    detalle: { reporte: "IMKK036", dictamenes: lista.map((r) => ({ dictamen: r.dictamen, corte: r.corte, archivo: r.archivo, disponible_hgz2: r.hgNuevo.disponible, ajuste_enlace: r.igualar?.ajuste ?? null })) },
  });
  return { n: lista.length, renglones, igualados };
}
