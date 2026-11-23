// Acto conciliatorio con proveedor (uno o varios contratos), en formato institucional del HGZ No. 02.
// Reproduce el acta: asistentes, fundamento legal, resumen por contrato, facturación pagada/pendiente, acuerdo y firmas.
// Se ve en pantalla, se imprime a PDF y se descarga en Word (.doc con membrete embebido).
const money = (n) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fLarga = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split("-"); return a && m && d ? `${d} de ${cap(MESES[+m - 1])} de ${a}` : ""; };
const fCorta = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split("-"); return a && m && d ? `${d}/${m}/${a}` : "—"; };

// Firmantes institucionales fijos del HGZ No. 02
const DIRECTOR = { n: "Dr. Yamid Brajin Sánchez Rodríguez", c: "Director del H.G.Z. No. 02" };
const SUBDIR = { n: "Lic. José Cortez González", c: "Subdirector Administrativo del H.G.Z. No. 02" };
const JEFA_FIN = { n: "L.A. Nayeli Alonso Orozco", c: "Jefa del Departamento de Finanzas H.G.Z. No. 02" };
const JEFE_PPTO = { n: "L.A.E. Gabriel Alejandro Zacarías Girón", c: "Jefe de Oficina de Ppto. H.G.Z. No. 02" };

const conSai = (c) => (c.sai && c.sai !== c.num ? ` (No. SAI ${c.sai})` : "");

function derivar(d) {
  const ctos = d.contratos || [];
  const multi = ctos.length > 1;
  // Administradores distintos, con los contratos que administra cada uno
  const grupos = [];
  for (const c of ctos) {
    const key = (c.administrador || "").trim() || "—";
    let g = grupos.find((x) => x.key === key);
    if (!g) { g = { key, n: c.administrador || "________________________", nums: [] }; grupos.push(g); }
    g.nums.push(c.num);
  }
  const admins = grupos.map((g) => ({ n: g.n, c: `Administrador del contrato ${g.nums.join(", ")}` }));
  const repleg = { n: d.representante || "________________________", c: multi ? "Representante Legal del proveedor" : `Representante Legal\nContrato ${ctos[0]?.num || ""}` };
  const asistentes = [...admins, DIRECTOR, SUBDIR, JEFA_FIN, JEFE_PPTO, repleg];
  const firmas = [...admins, repleg, DIRECTOR, SUBDIR, JEFA_FIN, JEFE_PPTO];
  const listaCtos = ctos.map((c) => `${c.num}${conSai(c)}`).join(", ");
  const preambulo = `El presente documento describe la cantidad ejercida al corte de la fecha del presente, correspondiente al ejercicio 2026, ${multi ? "de los contratos" : "del contrato"} ${listaCtos}, bajo el amparo del antepenúltimo párrafo del artículo 1° de la Ley de Adquisiciones, Arrendamientos y Servicios del Sector Público, al proveedor ${d.proveedor}, representado por los descritos para este Acto Conciliatorio.`;
  const acuerdo = Number(d.adeudo) > 0.5
    ? `Ambas partes, una vez llevada a cabo la presente conciliación, manifiestan su conformidad en que, a la fecha de la presente reunión, subsiste un adeudo pendiente de pago por la cantidad de ${money(d.adeudo)}, conforme a lo antes relacionado.`
    : `Ambas partes, una vez llevada a cabo la presente conciliación, manifiestan su conformidad en que no existe adeudo alguno posterior a lo antes relacionado, a la fecha de la presente reunión.`;
  const cierre = `Acto seguido, no habiendo otro asunto que tratar ni más constancias que asentar, se da por terminada la sesión a las ${d.horaFin || "09:00"} horas del día de su fecha, firmando al calce y al margen quienes en ella intervinieron, para debida constancia legal.`;
  return { multi, admins, repleg, asistentes, firmas, listaCtos, preambulo, acuerdo, cierre };
}

