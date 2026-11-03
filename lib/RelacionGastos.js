// "Relación de Gastos" (Solicitud ordinaria de reembolso al fondo fijo). Dibuja el formato con las mismas
// coordenadas del original, en puntos de PDF sobre hoja carta; y crece hacia arriba, como en el PDF.
const GRIS = "#c8c8c8";
const FILAS = 31;
const ALTO = 11.34;
const COL = [28.35, 99.21, 141.73, 212.6, 283.46, 340.16, 411.02, 481.89, 581.1];
const POR_HOJA = FILAS - 1; // el último renglón de la hoja es el del subtotal
const money = (n) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const larga = (iso) => { const [a, m, d] = String(iso).split("-"); return a && m && d ? `${d} / ${MESES[+m - 1]} / ${a}` : ""; };

function Hoja({ r, lineas, hoja, hojas, esUltima, subtotal, logo }) {
  const [a, m, d] = String(r.fecha).split("-");
  const Y = (y) => 792 - y;
  const L = (x1, y1, x2, y2, w = 0.57) => <line x1={x1} y1={Y(y1)} x2={x2} y2={Y(y2)} stroke="#000" strokeWidth={w} strokeLinecap="square" />;
  const R = (x, y, an, al, gris) => <rect x={x} y={Y(y)} width={an} height={al} fill={gris ? GRIS : "none"} stroke="#000" strokeWidth={0.57} />;
  const T = (x, y, t, s = 8, op = {}) => <text x={x} y={Y(y)} fontSize={s} fontFamily="Helvetica, Arial, sans-serif" fontWeight={op.b ? 700 : 400} fontStyle={op.i ? "italic" : "normal"} textAnchor={op.a || "middle"}>{t}</text>;
  const celda = (x, y, an, t, s = 8, gris, op) => <>{R(x, y, an, ALTO, gris)}{t !== undefined && t !== "" && T(x + an / 2, y - 8.07, t, s, op)}</>;
  const centro = (i) => (COL[i] + COL[i + 1]) / 2;
  const filas = [];
  for (let i = 0; i < FILAS; i++) {
    const y = 502.86 - i * ALTO, l = lineas[i], y2 = y - ALTO;
    if (i === lineas.length) {
      filas.push(<g key={i}>{L(COL[0], y, COL[0], y2)}{L(COL[0], y, COL[5], y)}
        <rect x={COL[5]} y={Y(y)} width={COL[8] - COL[5]} height={ALTO} fill={GRIS} />
        {[5, 6, 7, 8].map((c) => <g key={c}>{L(COL[c], y, COL[c], y2)}</g>)}
        {L(COL[5], y, COL[8], y)}
        {T(centro(5), y - 8.37, "SUBTOTAL", 9, { b: true })}{T(centro(7), y - 8.37, money(subtotal), 9, { b: true })}</g>);
      continue;
    }
    filas.push(<g key={i}>{COL.map((x) => <g key={x}>{L(x, y, x, y2)}</g>)}{L(COL[0], y, COL[8], y)}
      {l && <>{T(centro(0), y - 8.37, "3X", 9)}{T(centro(2), y - 8.37, r.unidad, 9)}{T(centro(3), y - 8.37, l.cc, 9)}{T(centro(4), y - 8.37, l.cuenta, 9)}{T(centro(5), y - 8.37, l.sub, 9)}{T(centro(6), y - 8.37, (hoja - 1) * POR_HOJA + i + 1, 9)}{T(centro(7), y - 8.37, money(l.importe), 9)}</>}</g>);
  }
  const yFin = 502.86 - FILAS * ALTO;
  return (
    <svg className="hoja-relacion" viewBox="0 0 612 792" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`Relación de Gastos ${r.solicitud}, hoja ${hoja} de ${hojas}`}>
      <rect x="0" y="0" width="612" height="792" fill="#fff" />
      {logo && <image href={logo} x={31.18} y={Y(712.63 + 51.02)} width={51.02} height={51.02} />}
      {T(306, 731.7, "RELACION DE GASTOS", 12)}{T(306, 720.36, r.denominacion, 12)}
      {L(28.35, 695.62, 28.35, 661.6)}{L(28.35, 695.62, 269.29, 695.62)}{L(269.29, 695.62, 269.29, 661.6)}{L(28.35, 661.6, 269.29, 661.6)}
      {T(31.19, 688.15, "DIRECCION DE FINANZAS", 6, { a: "start" })}{T(31.19, 676.81, "COORDINACION DE PRESUPUESTO, CONTABILIDAD", 6, { a: "start" })}{T(31.19, 665.47, "Y EVALUACION FINANCIERA", 6, { a: "start" })}
      {L(283.47, 695.62, 283.47, 661.6)}{L(283.47, 695.62, 481.89, 695.62)}{L(481.89, 695.62, 481.89, 661.6)}{L(283.47, 661.6, 481.89, 661.6)}
      {T(286.3, 688.15, "SOLICITUD ORDINARIA DE REEMBOLSO", 6, { a: "start" })}{T(286.3, 676.81, "AL FONDO FIJO Y SU APLICACION", 6, { a: "start" })}{T(286.3, 665.47, "CONTABLE PRESUPUESTAL", 6, { a: "start" })}
      {L(496.07, 695.62, 496.07, 684.28)}{L(496.07, 695.62, 581.11, 695.62)}{L(581.11, 695.62, 581.11, 684.28)}{T(538.59, 688.15, "FECHA", 6)}
      {[[496.07, "D", d], [524.41, "M", m], [552.76, "A", a]].map(([x, t, v]) => <g key={t}>{R(x, 684.28, 28.35, ALTO)}{T(x + 14.17, 676.81, t, 6)}{R(x, 672.94, 28.35, ALTO)}{T(x + 14.17, 665.47, v, 6)}</g>)}
      {celda(28.35, 650.26, 226.77, "NO. PERMANENTE DE CONTROL", 8, true)}{celda(255.12, 650.26, 198.43, "DENOMINACION", 8, true)}{celda(453.55, 650.26, 127.56, "NUMERO DE CONTROL", 8, true)}
      {celda(28.35, 638.93, 28.35, "F")}{celda(56.7, 638.93, 198.43, r.permanente)}{celda(255.12, 638.93, 198.43, r.denominacion)}{celda(453.55, 638.93, 127.56, r.numeroControl || "")}
      {celda(28.35, 627.59, 226.77, "PERIODO DE GASTOS", 8, true)}{celda(255.12, 627.59, 85.04, "COMPROBANTES", 8, true)}
      {R(340.16, 627.59, 141.73, ALTO, true)}{T(411.03, 620.12, "ACUMULADO AL REEMBOLSO ANTERIOR", 6)}{celda(481.89, 627.59, 99.21, "SOLICITUD", 8, true)}
      {celda(28.35, 616.25, 226.77, `${larga(r.periodoDe)}      AL      ${larga(r.periodoAl)}`)}{celda(255.12, 616.25, 85.04, r.comprobantes)}{celda(340.16, 616.25, 141.73, money(r.acumuladoAnterior))}
      {R(481.89, 616.25, 99.21, ALTO)}{T(531.49, 606.98, r.solicitud, 12, { b: true })}
      {celda(28.35, 593.57, 198.43, "PROVEEDOR", 8, true)}{celda(226.78, 593.57, 99.21, "FECHA DE ORIGEN", 8, true)}{celda(325.99, 593.57, 127.56, "COMPROMISO", 8, true)}{celda(453.55, 593.57, 127.56, "CONTRARECIBO", 8, true)}
      {[[28.35, 28.35, "CIRC."], [56.7, 42.52, "L o F"], [99.22, 127.56, "NUMERO"], [226.78, 28.35, "D"], [255.12, 28.35, "M"], [283.47, 42.52, "A"], [325.99, 28.35, "T"], [354.33, 99.21, "NUMERO"], [453.55, 28.35, "T"], [481.89, 99.21, "NUMERO"]].map(([x, an, t], i) => <g key={i}>{celda(x, 582.23, an, t)}</g>)}
      {R(28.35, 570.89, 28.35, ALTO)}{R(56.7, 570.89, 42.52, ALTO)}{R(99.22, 570.89, 127.56, ALTO)}{T(163, 561.62, r.proveedor, 12, { b: true })}
      {celda(226.78, 570.89, 28.35, d)}{celda(255.12, 570.89, 28.35, m)}{celda(283.47, 570.89, 42.52, a)}{R(325.99, 570.89, 28.35, ALTO)}{R(354.33, 570.89, 99.21, ALTO)}{R(453.55, 570.89, 28.35, ALTO)}{R(481.89, 570.89, 99.21, ALTO)}
      {celda(28.35, 548.22, 552.76, "REGISTRO   VARIABLE")}{celda(28.35, 536.88, 113.39, "CLAVES")}{celda(141.74, 536.88, 141.73, "LOCALIDAD UNIDAD DE SERV.")}{celda(283.47, 536.88, 127.56, "CLASIFICACION")}
      {L(411.03, 536.88, 411.03, 525.54)}{L(481.89, 536.88, 481.89, 525.54)}{L(581.11, 536.88, 581.11, 525.54)}
      {[525.54, 514.2].map((y) => <g key={y}>{COL.map((x) => <g key={x}>{L(x, y, x, y - ALTO)}</g>)}</g>)}
      {T(176.82, 518.07, "UNIDAD DE", 6)}{T(247.53, 517.47, "CENTRO")}{T(375.59, 517.47, "PARTIDA")}{T(446.45, 517.47, "CUENTA")}{T(531.49, 517.47, "IMPORTE")}
      {T(63.78, 506.13, "PRESUPUESTO")}{T(120.47, 506.13, "C  O  N")}{T(177.16, 506.73, "INFORMACION", 6)}{T(247.53, 506.13, "COSTOS")}{T(311.81, 506.13, "CUENTA")}{T(375.59, 506.13, "PRESUPUESTAL")}{T(446.45, 506.13, "COLECTIVA")}
      {filas}
      {L(COL[0], yFin, COL[5], yFin)}{L(COL[5], yFin, COL[7], yFin)}{esUltima && <>{T((COL[5] + COL[7]) / 2, yFin - 8.37, "TOTAL DEL REEMBOLSO", 9)}{R(COL[7], yFin, 99.21, ALTO, true)}{T(531.49, yFin - 8.67, money(r.total), 10, { b: true })}</>}
      {[[28.35, 283.46, r.firma, r.cargoFirma], [297.64, 581.1, r.firma2, r.cargoFirma2]].map(([x1, x2, firma, cargo]) => <g key={x1}>{L(x1, 113.39, x1, 34.02, 1.42)}{L(x1, 113.39, x2, 113.39, 1.42)}{L(x2, 113.39, x2, 34.02, 1.42)}{L(x1, 34.02, x2, 34.02, 1.42)}{T((x1 + x2) / 2, 59.36, firma, 10)}{T((x1 + x2) / 2, 49.22, cargo, 6, { i: true })}</g>)}
      {T(533.9, 25.13, `Pagina ${hoja} de ${hojas}`, 6, { a: "start" })}
    </svg>
  );
}

