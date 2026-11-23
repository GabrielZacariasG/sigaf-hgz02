// Acto conciliatorio con proveedor (por contrato), en formato institucional del HGZ No. 02.
// Reproduce el acta: asistentes, fundamento legal, resumen, facturación pagada/pendiente, acuerdo y firmas.
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

function personas(d) {
  const admin = { n: d.administrador || "________________________", c: `Administrador del contrato ${d.contratoNum}` };
  const repleg = { n: d.representante || "________________________", c: `Representante Legal\nContrato ${d.contratoNum}` };
  return { admin, repleg };
}
function textos(d) {
  const { adeudo } = d;
  const preambulo = `El presente documento describe la cantidad ejercida al corte de la fecha del presente, correspondiente al ejercicio 2026, del contrato ${d.contratoNum}, bajo el amparo del antepenúltimo párrafo del artículo 1° de la Ley de Adquisiciones, Arrendamientos y Servicios del Sector Público, al proveedor ${d.proveedor}, representado por los descritos para este Acto Conciliatorio.`;
  const acuerdo = Number(adeudo) > 0.5
    ? `Ambas partes, una vez llevada a cabo la presente conciliación, manifiestan su conformidad en que, a la fecha de la presente reunión, subsiste un adeudo pendiente de pago por la cantidad de ${money(adeudo)}, conforme a lo antes relacionado.`
    : `Ambas partes, una vez llevada a cabo la presente conciliación, manifiestan su conformidad en que no existe adeudo alguno posterior a lo antes relacionado, a la fecha de la presente reunión.`;
  const cierre = `Acto seguido, no habiendo otro asunto que tratar ni más constancias que asentar, se da por terminada la sesión a las ${d.horaFin || "09:00"} horas del día de su fecha, firmando al calce y al margen quienes en ella intervinieron, para debida constancia legal.`;
  return { preambulo, acuerdo, cierre };
}