// ---------- Componente en pantalla / impresión (PDF) ----------
export default function ConciliacionProveedor({ datos: d }) {
  const { multi, asistentes, firmas, preambulo, acuerdo, cierre } = derivar(d);
  const th = { fontSize: 10, textAlign: "left", padding: "4px 6px", border: "1px solid #333", background: "#f2f2f2", fontWeight: 700 };
  const td = { fontSize: 10, padding: "3px 6px", border: "1px solid #333" };
  const tablaFac = (lista, conSituacion) => {
    const cab = conSituacion ? ["Contrato", "Folio Factura", "Fecha", "Importe", "Contra recibo", "Situación"] : ["Contrato", "Folio Factura", "Fecha", "Importe", "Contra recibo"];
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead><tr>{cab.map((t) => <th key={t} style={{ ...th, textAlign: t === "Importe" ? "right" : "left" }}>{t}</th>)}</tr></thead>
        <tbody>
          {lista.map((f, i) => (
            <tr key={i}><td style={td}>{f.contrato}</td><td style={td}>{f.folio}</td><td style={td}>{fCorta(f.fecha)}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(f.importe)}</td><td style={td}>{f.cr || "—"}</td>{conSituacion && <td style={td}>{f.situacion || "—"}</td>}</tr>
          ))}
          <tr><td style={{ ...td, fontWeight: 700 }} colSpan={3}>TOTAL ({lista.length})</td><td style={{ ...td, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>{money(lista.reduce((s, f) => s + Number(f.importe), 0))}</td><td style={td}></td>{conSituacion && <td style={td}></td>}</tr>
        </tbody>
      </table>
    );
  };
  return (
    <div className="doc-hoja">
      <table className="wrap">
        <thead><tr><td className="thc"><img src="/mem-encabezado.png" alt="" className="mem-h" /></td></tr></thead>
        <tfoot><tr><td className="tfc"><img src="/mem-pie.png" alt="" className="mem-f" /></td></tr></tfoot>
        <tbody><tr><td className="cuerpo">
          <div style={{ textAlign: "center", fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>ACTO CONCILIATORIO EJERCICIO 2026</div>
          <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.6 }}>
            <div><strong>Lugar:</strong> Aguascalientes, Aguascalientes, Hospital General de Zona No. 02.</div>
            <div><strong>Fecha:</strong> {fLarga(d.fecha)}&nbsp;&nbsp;&nbsp;&nbsp;<strong>Hora:</strong> {d.horaInicio || "08:00"} hrs.</div>
            <div><strong>Proveedor:</strong> {d.proveedor}</div>
            {!multi && d.contratos[0] && <div><strong>Contrato:</strong> {d.contratos[0].num}{conSai(d.contratos[0]) && <>&nbsp;&nbsp;&nbsp;&nbsp;<strong>No. de contrato SAI:</strong> {d.contratos[0].sai}</>}</div>}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>ASISTENTES</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Nombre</th><th style={th}>Dirección Normativa / Cargo</th></tr></thead>
            <tbody>{asistentes.map((p, i) => <tr key={i}><td style={td}>{p.n}</td><td style={{ ...td, whiteSpace: "pre-line" }}>{p.c}</td></tr>)}</tbody>
          </table>
          <p style={{ marginTop: 12, fontSize: 11.5, textAlign: "justify", lineHeight: 1.55 }}><strong>Tema:</strong> Acto Conciliatorio Ejercicio 2026, {multi ? "Contratos" : "Contrato"} {d.contratos.map((c) => c.num).join(", ")} — Departamento de Finanzas del H.G.Z. No. 02.</p>
          <p style={{ marginTop: 8, fontSize: 11.5, textAlign: "justify", lineHeight: 1.55 }}>{preambulo}</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
            <thead><tr>{["Contrato", "No. SAI", "Importe Total", "Importe Pagado", "Importe de Adeudo"].map((t, i) => <th key={t} style={{ ...th, textAlign: i >= 2 ? "right" : "left" }}>{t}</th>)}</tr></thead>
            <tbody>
              {d.contratos.map((c, i) => (
                <tr key={i}><td style={td}>{c.num}</td><td style={td}>{c.sai && c.sai !== c.num ? c.sai : "—"}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(c.total)}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(c.pagado)}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: Number(c.adeudo) > 0.5 ? "#b00" : "inherit" }}>{money(c.adeudo)}</td></tr>
              ))}
              {multi && <tr><td style={{ ...td, fontWeight: 700 }} colSpan={2}>TOTAL</td><td style={{ ...td, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{money(d.total)}</td><td style={{ ...td, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{money(d.pagado)}</td><td style={{ ...td, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: Number(d.adeudo) > 0.5 ? "#b00" : "inherit" }}>{money(d.adeudo)}</td></tr>}
            </tbody>
          </table>
          <p style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600 }}>A continuación se enlista la facturación pagada:</p>
          {tablaFac(d.pagadas)}
          {d.pendientes?.length > 0 && <>
            <p style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600 }}>Facturación pendiente de pago:</p>
            {tablaFac(d.pendientes, true)}
          </>}
          <p style={{ marginTop: 14, fontSize: 11.5, textAlign: "justify", lineHeight: 1.55 }}>{acuerdo}</p>
          <p style={{ marginTop: 8, fontSize: 11.5, textAlign: "justify", lineHeight: 1.55 }}>{cierre}</p>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 24, marginBottom: 10 }}>FIRMAS</div>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {firmas.map((p, i) => (
              <div key={i} style={{ width: "50%", boxSizing: "border-box", padding: "0 14px", marginBottom: 46, textAlign: "center", fontSize: 11 }}>
                <div style={{ borderTop: "1px solid #333", paddingTop: 4, marginTop: 40 }}><strong>{p.n}</strong></div>
                <div style={{ fontSize: 10, color: "#444", whiteSpace: "pre-line" }}>{p.c}</div>
              </div>
            ))}
          </div>
        </td></tr></tbody>
      </table>
      <style>{`
        .doc-hoja { background:#fff; color:#111; box-sizing:border-box; width:21.6cm; max-width:100%; min-height:27.9cm; margin:0 auto 20px; padding:0.5cm 1.2cm; border:1px solid var(--borde); border-radius:4px; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .wrap { width:100%; border-collapse:collapse; }
        .mem-h, .mem-f { display:block; width:100%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .thc, .tfc { padding:0; }
        .cuerpo { vertical-align:top; padding:0.25cm 0.6cm; color:#111; }
        .cuerpo table tr { break-inside:avoid; }
        @page { size: letter; margin: 0.5cm 1.2cm; }
        @media print {
          .doc-hoja { border:none !important; margin:0 !important; border-radius:0 !important; width:100%; max-width:none; min-height:0 !important; padding:0 !important; }
          thead { display:table-header-group; }
          tfoot { display:table-footer-group; }
        }
      `}</style>
    </div>
  );
}

