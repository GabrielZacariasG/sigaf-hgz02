// Oficio de envío de Relación de Gastos: mismo formato que el oficio de envío a pago de SIGAF
// (membrete, Of. N°, destinatario, tabla, firma), con el comentario y la relación del memorándum de reembolso.
const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const oTh = { fontSize: 11, textAlign: "left", padding: "5px 7px", border: "1px solid #333", background: "#f2f2f2", fontWeight: 700 };
const oTd = { fontSize: 11, padding: "4px 7px", border: "1px solid #333" };
const fCorta = (iso) => { const [a, m, d] = String(iso).split("-"); return a && m && d ? `${d}/${m}/${a}` : "—"; };
const fLarga = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

export default function OficioReembolso({ reembolso: r, folio, firmante = { nombre: "Lic. José Cortez González", cargo: "Subdirector Administrativo" } }) {
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
          <div style={{ textAlign: "right", marginTop: 16, fontSize: 13.5, lineHeight: 1.7 }}>
            <div>Of. N° <strong>{folio}</strong></div>
            <div>Aguascalientes, Ags., a {fLarga(r.fecha)}</div>
          </div>
          <div style={{ marginTop: 8, fontSize: 14 }}>
            <div style={{ fontWeight: 700 }}>Mtra. Farlyn Isabel Hernández Arias</div>
            <div>Departamento de Presupuesto, Contabilidad y Erogaciones</div>
            <div style={{ marginTop: 16 }}>Presente</div>
          </div>
          <p style={{ marginTop: 18, fontSize: 12.5, textAlign: "justify", lineHeight: 1.55 }}>
            Por medio del presente envío a usted, Relación de Gastos #{r.numero} con facturas para trámite de reembolso, mismas que a continuación se relacionan:
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead><tr><th style={oTh}>P.P.</th><th style={oTh}>Fecha Fact.</th><th style={oTh}>Folio</th><th style={{ ...oTh, textAlign: "right" }}>Importe</th><th style={oTh}>Proveedor</th></tr></thead>
            <tbody>
              {r.lineas.map((l) => <tr key={l.folio}><td style={oTd}>{l.pp}</td><td style={oTd}>{fCorta(l.fecha)}</td><td style={oTd}>{l.folio}</td><td style={{ ...oTd, textAlign: "right" }}>{money(l.importe)}</td><td style={oTd}>{l.proveedor}</td></tr>)}
              <tr><td style={{ ...oTd, fontWeight: 700 }} colSpan={3}>Total ({r.lineas.length})</td><td style={{ ...oTd, textAlign: "right", fontWeight: 700 }}>{money(r.total)}</td><td style={oTd}></td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 14, fontSize: 12.5, textAlign: "justify", lineHeight: 1.55 }}>
            Lo anterior para su trámite correspondiente, sin otro particular de momento, me despido enviando un cordial saludo.
          </p>
          <div style={{ marginTop: 40, textAlign: "left" }}>
            <div style={{ fontWeight: 700, letterSpacing: 3 }}>ATENTAMENTE</div>
            <div style={{ fontStyle: "italic", fontSize: 12, color: "#444" }}>&ldquo;SEGURIDAD Y SOLIDARIDAD SOCIAL&rdquo;</div>
            <div style={{ marginTop: 56 }}>
              <strong>{firmante.nombre}</strong><br />
              <span style={{ fontSize: 12.5 }}>{firmante.cargo} del HGZ No. 02</span>
            </div>
            <div style={{ marginTop: 18, fontSize: 12 }}>c.c.p. Expediente</div>
            <div style={{ marginTop: 14, fontSize: 10.5, color: "#666", lineHeight: 1.4 }}>
              Revisó: L.A.E. Gabriel Alejandro Zacarías Girón · Jefe de la Oficina de Presupuesto · HGZ No. 02<br />
              Autorizó: L.A. Nayeli Alonso Orozco · Jefa del Departamento de Finanzas · HGZ No. 02
            </div>
          </div>
        </td></tr></tbody>
      </table>
      <style>{`
        .doc-hoja { background:#fff; color:#111; box-sizing:border-box; width:21.6cm; max-width:100%; min-height:27.9cm; margin:0 auto 20px; padding:0.5cm 1.2cm; border:1px solid var(--borde); border-radius:4px; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .wrap { width:100%; border-collapse:collapse; }
        .mem-h, .mem-f { display:block; width:100%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .thc, .tfc { padding:0; }
        .cuerpo { vertical-align:top; padding:0.25cm 0.8cm; color:#111; }
        .cuerpo table tr { break-inside:avoid; }
        @page { size: letter; margin: 0.5cm 1.2cm; }
        @media print {
          .doc-hoja { border:none !important; margin:0 !important; border-radius:0 !important; width:100%; max-width:none; min-height:0 !important; padding:0 !important; break-after: page; }
          thead { display:table-header-group; }
          tfoot { display:table-footer-group; }
        }
      `}</style>
    </div>
  );
}