// ---------- Componente en pantalla / impresión (PDF) ----------
export default function ConciliacionProveedor({ datos: d }) {
  const { admin, repleg } = personas(d);
  const { preambulo, acuerdo, cierre } = textos(d);
  const th = { fontSize: 10, textAlign: "left", padding: "4px 6px", border: "1px solid #333", background: "#f2f2f2", fontWeight: 700 };
  const td = { fontSize: 10, padding: "3px 6px", border: "1px solid #333" };
  const asistentes = [admin, DIRECTOR, SUBDIR, JEFA_FIN, JEFE_PPTO, repleg];
  const firmas = [admin, repleg, DIRECTOR, SUBDIR, JEFA_FIN, JEFE_PPTO];
  const tablaFac = (lista) => (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
      <thead><tr>{["Contrato", "Folio Factura", "Fecha", "Importe", "Contra recibo"].map((t, i) => <th key={t} style={{ ...th, textAlign: i === 3 ? "right" : "left" }}>{t}</th>)}</tr></thead>
      <tbody>
        {lista.map((f, i) => (
          <tr key={i}><td style={td}>{d.contratoNum}</td><td style={td}>{f.folio}</td><td style={td}>{fCorta(f.fecha)}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(f.importe)}</td><td style={td}>{f.cr || "—"}</td></tr>
        ))}
        <tr><td style={{ ...td, fontWeight: 700 }} colSpan={3}>TOTAL ({lista.length})</td><td style={{ ...td, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>{money(lista.reduce((s, f) => s + Number(f.importe), 0))}</td><td style={td}></td></tr>
      </tbody>
    </table>
  );
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
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>ASISTENTES</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Nombre</th><th style={th}>Dirección Normativa / Cargo</th></tr></thead>
            <tbody>{asistentes.map((p, i) => <tr key={i}><td style={td}>{p.n}</td><td style={{ ...td, whiteSpace: "pre-line" }}>{p.c}</td></tr>)}</tbody>
          </table>
          <p style={{ marginTop: 12, fontSize: 11.5, textAlign: "justify", lineHeight: 1.55 }}><strong>Tema:</strong> Acto Conciliatorio Ejercicio 2026, Contrato {d.contratoNum} — Departamento de Finanzas del H.G.Z. No. 02.</p>
          <p style={{ marginTop: 8, fontSize: 11.5, textAlign: "justify", lineHeight: 1.55 }}>{preambulo}</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
            <thead><tr>{["Contrato", "Importe Total", "Importe Pagado", "Importe de Adeudo"].map((t, i) => <th key={t} style={{ ...th, textAlign: i ? "right" : "left" }}>{t}</th>)}</tr></thead>
            <tbody><tr><td style={td}>{d.contratoNum}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(d.total)}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(d.pagado)}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, color: Number(d.adeudo) > 0.5 ? "#b00" : "inherit" }}>{money(d.adeudo)}</td></tr></tbody>
          </table>
          <p style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600 }}>A continuación se enlista la facturación pagada:</p>
          {tablaFac(d.pagadas)}
          {d.pendientes?.length > 0 && <>
            <p style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600 }}>Facturación pendiente de pago:</p>
            {tablaFac(d.pendientes)}
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
  const { admin, repleg } = personas(d);
  const { preambulo, acuerdo, cierre } = textos(d);
  const asistentes = [admin, DIRECTOR, SUBDIR, JEFA_FIN, JEFE_PPTO, repleg];
  const firmas = [admin, repleg, DIRECTOR, SUBDIR, JEFA_FIN, JEFE_PPTO];
  const thL = 'style="font-size:10pt;text-align:left;padding:4px 6px;border:1px solid #333;background:#f2f2f2;font-weight:700"';
  const thR = 'style="font-size:10pt;text-align:right;padding:4px 6px;border:1px solid #333;background:#f2f2f2;font-weight:700"';
  const tdL = 'style="font-size:10pt;padding:3px 6px;border:1px solid #333"';
  const tdR = 'style="font-size:10pt;padding:3px 6px;border:1px solid #333;text-align:right"';
  const tablaFac = (lista) => `<table style="width:100%;border-collapse:collapse;margin-top:8px"><thead><tr><th ${thL}>Contrato</th><th ${thL}>Folio Factura</th><th ${thL}>Fecha</th><th ${thR}>Importe</th><th ${thL}>Contra recibo</th></tr></thead><tbody>${lista.map((f) => `<tr><td ${tdL}>${esc(d.contratoNum)}</td><td ${tdL}>${esc(f.folio)}</td><td ${tdL}>${esc(fCorta(f.fecha))}</td><td ${tdR}>${esc(money(f.importe))}</td><td ${tdL}>${esc(f.cr || "—")}</td></tr>`).join("")}<tr><td ${tdL} colspan="3"><b>TOTAL (${lista.length})</b></td><td ${tdR}><b>${esc(money(lista.reduce((s, f) => s + Number(f.importe), 0)))}</b></td><td ${tdL}></td></tr></tbody></table>`;
  const firmaCell = (p) => `<td style="width:50%;text-align:center;font-size:10pt;padding:0 14px 46px"><div style="border-top:1px solid #333;padding-top:4px;margin-top:40px"><b>${esc(p.n)}</b></div><div style="font-size:9.5pt;color:#444">${esc(p.c)}</div></td>`;
  const filasFirmas = [];
  for (let i = 0; i < firmas.length; i += 2) filasFirmas.push(`<tr>${firmaCell(firmas[i])}${firmas[i + 1] ? firmaCell(firmas[i + 1]) : "<td></td>"}</tr>`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:letter;margin:0.5cm 1.2cm}body{font-family:Arial,sans-serif;color:#111}p{line-height:1.55}</style></head><body>
<img src="${memH}" style="width:100%;display:block" />
<div style="text-align:center;font-size:15pt;font-weight:700;letter-spacing:1px">ACTO CONCILIATORIO EJERCICIO 2026</div>
<div style="margin-top:10px;font-size:11.5pt;line-height:1.6"><div><b>Lugar:</b> Aguascalientes, Aguascalientes, Hospital General de Zona No. 02.</div><div><b>Fecha:</b> ${esc(fLarga(d.fecha))} &nbsp;&nbsp;&nbsp; <b>Hora:</b> ${esc(d.horaInicio || "08:00")} hrs.</div></div>
<div style="font-size:11pt;font-weight:700;margin-top:12px;margin-bottom:4px">ASISTENTES</div>
<table style="width:100%;border-collapse:collapse"><thead><tr><th ${thL}>Nombre</th><th ${thL}>Dirección Normativa / Cargo</th></tr></thead><tbody>${asistentes.map((p) => `<tr><td ${tdL}>${esc(p.n)}</td><td ${tdL}>${esc(p.c)}</td></tr>`).join("")}</tbody></table>
<p style="margin-top:12px;font-size:11.5pt;text-align:justify"><b>Tema:</b> Acto Conciliatorio Ejercicio 2026, Contrato ${esc(d.contratoNum)} — Departamento de Finanzas del H.G.Z. No. 02.</p>
<p style="margin-top:8px;font-size:11.5pt;text-align:justify">${esc(preambulo)}</p>
<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr><th ${thL}>Contrato</th><th ${thR}>Importe Total</th><th ${thR}>Importe Pagado</th><th ${thR}>Importe de Adeudo</th></tr></thead><tbody><tr><td ${tdL}>${esc(d.contratoNum)}</td><td ${tdR}>${esc(money(d.total))}</td><td ${tdR}>${esc(money(d.pagado))}</td><td ${tdR}><b>${esc(money(d.adeudo))}</b></td></tr></tbody></table>
<p style="margin-top:12px;font-size:11.5pt;font-weight:600">A continuación se enlista la facturación pagada:</p>
${tablaFac(d.pagadas)}
${d.pendientes?.length ? `<p style="margin-top:12px;font-size:11.5pt;font-weight:600">Facturación pendiente de pago:</p>${tablaFac(d.pendientes)}` : ""}
<p style="margin-top:14px;font-size:11.5pt;text-align:justify">${esc(acuerdo)}</p>
<p style="margin-top:8px;font-size:11.5pt;text-align:justify">${esc(cierre)}</p>
<div style="font-size:11pt;font-weight:700;margin-top:24px;margin-bottom:10px">FIRMAS</div>
<table style="width:100%">${filasFirmas.join("")}</table>
<img src="${memF}" style="width:100%;display:block;margin-top:20px" />
</body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const nombre = `ACTO CONCILIATORIO ${String(d.contratoNum).replace(/[^\w-]+/g, "")} ${String(d.proveedor).replace(/[^\w ]+/g, "").slice(0, 30)}.doc`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
