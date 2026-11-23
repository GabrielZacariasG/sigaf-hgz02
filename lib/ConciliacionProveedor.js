// Estado de cuenta / conciliación con proveedor, en formato institucional (membrete del HGZ No. 02).
// Se ve en pantalla, se imprime a PDF y se descarga en Word, con los mismos membretes de los oficios.
const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fLarga = (iso) => new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

const COLS = [
  { k: "contrato", t: "Contrato" }, { k: "folio_proveedor", t: "Folio" }, { k: "periodo", t: "Periodo" },
  { k: "cr", t: "CR" }, { k: "fpago", t: "F. pago" },
  { k: "importe", t: "Importe", money: true, r: true }, { k: "pagado", t: "Pagado", money: true, r: true },
  { k: "porpagar", t: "Por pagar", money: true, r: true }, { k: "situacion", t: "Situación" },
];

// ---------- Componente en pantalla / impresión (PDF) ----------
export default function ConciliacionProveedor({ datos: d }) {
  const th = { fontSize: 9.5, textAlign: "left", padding: "4px 5px", border: "1px solid #333", background: "#f2f2f2", fontWeight: 700 };
  const td = { fontSize: 9.5, padding: "3px 5px", border: "1px solid #333" };
  return (
    <div className="doc-hoja">
      <table className="wrap">
        <thead><tr><td className="thc"><img src="/mem-encabezado.png" alt="" className="mem-h" /></td></tr></thead>
        <tfoot><tr><td className="tfc"><img src="/mem-pie.png" alt="" className="mem-f" /></td></tr></tfoot>
        <tbody><tr><td className="cuerpo">
          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, color: "#222" }}>
            ÓRGANO DE OPERACIÓN ADMINISTRATIVA DESCONCENTRADA ESTATAL EN AGUASCALIENTES<br />
            HOSPITAL GENERAL DE ZONA NO. 2
          </div>
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>ESTADO DE CUENTA PARA CONCILIACIÓN</div>
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}>
            <div><strong>Proveedor:</strong> {d.proveedor}</div>
            <div><strong>Fecha:</strong> Aguascalientes, Ags., a {fLarga(d.fecha)}</div>
            <div style={{ fontSize: 12, color: "#333", marginTop: 2 }}>{d.rows.length} factura(s) · Facturado {money(d.totales.importe)} · Pagado {money(d.totales.pagado)} · Por pagar {money(d.totales.porpagar)}</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead><tr>{COLS.map((c) => <th key={c.k} style={{ ...th, textAlign: c.r ? "right" : "left" }}>{c.t}</th>)}</tr></thead>
            <tbody>
              {d.rows.map((row, i) => (
                <tr key={i}>{COLS.map((c) => <td key={c.k} style={{ ...td, textAlign: c.r ? "right" : "left", whiteSpace: c.r ? "nowrap" : "normal" }}>{c.money ? money(row[c.k]) : row[c.k]}</td>)}</tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700 }} colSpan={5}>TOTAL ({d.rows.length})</td>
                <td style={{ ...td, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>{money(d.totales.importe)}</td>
                <td style={{ ...td, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>{money(d.totales.pagado)}</td>
                <td style={{ ...td, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>{money(d.totales.porpagar)}</td>
                <td style={td}></td>
              </tr>
            </tbody>
          </table>
          <p style={{ marginTop: 14, fontSize: 11.5, textAlign: "justify", lineHeight: 1.5, color: "#333" }}>
            El presente estado de cuenta refleja las facturas registradas en el sistema del Hospital General de Zona No. 2 a la fecha indicada, con su importe, lo pagado (contra-recibo y fecha de pago) y el saldo por pagar, para su conciliación con los registros del proveedor.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 60, gap: 24 }}>
            {[
              { l1: "Por el proveedor", l2: "Recibí de conformidad", n: d.proveedor, c: "" },
              { l1: "Por el HGZ No. 02", l2: "Revisó", n: "L.A.E. Gabriel Alejandro Zacarías Girón", c: "Jefe de la Oficina de Presupuesto" },
            ].map((f, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11.5 }}>
                <div style={{ borderTop: "1px solid #333", paddingTop: 4, marginTop: 36 }}><strong>{f.n}</strong></div>
                {f.c && <div style={{ fontSize: 10.5, color: "#444" }}>{f.c}</div>}
                <div style={{ fontSize: 10.5, color: "#666", marginTop: 2 }}>{f.l1} · {f.l2}</div>
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
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function descargarConciliacionWord(d) {
  const [memH, memF] = await Promise.all([dataURL("/mem-encabezado.png"), dataURL("/mem-pie.png")]);
  const thC = 'style="font-size:9.5pt;text-align:left;padding:4px 5px;border:1px solid #333;background:#f2f2f2;font-weight:700"';
  const tdC = 'style="font-size:9.5pt;padding:3px 5px;border:1px solid #333"';
  const tdR = 'style="font-size:9.5pt;padding:3px 5px;border:1px solid #333;text-align:right"';
  const encabTabla = COLS.map((c) => `<th style="font-size:9.5pt;text-align:${c.r ? "right" : "left"};padding:4px 5px;border:1px solid #333;background:#f2f2f2;font-weight:700">${c.t}</th>`).join("");
  const cuerpo = d.rows.map((row) => `<tr>${COLS.map((c) => `<td ${c.r ? tdR : tdC}>${c.money ? esc(money(row[c.k])) : esc(row[c.k])}</td>`).join("")}</tr>`).join("");
  const total = `<tr><td ${tdC} colspan="5"><b>TOTAL (${d.rows.length})</b></td><td ${tdR}><b>${esc(money(d.totales.importe))}</b></td><td ${tdR}><b>${esc(money(d.totales.pagado))}</b></td><td ${tdR}><b>${esc(money(d.totales.porpagar))}</b></td><td ${tdC}></td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:letter;margin:0.5cm 1.2cm}body{font-family:Arial,sans-serif;color:#111}</style></head><body>
<img src="${memH}" style="width:100%;display:block" />
<div style="font-size:12pt;font-weight:700">ÓRGANO DE OPERACIÓN ADMINISTRATIVA DESCONCENTRADA ESTATAL EN AGUASCALIENTES<br/>HOSPITAL GENERAL DE ZONA NO. 2</div>
<div style="text-align:center;margin-top:12px;font-size:15pt;font-weight:700;letter-spacing:1px">ESTADO DE CUENTA PARA CONCILIACIÓN</div>
<div style="margin-top:10px;font-size:13pt;line-height:1.6">
<div><b>Proveedor:</b> ${esc(d.proveedor)}</div>
<div><b>Fecha:</b> Aguascalientes, Ags., a ${esc(fLarga(d.fecha))}</div>
<div style="font-size:12pt;color:#333">${d.rows.length} factura(s) &middot; Facturado ${esc(money(d.totales.importe))} &middot; Pagado ${esc(money(d.totales.pagado))} &middot; Por pagar ${esc(money(d.totales.porpagar))}</div>
</div>
<table style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr>${encabTabla}</tr></thead><tbody>${cuerpo}${total}</tbody></table>
<p style="margin-top:14px;font-size:11.5pt;text-align:justify;line-height:1.5;color:#333">El presente estado de cuenta refleja las facturas registradas en el sistema del Hospital General de Zona No. 2 a la fecha indicada, con su importe, lo pagado (contra-recibo y fecha de pago) y el saldo por pagar, para su conciliación con los registros del proveedor.</p>
<table style="width:100%;margin-top:60px"><tr>
<td style="width:50%;text-align:center;font-size:11.5pt"><div style="border-top:1px solid #333;padding-top:4px;margin-top:40px"><b>${esc(d.proveedor)}</b></div><div style="font-size:10.5pt;color:#666">Por el proveedor &middot; Recibí de conformidad</div></td>
<td style="width:50%;text-align:center;font-size:11.5pt"><div style="border-top:1px solid #333;padding-top:4px;margin-top:40px"><b>L.A.E. Gabriel Alejandro Zacarías Girón</b></div><div style="font-size:10.5pt;color:#444">Jefe de la Oficina de Presupuesto</div><div style="font-size:10.5pt;color:#666">Por el HGZ No. 02 &middot; Revisó</div></td>
</tr></table>
<img src="${memF}" style="width:100%;display:block;margin-top:24px" />
</body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const nombre = `Conciliacion ${String(d.proveedor).replace(/[^\w ]+/g, "").slice(0, 40)} ${String(d.fecha).slice(0, 10)}.doc`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