// ---------- Descarga en Word (.doc con membrete embebido) ----------
async function dataURL(url) {
  const r = await fetch(url);
  const b = await r.blob();
  return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

export async function descargarConciliacionWord(d) {
  const [memH, memF] = await Promise.all([dataURL("/mem-encabezado.png"), dataURL("/mem-pie.png")]);
  const { multi, asistentes, firmas, preambulo, acuerdo, cierre } = derivar(d);
  const thL = 'style="font-size:10pt;text-align:left;padding:4px 6px;border:1px solid #333;background:#f2f2f2;font-weight:700"';
  const thR = 'style="font-size:10pt;text-align:right;padding:4px 6px;border:1px solid #333;background:#f2f2f2;font-weight:700"';
  const tdL = 'style="font-size:10pt;padding:3px 6px;border:1px solid #333"';
  const tdR = 'style="font-size:10pt;padding:3px 6px;border:1px solid #333;text-align:right"';
  const tablaFac = (lista, conSituacion) => `<table style="width:100%;border-collapse:collapse;margin-top:8px"><thead><tr><th ${thL}>Contrato</th><th ${thL}>Folio Factura</th><th ${thL}>Fecha</th><th ${thR}>Importe</th><th ${thL}>Contra recibo</th>${conSituacion ? `<th ${thL}>Situación</th>` : ""}</tr></thead><tbody>${lista.map((f) => `<tr><td ${tdL}>${esc(f.contrato)}</td><td ${tdL}>${esc(f.folio)}</td><td ${tdL}>${esc(fCorta(f.fecha))}</td><td ${tdR}>${esc(money(f.importe))}</td><td ${tdL}>${esc(f.cr || "—")}</td>${conSituacion ? `<td ${tdL}>${esc(f.situacion || "—")}</td>` : ""}</tr>`).join("")}<tr><td ${tdL} colspan="3"><b>TOTAL (${lista.length})</b></td><td ${tdR}><b>${esc(money(lista.reduce((s, f) => s + Number(f.importe), 0)))}</b></td><td ${tdL}></td>${conSituacion ? `<td ${tdL}></td>` : ""}</tr></tbody></table>`;
  const resumen = `<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr><th ${thL}>Contrato</th><th ${thL}>No. SAI</th><th ${thR}>Importe Total</th><th ${thR}>Importe Pagado</th><th ${thR}>Importe de Adeudo</th></tr></thead><tbody>${d.contratos.map((c) => `<tr><td ${tdL}>${esc(c.num)}</td><td ${tdL}>${esc(c.sai && c.sai !== c.num ? c.sai : "—")}</td><td ${tdR}>${esc(money(c.total))}</td><td ${tdR}>${esc(money(c.pagado))}</td><td ${tdR}>${esc(money(c.adeudo))}</td></tr>`).join("")}${multi ? `<tr><td ${tdL} colspan="2"><b>TOTAL</b></td><td ${tdR}><b>${esc(money(d.total))}</b></td><td ${tdR}><b>${esc(money(d.pagado))}</b></td><td ${tdR}><b>${esc(money(d.adeudo))}</b></td></tr>` : ""}</tbody></table>`;
  const asisHTML = `<table style="width:100%;border-collapse:collapse"><thead><tr><th ${thL}>Nombre</th><th ${thL}>Dirección Normativa / Cargo</th></tr></thead><tbody>${asistentes.map((p) => `<tr><td ${tdL}>${esc(p.n)}</td><td ${tdL}>${esc(p.c)}</td></tr>`).join("")}</tbody></table>`;
  const firmaCell = (p) => `<td style="width:50%;text-align:center;font-size:10pt;padding:0 14px 46px"><div style="border-top:1px solid #333;padding-top:4px;margin-top:40px"><b>${esc(p.n)}</b></div><div style="font-size:9.5pt;color:#444">${esc(p.c)}</div></td>`;
  const filasFirmas = [];
  for (let i = 0; i < firmas.length; i += 2) filasFirmas.push(`<tr>${firmaCell(firmas[i])}${firmas[i + 1] ? firmaCell(firmas[i + 1]) : "<td></td>"}</tr>`);
  const headCto = !multi && d.contratos[0] ? `<div><b>Contrato:</b> ${esc(d.contratos[0].num)}${d.contratos[0].sai && d.contratos[0].sai !== d.contratos[0].num ? ` &nbsp;&nbsp;&nbsp; <b>No. de contrato SAI:</b> ${esc(d.contratos[0].sai)}` : ""}</div>` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:letter;margin:0.5cm 1.2cm}body{font-family:Arial,sans-serif;color:#111}p{line-height:1.55}</style></head><body>
<img src="${memH}" style="width:100%;display:block" />
<div style="text-align:center;font-size:15pt;font-weight:700;letter-spacing:1px">ACTO CONCILIATORIO EJERCICIO 2026</div>
<div style="margin-top:10px;font-size:11.5pt;line-height:1.6"><div><b>Lugar:</b> Aguascalientes, Aguascalientes, Hospital General de Zona No. 02.</div><div><b>Fecha:</b> ${esc(fLarga(d.fecha))} &nbsp;&nbsp;&nbsp; <b>Hora:</b> ${esc(d.horaInicio || "08:00")} hrs.</div><div><b>Proveedor:</b> ${esc(d.proveedor)}</div>${headCto}</div>
<div style="font-size:11pt;font-weight:700;margin-top:12px;margin-bottom:4px">ASISTENTES</div>
${asisHTML}
<p style="margin-top:12px;font-size:11.5pt;text-align:justify"><b>Tema:</b> Acto Conciliatorio Ejercicio 2026, ${multi ? "Contratos" : "Contrato"} ${esc(d.contratos.map((c) => c.num).join(", "))} — Departamento de Finanzas del H.G.Z. No. 02.</p>
<p style="margin-top:8px;font-size:11.5pt;text-align:justify">${esc(preambulo)}</p>
${resumen}
<p style="margin-top:12px;font-size:11.5pt;font-weight:600">A continuación se enlista la facturación pagada:</p>
${tablaFac(d.pagadas)}
${d.pendientes?.length ? `<p style="margin-top:12px;font-size:11.5pt;font-weight:600">Facturación pendiente de pago:</p>${tablaFac(d.pendientes, true)}` : ""}
<p style="margin-top:14px;font-size:11.5pt;text-align:justify">${esc(acuerdo)}</p>
<p style="margin-top:8px;font-size:11.5pt;text-align:justify">${esc(cierre)}</p>
<div style="font-size:11pt;font-weight:700;margin-top:24px;margin-bottom:10px">FIRMAS</div>
<table style="width:100%">${filasFirmas.join("")}</table>
<img src="${memF}" style="width:100%;display:block;margin-top:20px" />
</body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const quien = d.contratos.length === 1 ? d.contratos[0].num : String(d.proveedor).replace(/[^\w ]+/g, "").slice(0, 30);
  const nombre = `ACTO CONCILIATORIO ${String(quien).replace(/[^\w -]+/g, "")}.doc`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
