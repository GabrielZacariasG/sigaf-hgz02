"use client";

// Bandeja de avisos (30/10/2026): lo que hay que hacer hoy, armado con los datos que ya tiene SIGAF
// (facturas, firmas, pedido-recepción, CR del 1043 y saldos de dictamen del IMKK036). Solo consulta.
import { useEffect, useState } from "react";
import Link from "next/link";
import { cargarAvisos } from "../../../lib/avisos";
import ArmarOficio from "../../../lib/ArmarOficio";
import { LABEL_GENERAL, LABEL_FIRMAS, LABEL_PEDIDO, generaPedidoRecepcion, puedeEnviarOoad, periodoTxt, pasivosPrimero } from "../../../lib/estatus";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const COLOR = { verde: ["#e6f4ea", "#1e7a3c"], ambar: ["#fef3c7", "#92400e"], rojo: ["#fee2e2", "#b91c1c"], validada: ["#e0ecff", "#1d4ed8"], gris: ["#f1f1f1", "#555"] };

function Semaforo({ s }) {
  if (!s) return <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>Sin contrato</span>;
  const [bg, fg] = COLOR[s.nivel] || COLOR.gris;
  return <span title={s.dictamen ? `Dictamen ${s.dictamen}` : ""} style={{ display: "inline-block", fontSize: 12, padding: "2px 8px", borderRadius: 99, background: bg, color: fg, fontWeight: 600 }}>{s.t}</span>;
}