export default function RelacionGastos({ reembolso, logo = "/logo-relacion.jpg" }) {
  const r = { unidad: "010102", permanente: "010102 200200", denominacion: "HGZ 2", proveedor: "49051", firma: "Lic. Nayeli Alonso Orozco", cargoFirma: "Jefe de Finanzas", firma2: "Lic. José Cortez González", cargoFirma2: "Subdirector Administrativo", ...reembolso };
  const hojas = [];
  for (let i = 0; i < Math.max(r.lineas.length, 1); i += POR_HOJA) hojas.push(r.lineas.slice(i, i + POR_HOJA));
  return (
    <>
      {hojas.map((lineas, i) => <Hoja key={i} r={r} lineas={lineas} hoja={i + 1} hojas={hojas.length} esUltima={i === hojas.length - 1} logo={logo} subtotal={lineas.reduce((s, l) => s + (Number(l.importe) || 0), 0)} />)}
      <style>{`
        .hoja-relacion { display: block; width: 21.59cm; height: 27.94cm; max-width: 100%; margin: 0 auto 16px; background: #fff; }
        @page relacion { size: letter; margin: 0; }
        @media print { .hoja-relacion { page: relacion; width: 21.59cm; height: 27.94cm; max-width: none; margin: 0; break-after: page; } }
      `}</style>
    </>
  );
}