const suma = (items) => items.reduce((t, x) => t + (Number(x.f.importe_factura) || 0), 0);
function agrupar(items, clave) {
  const m = new Map();
  for (const x of items) { const k = clave(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return [...m.entries()].sort((a, b) => suma(b[1]) - suma(a[1]));
}
// Firmas y pedido-recepción que le faltan para poder ir a OOAD
function pendienteDe(f) {
  const cap = f.capitulos?.nombre || "";
  const llevaPR = generaPedidoRecepcion(cap, f.partidas?.cuenta_finat || f.partidas?.cuenta_prei);
  if (["en_tramite_ooad", "enviada_ooad"].includes(f.estatus_general)) return (LABEL_GENERAL[f.estatus_general] || f.estatus_general) + (llevaPR && f.estatus_pedido_recepcion !== "generado" && !f.cr_contrarecibo ? " · sin pedido-recepción" : "");
  const firmasOk = puedeEnviarOoad(f.estatus_firmas, "generado", cap);
  const prOk = !llevaPR || f.estatus_pedido_recepcion === "generado";
  if (firmasOk && prOk) return "Firmas y pedido-recepción completos";
  return [!firmasOk && `Firmas: ${LABEL_FIRMAS[f.estatus_firmas] || f.estatus_firmas}`, !prOk && "Falta pedido-recepción"].filter(Boolean).join(" · ");
}

export default function AvisosPage() {
  const [a, setA] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { cargarAvisos().then(setA).catch((e) => setError("No se pudieron cargar los avisos: " + e.message)); }, []);

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "12px 14px", marginTop: 14 };
  const th = { textAlign: "left", fontSize: 12, padding: "6px 8px", borderBottom: "1px solid var(--borde)", color: "var(--texto-suave)", whiteSpace: "nowrap" };
  const td = { fontSize: 13, padding: "6px 8px", borderBottom: "1px solid var(--borde)", verticalAlign: "top" };
  const tdN = { ...td, textAlign: "right", whiteSpace: "nowrap" };
  const LinkF = ({ f }) => <Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)", fontWeight: 600 }}>{f.folio_ingreso}</Link>;
  const Titulo = ({ id, color, n, t, sub }) => (
    <div id={id} style={{ display: "flex", alignItems: "baseline", gap: 10, borderLeft: `5px solid ${color}`, paddingLeft: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 22, fontWeight: 700 }}>{n}</span><strong>{t}</strong>{sub && <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{sub}</span>}
    </div>
  );

  // Tabla de facturas de una lista de presupuesto; "extra" es la última columna (lo que falta o el apoyo)
  const TablaFacturas = ({ items, extra, tituloExtra }) => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{["Factura", "Proveedor", "Contrato", "Periodo", "Importe", "Dónde va", "CR", tituloExtra].filter(Boolean).map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>{pasivosPrimero(items, (x) => x.f).map(({ f, s }) => (
        <tr key={f.id}>
          <td style={td}><LinkF f={f} /><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}</div></td>
          <td style={td}>{f.proveedores?.razon_social}</td>
          <td style={td}>{s.contrato?.numero_interno}</td>
          <td style={{ ...td, fontSize: 12.5 }}>{periodoTxt(f)}{f.es_pasivo && <div style={{ fontWeight: 700 }}>PASIVO</div>}</td>
          <td style={tdN}>{money(f.importe_factura)}</td>
          <td style={td}>{pendienteDe(f)}</td>
          <td style={td}>{f.cr_contrarecibo || "—"}{s.error && <div style={{ color: "var(--rojo)", fontWeight: 600, fontSize: 12 }}>error de presupuesto</div>}</td>
          {tituloExtra && <td style={{ ...td, fontSize: 12.5 }}>{extra({ f, s })}</td>}
        </tr>
      ))}</tbody>
    </table>
  );
  const Grupo = ({ titulo, sub, children, abierto }) => (
    <details open={abierto} style={{ borderTop: "1px solid var(--borde)", padding: "8px 0" }}>
      <summary style={{ cursor: "pointer", fontSize: 13.5 }}><strong>{titulo}</strong>{sub && <span style={{ color: "var(--texto-suave)" }}> · {sub}</span>}</summary>
      <div style={{ marginTop: 6 }}>{children}</div>
    </details>
  );

  if (error) return <p style={{ color: "var(--rojo)" }}>{error}</p>;
  if (!a) return <p>Armando la bandeja de avisos…</p>;

  const P = a.presupuesto;
  const paraOficio = a.resumen.filter((r) => ["oficio", "ampliacion"].includes(r.accion));
  const gestionDic = P.gestion.filter((x) => x.s.dictamen), gestionCta = P.gestion.filter((x) => !x.s.dictamen);
  const totalApoyo = (items) => { const m = {}; for (const { s } of items) for (const [ui, v] of s.apoyo || []) m[ui] = (m[ui] || 0) + v; return Object.entries(m); };
  const CUADROS = [
    ["#p-presupuesto", "var(--verde)", P.presupuesto, "Tienen presupuesto", "se pueden trabajar"],
    ["#p-oficio", "#d69e2e", P.oficio, "Con oficio de apoyo", "mandar la propuesta"],
    ["#p-gestion", "var(--rojo)", P.gestion, "No van a pasar", "requieren otra gestión"],
    ["#p-aclarar", "#718096", P.aclarar, "Por aclarar", "FINAT trae pagos de más"],
    [null, "#2b6cb0", P.validada, "Ya validadas en FINAT", "no requieren nada"],
  ];

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Bandeja de avisos</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 950, margin: "4px 0 0" }}>
        Qué hacer hoy con lo que ya sabe SIGAF: facturas listas para OOAD, pedido-recepción recibido, y si el dictamen del contrato alcanza
        (con los saldos del IMKK036 cargados en <Link href="/dictamenes" style={{ color: "var(--verde)" }}>Dictámenes</Link> y los CR del 1043 en <Link href="/comprobantes" style={{ color: "var(--verde)" }}>Comprobantes</Link>).
      </p>

      {/* Presupuesto por factura */}
      <div style={card}>
        <strong style={{ fontSize: 15 }}>¿Qué facturas tienen dinero?</strong>
        <p style={{ fontSize: 12.5, color: "var(--texto-suave)", margin: "2px 0 10px" }}>
          Facturas sin pagar. Con dictamen se mide el disponible acumulado del HGZ 2 y de otras unidades (IMKK036); compra emergente y PREI, la dispo de {a.mes} de su cuenta{a.dispoFecha ? ` (corte ${new Date(a.dispoFecha + "T00:00:00").toLocaleDateString("es-MX")})` : ""}. En cada dictamen se sugiere la combinación de facturas completas que más aprovecha el dinero; abajo la puedes cambiar.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CUADROS.map(([href, color, items, t, sub]) => {
            const dentro = <><div style={{ fontSize: 20, fontWeight: 700 }}>{items.length}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 13 }}>{money(suma(items))}</div><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{sub}</div></>;
            const estilo = { flex: "1 1 170px", borderLeft: `5px solid ${color}`, border: "1px solid var(--borde)", borderLeftWidth: 5, borderLeftColor: color, borderRadius: 8, padding: "8px 10px", color: "inherit", textDecoration: "none" };
            return href ? <a key={t} href={href} style={estilo}>{dentro}</a> : <div key={t} style={estilo}>{dentro}</div>;
          })}
        </div>
        {P.sindato.length > 0 && <p style={{ fontSize: 13, margin: "8px 0 0", padding: "6px 10px", background: "#fef3c7", borderRadius: 8, color: "#92400e" }}>{P.sindato.length} factura(s) sin dato para decidir: {[...new Set(P.sindato.map((x) => x.s.t))].join(" · ")}</p>}
      </div>

      <div style={card}>
        <Titulo id="p-presupuesto" color="var(--verde)" n={P.presupuesto.length} t="Tienen presupuesto" sub={money(suma(P.presupuesto))} />
        {/* Resumido por contrato (las de pasivo primero); al abrir se ven sus facturas */}
        {agrupar(P.presupuesto, (x) => x.s.contrato?.numero_interno).sort(([, a], [, b]) => b.some((x) => x.f.es_pasivo) - a.some((x) => x.f.es_pasivo)).map(([k, items]) => {
          const pas = items.filter((x) => x.f.es_pasivo).length, enOoad = items.filter((x) => ["en_tramite_ooad", "enviada_ooad"].includes(x.f.estatus_general)).length;
          return (
            <Grupo key={k} titulo={`${k} · ${items[0].f.proveedores?.razon_social || ""}`} sub={`${items.length} factura(s) · ${money(suma(items))}${enOoad ? ` · ${enOoad} en OOAD` : ""}${items.length > enOoad ? ` · ${items.length - enOoad} por firmas o pedido-recepción` : ""}${pas ? ` · ${pas} de pasivo` : ""}`}>
              <TablaFacturas items={items.slice().sort((x, y) => Number(y.f.importe_factura) - Number(x.f.importe_factura))} tituloExtra="Con qué" extra={({ s }) => s.t} />
            </Grupo>
          );
        })}
        {!P.presupuesto.length && <p style={{ fontSize: 13, margin: 0 }}>Ninguna factura tiene dinero completo.</p>}
      </div>

      <div style={card}>
        <Titulo id="p-oficio" color="#d69e2e" n={P.oficio.length} t="Proceden con oficio de apoyo" sub={`${money(suma(P.oficio))} · apoyo a pedir: ${totalApoyo(P.oficio).map(([ui, v]) => `UI ${ui} ${money(v)}`).join(", ") || "—"}`} />
        <p style={{ fontSize: 12.5, color: "var(--texto-suave)", margin: "0 0 4px" }}>Lista completa de cada contrato donde no alcanza, incluidas las facturas en el servicio o en firmas. Ya vienen marcadas las que más aprovechan el dinero; cambia las casillas si prefieres mandar otras. Nada se guarda: solo cambia el oficio que generas.</p>
        {paraOficio.length ? paraOficio.map((r) => (
          <ArmarOficio key={r.contrato.id + "|" + r.dictamen} r={r} ppto={(f) => (f.cr_contrarecibo && a.ppto[f.cr_contrarecibo]) || null} dondeVa={pendienteDe} />
        )) : <p style={{ fontSize: 13, margin: 0 }}>Ninguna factura necesita oficio de apoyo.</p>}
      </div>

      <div style={card}>
        <Titulo id="p-gestion" color="var(--rojo)" n={P.gestion.length} t="No van a pasar: requieren otra gestión" sub={money(suma(P.gestion))} />
        {gestionDic.length > 0 && <div style={{ fontWeight: 600, fontSize: 13.5, margin: "8px 0 4px" }}>Con dictamen sin saldo suficiente: ampliación ({gestionDic.length} · {money(suma(gestionDic))})</div>}
        {agrupar(gestionDic, (x) => `${x.s.contrato?.numero_interno}|${x.s.dictamen}`).map(([k, items]) => (
          <Grupo key={k} titulo={`${items[0].s.contrato?.numero_interno} · ${items[0].s.contrato?.proveedores?.razon_social || ""}`} sub={`dictamen ${items[0].s.dictamen} · ${items.length} factura(s) · ${money(suma(items))}`}>
            <TablaFacturas items={items} tituloExtra="Faltan" extra={({ s }) => money(s.falta)} />
          </Grupo>
        ))}
        {gestionCta.length > 0 && <div style={{ fontWeight: 600, fontSize: 13.5, margin: "12px 0 4px" }}>Sin dictamen y la cuenta no alcanza en {a.mes}: gestionar presupuesto ({gestionCta.length} · {money(suma(gestionCta))})</div>}
        {agrupar(gestionCta, (x) => x.s.cuenta).map(([cuenta, items]) => (
          <Grupo key={cuenta} titulo={`Cuenta ${cuenta}`} sub={`${items.length} factura(s) · ${money(suma(items))}`}>
            <TablaFacturas items={items} tituloExtra="Dispo que quedaba" extra={({ s }) => <>{money(s.dispoCuenta)}{s.centro ? <div style={{ color: "var(--texto-suave)" }}>CC {s.centro}</div> : null}</>} />
          </Grupo>
        ))}
        {!P.gestion.length && <p style={{ fontSize: 13, margin: 0 }}>Ninguna factura se queda sin camino.</p>}
      </div>

      {P.aclarar.length > 0 && (
        <div style={card}>
          <Titulo id="p-aclarar" color="#718096" n={P.aclarar.length} t="Por aclarar" sub="FINAT trae pagos en el dictamen que SIGAF no tiene como pagados: revisar si estas ya se pagaron" />
          <TablaFacturas items={P.aclarar} />
        </div>
      )}

      {/* En OOAD sin pedido-recepción */}
      {a.ooadSinPR.length > 0 && (
        <div style={card}>
          <Titulo id="sin-pr" color="var(--rojo)" n={a.ooadSinPR.length} t="Ya están en OOAD sin pedido-recepción" sub={`${money(a.ooadSinPR.reduce((t, f) => t + (Number(f.importe_factura) || 0), 0))} · salieron antes del candado; desde entonces SIGAF no deja hacer oficio de pago sin él`} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Factura", "Proveedor", "Periodo", "Importe", "Firmas", "Pedido-recepción"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{pasivosPrimero(a.ooadSinPR).map((f) => (
              <tr key={f.id}><td style={td}><LinkF f={f} /><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}</div></td><td style={td}>{f.proveedores?.razon_social}</td><td style={{ ...td, fontSize: 12.5 }}>{periodoTxt(f)}</td><td style={tdN}>{money(f.importe_factura)}</td><td style={td}>{LABEL_FIRMAS[f.estatus_firmas] || f.estatus_firmas}</td><td style={{ ...td, color: "var(--rojo)", fontWeight: 600 }}>{LABEL_PEDIDO[f.estatus_pedido_recepcion] || f.estatus_pedido_recepcion}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Corte de folios de subrogados sin facturar */}
      <div style={card}>
        <Titulo id="folios" color="#7c3aed" n={a.folios.n} t="Folios de subrogados sin facturar" sub={`${money(a.folios.importe)} en devengo${a.folios.ultimaCarga ? ` · última carga hace ${a.folios.diasCarga} día(s)` : ""}`} />
        {a.folios.tocaCorte && <p style={{ fontSize: 13, margin: "0 0 8px", padding: "6px 10px", background: "#fef3c7", borderRadius: 8, color: "#92400e" }}>Ya toca corte: baja el reporte de CD_SMS y súbelo en <Link href="/comprobantes" style={{ fontWeight: 600 }}>Cargar reportes</Link> (cada 1 o 2 semanas).</p>}
        {a.folios.grupos.map((g) => (
          <Grupo key={g.contrato} titulo={`${g.contrato} · ${g.folios.length} folio(s) · ${money(g.importe)}`} sub={`el más viejo tiene ${g.masViejo} día(s)${g.mas30 ? ` · ${money(g.mas30)} con más de 30 días` : ""}`}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Folio", "Fecha", "Días", "Estudio", "Importe"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{g.folios.map((f) => <tr key={f.clave}><td style={td}>{f.folio}</td><td style={td}>{f.fecha ? new Date(f.fecha + "T00:00:00").toLocaleDateString("es-MX") : "—"}</td><td style={{ ...td, color: f.edad > 30 ? "var(--rojo)" : undefined }}>{f.edad ?? "—"}</td><td style={td}>{f.estudio}</td><td style={tdN}>{money(f.importe)}</td></tr>)}</tbody>
            </table>
          </Grupo>
        ))}
        {!a.folios.n && <p style={{ fontSize: 13, margin: 0 }}>No hay folios sin facturar.</p>}
      </div>

      {/* 1. Dictámenes que no alcanzan */}
      <div style={card}>
        <Titulo id="dictamen" color="var(--rojo)" n={a.resumen.length} t="Contratos sin saldo suficiente o con CR en error" sub="resuélvelo ANTES de mandar las facturas a OOAD" />
        {a.cuentas.porActualizar > 0 && <p style={{ fontSize: 13, margin: "0 0 8px", padding: "6px 10px", background: "#fef3c7", borderRadius: 8, color: "#92400e" }}>{a.cuentas.porActualizar} dictamen(es) con facturas pendientes traen un IMKK036 de un mes anterior: súbelos en <Link href="/comprobantes" style={{ fontWeight: 600 }}>Cargar reportes</Link> para saber el saldo actual.</p>}
        {a.resumen.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Contrato", "Dictamen", "Disponible acumulado HGZ 2", "Faltan", "Qué hacer", "Facturas afectadas"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{a.resumen.map((r) => (
              <tr key={r.contrato.id + "|" + r.dictamen}>
                <td style={td}><strong>{r.contrato.numero_interno}</strong><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{r.contrato.proveedores?.razon_social}</div></td>
                <td style={td}>{r.dictamen}{r.esPasivo && <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>dictamen de pasivo</div>}</td>
                <td style={tdN}>{r.disponible == null ? "—" : money(r.disponible)}</td>
                <td style={{ ...tdN, color: "var(--rojo)", fontWeight: 700 }}>{r.faltante ? money(r.faltante) : ""}</td>
                <td style={{ ...td, fontWeight: 600, color: r.accion === "oficio" ? "#92400e" : "var(--rojo)" }}>
                  {r.accion === "actualizar" ? `Bajar el IMKK036 de ${r.mes} para saber si ya hay dinero`
                    : r.accion === "oficio" ? `Mandar con oficio de apoyo (${r.otras.map(([ui, v]) => `UI ${ui} tiene ${money(v)}`).join(", ")})`
                    : r.accion === "ampliacion" ? `Ampliación de dictamen${r.otrasDisp ? ` (otras unidades solo alcanzan para parte: tienen ${money(r.otrasDisp)})` : ""}`
                    : "Pedir revalidación de los CR en error"}
                  {(() => {
                    const conOficio = P.oficio.filter((x) => x.s.contrato?.id === r.contrato.id && x.s.dictamen === r.dictamen);
                    return conOficio.length > 0 && (
                      <div style={{ fontWeight: 400, color: "var(--texto)", fontSize: 12.5, marginTop: 6 }}>
                        {r.accion === "ampliacion" ? "Para lo que alcanza: " : ""}oficio de apoyo para {conOficio.length} factura(s) por {money(suma(conOficio))} ({totalApoyo(conOficio).map(([ui, v]) => `UI ${ui} ${money(v)}`).join(", ")})
                        <div style={{ marginTop: 4 }}><a href={`#of-${r.contrato.numero_interno}`} style={{ color: "var(--verde)", fontWeight: 600 }}>Ver lista completa y generar oficio</a></div>
                      </div>
                    );
                  })()}
                </td>
                <td style={td}>{r.facturas.map((f) => <div key={f.id}><LinkF f={f} /> · {f.folio_proveedor} · {money(f.importe_factura)}{f.cr_contrarecibo ? ` · CR ${f.cr_contrarecibo}` : " · sin CR"}{a.sem.get(f.id)?.error ? <strong style={{ color: "var(--rojo)" }}> · error de presupuesto</strong> : ""}</div>)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p style={{ fontSize: 13, margin: 0 }}>Ningún contrato con IMKK036 al día está sin dinero.</p>}
      </div>

      {/* 2. Pedido-recepción recibido */}
      <div style={card}>
        <Titulo id="pr" color="#2b6cb0" n={a.conPR.length} t="Facturas con pedido-recepción ya generado y sin mandar a OOAD" sub={a.cuentas.prNuevos ? `${a.cuentas.prNuevos} recibido(s) en los últimos 7 días` : ""} />
        {a.conPR.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Factura", "Proveedor", "Importe", "Pedido / recepción", "¿Lista para OOAD?", "Dictamen"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{a.conPR.map(({ f, lista, dias, nuevo, sem }) => (
              <tr key={f.id} style={{ background: nuevo ? "#f0f7ff" : undefined }}>
                <td style={td}><LinkF f={f} />{nuevo && <span style={{ marginLeft: 6, fontSize: 11, color: "#2b6cb0", fontWeight: 700 }}>NUEVO</span>}<div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}</div></td>
                <td style={td}>{f.proveedores?.razon_social}</td>
                <td style={tdN}>{money(f.importe_factura)}</td>
                <td style={td}>{[f.numero_pedido && `Ped. ${f.numero_pedido}`, f.numero_recepcion && `Rec. ${f.numero_recepcion}`].filter(Boolean).join(" · ") || "—"}{dias != null && <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>hace {dias} día(s)</div>}</td>
                <td style={{ ...td, fontWeight: 600, color: lista ? "var(--verde)" : "#92400e" }}>{lista ? "Sí: ya puedes mandarla a OOAD" : `Faltan firmas (${LABEL_FIRMAS[f.estatus_firmas] || f.estatus_firmas})`}</td>
                <td style={td}><Semaforo s={sem} /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p style={{ fontSize: 13, margin: 0 }}>No hay facturas con pedido-recepción pendientes de mandar.</p>}
      </div>

      {/* 3. Listas para OOAD */}
      <div style={card}>
        <Titulo id="ooad" color="var(--verde)" n={a.listasOOAD.length} t="Listas para mandar a OOAD (firmas y pedido-recepción completos)" sub={a.cuentas.listasSinDinero ? `${a.cuentas.listasSinDinero} sin dinero en el dictamen: resuélvelo antes de mandarlas` : ""} />
        {a.listasOOAD.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Factura", "Proveedor", "Importe", "Estatus", "Dictamen"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{a.listasOOAD.slice().sort((x, y) => (["rojo", "ambar"].includes(y.sem?.nivel)) - (["rojo", "ambar"].includes(x.sem?.nivel))).map(({ f, sem }) => (
              <tr key={f.id}>
                <td style={td}><LinkF f={f} /><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}</div></td>
                <td style={td}>{f.proveedores?.razon_social}</td>
                <td style={tdN}>{money(f.importe_factura)}</td>
                <td style={td}>{LABEL_GENERAL[f.estatus_general] || f.estatus_general}</td>
                <td style={td}><Semaforo s={sem} /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p style={{ fontSize: 13, margin: 0 }}>No hay facturas listas para OOAD.</p>}
      </div>

      {/* 4. CR en error */}
      {a.enError.length > 0 && (
        <div style={card}>
          <Titulo id="error" color="var(--rojo)" n={a.enError.length} t="CR con error de presupuesto en FINAT" sub="se quedan atorados hasta que haya dinero y OOAD los revalide" />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Factura", "Proveedor", "Importe", "CR", "Dictamen"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{a.enError.map((f) => (
              <tr key={f.id}><td style={td}><LinkF f={f} /></td><td style={td}>{f.proveedores?.razon_social}</td><td style={tdN}>{money(f.importe_factura)}</td><td style={td}>{f.cr_contrarecibo}</td><td style={td}><Semaforo s={a.sem.get(f.id)} /></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
