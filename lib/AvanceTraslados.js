"use client";
// Avance semanal del contrato de traslado de pacientes (9/11/2026): imagen ejecutiva que se manda por correo a los jefes
// (vigencia, importe asignado HGZ 2, devengo, saldo, avance con barra, gasto promedio, proyección, economía y conclusión).
// Quien lo genera elige con qué meses se saca el gasto promedio (decisión de la jefa cada semana) o el ritmo actual
// del SCACE (devengo diario × 30). La selección se recuerda en el navegador para la siguiente semana.
import { useEffect, useMemo, useState } from "react";
import { copiarCaptura } from "./capturaContratos";
import { CUENTAN, NOMBRE_CIUDAD } from "./traslados";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MES3 = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaTxt = (f) => (f ? new Date(String(f).slice(0, 10) + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Meses de vigencia del contrato (fracción del primer y último mes), redondeado a cuartos: 24/10–31/12 → 2.25
export function mesesVigencia(c) {
  if (!c.vigencia_inicio || !c.vigencia_fin) return 0;
  const i = new Date(c.vigencia_inicio + "T00:00:00"), f = new Date(c.vigencia_fin + "T00:00:00");
  let total = 0;
  for (let d = new Date(i.getFullYear(), i.getMonth(), 1); d <= f; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const dias = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const desde = d < i ? i.getDate() : 1;
    const hasta = d.getFullYear() === f.getFullYear() && d.getMonth() === f.getMonth() ? f.getDate() : dias;
    total += (hasta - desde + 1) / dias;
  }
  return Math.round(total * 4) / 4;
}

// Texto corto de los meses elegidos: "ene, mar–jul"
function rangos(ms) {
  const s = [...ms].sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${MES3[s[i]]}–${MES3[s[j]]}` : MES3[s[i]]); i = j;
  }
  return out.join(", ");
}

// meses: [{ m, gasto, notas: [] }] del año (gasto propio de los contratos de traslados, sin apoyos a otras unidades)
// Viajes del contrato por destino: cuántos, cuántos con acompañante y cuánto cuestan (folios ya clasificados, sin FF)
export function resumenViajes(folios) {
  const v = folios.filter((f) => CUENTAN.has(f.estado));
  const g = {};
  for (const f of v) {
    const k = (g[f.ciudad] ||= { ciudad: NOMBRE_CIUDAD[f.ciudad] || f.ciudad, viajes: 0, con: 0, gasto: 0, gastoA: 0 });
    k.viajes++; k.gasto += f.valor;
    if (f.acompanante) { k.con++; k.gastoA += f.boletos ? (f.valor * f.boletosAcomp) / f.boletos : 0; }
  }
  const filas = Object.values(g).map((k) => ({ ...k, gasto: r2(k.gasto), gastoA: r2(k.gastoA) })).sort((a, b) => b.gasto - a.gasto);
  const total = filas.reduce((t, k) => ({ viajes: t.viajes + k.viajes, con: t.con + k.con, gasto: r2(t.gasto + k.gasto), gastoA: r2(t.gastoA + k.gastoA) }), { viajes: 0, con: 0, gasto: 0, gastoA: 0 });
  const fechas = v.map((f) => f.fecha_viaje).sort();
  return { filas, total, desde: fechas[0] || null, hasta: fechas[fechas.length - 1] || null };
}

// ritmo: { mensual, diario, desde, hasta, importe } o null · c, x: el contrato y su cálculo (calcularContrato)
// folios: folios del SCACE de este contrato, ya clasificados (lib/traslados)
export default function AvanceTraslados({ c, x, meses, ritmo, ultimoViaje, folios = [], onCerrar }) {
  const viajes = useMemo(() => resumenViajes(folios), [folios]);
  const clave = `sigaf-avance-traslados-${c.id}`;
  const porDefecto = useMemo(() => meses.filter((k) => !k.enCurso && k.gasto > 0.5 && !k.notas.length).map((k) => k.m), [meses]);
  const [sel, setSel] = useState(() => new Set(porDefecto));
  const [modo, setModo] = useState("meses");
  const [mesesProy, setMesesProy] = useState(() => mesesVigencia(c));
  const [msg, setMsg] = useState("");
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(clave) || "null");
      if (g?.meses) setSel(new Set(g.meses.filter((m) => meses.some((k) => k.m === m))));
      if (g?.modo === "ritmo" && ritmo) setModo("ritmo");
      if (g?.mesesProy) setMesesProy(g.mesesProy);
    } catch {}
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegidos = meses.filter((k) => sel.has(k.m));
  const promedioMeses = elegidos.length ? elegidos.reduce((s, k) => s + k.gasto, 0) / elegidos.length : 0;
  const promedio = r2(modo === "ritmo" && ritmo ? ritmo.mensual : promedioMeses);
  const criterio = modo === "ritmo" && ritmo
    ? `ritmo actual del SCACE: ${money(ritmo.importe)} del ${fechaTxt(ritmo.desde)} al ${fechaTxt(ritmo.hasta)} ÷ ${ritmo.dias} días × 30`
    : elegidos.length ? `promedio de ${rangos(sel)} ${new Date().getFullYear()} (${elegidos.length} ${elegidos.length === 1 ? "mes" : "meses"})` : "sin meses elegidos";
  const proyeccion = r2(promedio * (Number(mesesProy) || 0));
  const economia = r2(x.enlace - proyeccion);

  const generar = async () => {
    setMsg("");
    try { localStorage.setItem(clave, JSON.stringify({ meses: [...sel], modo, mesesProy: Number(mesesProy) || 0 })); } catch {}
    try {
      const cv = dibujarAvance({ c, x, promedio, proyeccion, economia, criterio, mesesProy: Number(mesesProy) || 0, ultimoViaje, viajes });
      const r = await copiarCaptura(cv, `AVANCE TRASLADOS ${new Date().toLocaleDateString("en-CA")}.png`);
      setMsg(r === "copiada" ? "Imagen copiada: pégala en el correo con Ctrl+V." : "Tu navegador no dejó copiarla; se descargó como imagen.");
    } catch (e) { setMsg("No se pudo generar: " + e.message); }
  };

  const fila = { display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", borderBottom: "1px solid var(--borde)" };
  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--blanco)", borderRadius: 12, padding: "16px 18px", width: "min(860px, 100%)", fontSize: 13, boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <strong style={{ fontSize: 16 }}>Avance para correo · {[c.numero_alterno, c.numero_interno].filter(Boolean).join(" · ")}</strong>
          <button className="boton secundario" style={{ fontSize: 12.5 }} onClick={onCerrar}>Cerrar</button>
        </div>
        <div style={{ color: "var(--texto-suave)", marginTop: 2 }}>Vigencia {fechaTxt(c.vigencia_inicio)} al {fechaTxt(c.vigencia_fin)} · último viaje cargado del SCACE: {fechaTxt(ultimoViaje)}</div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12 }}>
          <div style={{ flex: "1 1 400px" }}>
            <strong>¿Cómo se saca el gasto promedio mensual?</strong>
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}><input type="radio" checked={modo === "meses"} onChange={() => setModo("meses")} /> Promedio de los meses que elijas</label>
            <div style={{ margin: "6px 0 0 22px", opacity: modo === "meses" ? 1 : 0.45 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <button className="boton secundario" style={{ fontSize: 12, padding: "2px 8px" }} onClick={() => setSel(new Set(porDefecto))}>Sugeridos</button>
                <button className="boton secundario" style={{ fontSize: 12, padding: "2px 8px" }} onClick={() => setSel(new Set())}>Ninguno</button>
              </div>
              {meses.map((k) => (
                <label key={k.m} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "2px 0" }}>
                  <input type="checkbox" disabled={modo !== "meses"} checked={sel.has(k.m)} onChange={(e) => setSel((p) => { const n = new Set(p); e.target.checked ? n.add(k.m) : n.delete(k.m); return n; })} style={{ marginTop: 3 }} />
                  <span style={{ width: 90 }}>{MESES[k.m]}</span>
                  <span style={{ width: 120, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(k.gasto)}</span>
                  {k.notas.length > 0 && <span style={{ color: "#9a6700", fontSize: 12 }}>⚠ {k.notas.join(" · ")}</span>}
                </label>
              ))}
            </div>
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, opacity: ritmo ? 1 : 0.45 }}>
              <input type="radio" disabled={!ritmo} checked={modo === "ritmo"} onChange={() => setModo("ritmo")} />
              Ritmo actual del SCACE (devengo diario × 30){ritmo ? `: ${money(ritmo.mensual)}` : ": sin viajes cargados este mes"}
            </label>
            {ritmo && <div style={{ marginLeft: 22, color: "var(--texto-suave)", fontSize: 12 }}>{money(ritmo.importe)} del {fechaTxt(ritmo.desde)} al {fechaTxt(ritmo.hasta)} ({ritmo.dias} días) = {money(ritmo.diario)} diarios</div>}
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
              Meses de vigencia para la proyección:
              <input type="number" step="0.25" min="0" value={mesesProy} onChange={(e) => setMesesProy(e.target.value)} style={{ width: 70, padding: "3px 6px", border: "1px solid var(--borde)", borderRadius: 6 }} />
            </label>
          </div>

          <div style={{ flex: "1 1 300px", background: "var(--fondo)", borderRadius: 10, padding: "10px 12px", alignSelf: "flex-start" }}>
            <strong>Así queda</strong>
            <div style={fila}><span>Importe asignado HGZ 2</span><strong>{money(x.enlace)}</strong></div>
            <div style={fila}><span>Devengo ({x.enlace ? Math.round((x.facDev / x.enlace) * 100) : 0}%)</span><strong>{money(x.facDev)}</strong></div>
            <div style={fila}><span>Saldo del contrato</span><strong>{money(x.saldo)}</strong></div>
            <div style={fila}><span>Gasto promedio mensual</span><strong>{money(promedio)}</strong></div>
            <div style={fila}><span>Proyección al cierre (× {mesesProy})</span><strong>{money(proyeccion)}</strong></div>
            <div style={{ ...fila, borderBottom: 0 }}><span>Economía</span><strong style={{ color: economia < 0 ? "var(--rojo)" : "var(--verde)" }}>{money(economia)}</strong></div>
            <div style={{ fontSize: 11.5, color: "var(--texto-suave)", marginTop: 6 }}>Promedio: {criterio}.</div>
            <button className="boton" style={{ marginTop: 10, width: "100%" }} disabled={!promedio} onClick={generar}>📷 Generar imagen para el correo</button>
            {msg && <div style={{ marginTop: 6, color: msg.startsWith("No") ? "var(--rojo)" : "var(--verde)", fontWeight: 600 }}>{msg}</div>}
          </div>
        </div>
        {viajes.filas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <strong>Viajes del contrato del {fechaTxt(viajes.desde)} al {fechaTxt(viajes.hasta)}</strong>
            <span style={{ color: "var(--texto-suave)" }}> · {viajes.total.viajes} viajes, {viajes.total.con} con acompañante ({Math.round((viajes.total.con / (viajes.total.viajes || 1)) * 100)}%) · acompañantes {money(viajes.total.gastoA)}</span>
            <table style={{ borderCollapse: "collapse", marginTop: 4, fontSize: 12.5 }}>
              <thead><tr>{["Destino", "Viajes", "Con acompañante", "Gasto", "Gasto en acompañantes"].map((h) => <th key={h} style={{ textAlign: h === "Destino" ? "left" : "right", padding: "3px 10px", borderBottom: "1px solid var(--borde)", color: "var(--texto-suave)" }}>{h}</th>)}</tr></thead>
              <tbody>{[...viajes.filas, { ciudad: "Total", ...viajes.total }].map((k) => (
                <tr key={k.ciudad} style={{ fontWeight: k.ciudad === "Total" ? 700 : 400 }}>
                  <td style={{ padding: "3px 10px" }}>{k.ciudad}</td><td style={{ padding: "3px 10px", textAlign: "right" }}>{k.viajes}</td>
                  <td style={{ padding: "3px 10px", textAlign: "right" }}>{k.con}</td><td style={{ padding: "3px 10px", textAlign: "right" }}>{money(k.gasto)}</td>
                  <td style={{ padding: "3px 10px", textAlign: "right" }}>{money(k.gastoA)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Imagen ejecutiva del avance (para pegar en el correo semanal a los jefes)
export function dibujarAvance({ c, x, promedio, proyeccion, economia, criterio, mesesProy, ultimoViaje, viajes = null }) {
  const ESC = 2, M = 24, W = 780, GAP = 12, CW = (W - M * 2 - GAP * 2) / 3, CH = 84;
  const F = (peso, tam) => `${peso} ${tam}px Calibri, "Segoe UI", Arial, sans-serif`;
  const pctEj = x.enlace ? x.facDev / x.enlace : 0, pctPr = x.enlace ? proyeccion / x.enlace : 0;
  const nivel = economia < 0 ? "rojo" : pctPr >= 0.9 ? "ambar" : "verde";
  const COL = { verde: ["#1a6b3c", "#e6f4ea"], ambar: ["#9a6700", "#fff4d6"], rojo: ["#b42318", "#fde8e7"] };
  const [cFuerte, cSuave] = COL[nivel];
  const hoy = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  const mensaje = economia < 0
    ? `Con este ritmo faltarían ${money(-economia)} al cierre: la proyección llega al ${Math.round(pctPr * 100)}% del contrato.`
    : nivel === "ambar"
      ? `El contrato alcanza justo: la proyección llega al ${Math.round(pctPr * 100)}% y quedarían ${money(economia)}.`
      : `El contrato alcanza al cierre: la proyección llega al ${Math.round(pctPr * 100)}% y quedarían ${money(economia)} de economía.`;
  const notas = [
    `Devengo = facturas registradas + viajes del SCACE sin factura, por fecha del viaje (último viaje cargado: ${fechaTxt(ultimoViaje)}).`,
    `Gasto promedio mensual: ${criterio}. Proyección = gasto promedio × ${mesesProy} meses de vigencia. Fuente: SIGAF HGZ 2.`,
    ...(viajes?.filas.length ? ["Viajes sin fondo fijo. Con acompañante = el SCACE trae su nombre o el folio lleva más de un boleto; gasto en acompañantes = sus boletos al precio del contrato con IVA."] : []),
  ];
  const med = document.createElement("canvas").getContext("2d");
  const partir = (t, font, ancho) => { med.font = font; const out = []; let l = ""; for (const p of t.split(" ")) { const k = l ? `${l} ${p}` : p; if (med.measureText(k).width > ancho && l) { out.push(l); l = p; } else l = k; } if (l) out.push(l); return out; };
  const lineas = notas.flatMap((n) => partir(n, F(400, 11.5), W - M * 2));
  const lMsg = partir(mensaje, F(700, 14), W - M * 2 - 44);
  const conViajes = !!viajes?.filas.length, RH = 26;
  const altoViajes = conViajes ? 4 + 22 + 20 + 10 + RH * (viajes.filas.length + 2) + 18 : 0;
  const H = 104 + 74 + CH * 2 + GAP + 18 + (lMsg.length * 19 + 20) + 14 + altoViajes + lineas.length * 15 + M;
  const cv = document.createElement("canvas"); cv.width = W * ESC; cv.height = H * ESC;
  const ctx = cv.getContext("2d"); ctx.scale(ESC, ESC);
  const redondo = (x0, y0, w, h, r) => { ctx.beginPath(); ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r); ctx.arcTo(x0, y0 + h, x0, y0, r); ctx.arcTo(x0, y0, x0 + w, y0, r); ctx.closePath(); };
  const t = (s, x0, y0, font, color = "#1f2937", al = "left") => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = al; ctx.textBaseline = "alphabetic"; ctx.fillText(s, x0, y0); };
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

  // Encabezado
  ctx.fillStyle = "#2f3b48"; ctx.fillRect(0, 0, W, 6);
  t("Traslado de pacientes en autobús · avance del contrato", M, 40, F(700, 21));
  t(`${c.proveedores?.razon_social || "Autobuses de la Piedad, S.A. de C.V."} · contrato ${[c.numero_alterno, c.numero_interno].filter(Boolean).join(" · ")}`, M, 62, F(400, 13.5), "#4b5563");
  t(`HGZ No. 2 · vigencia ${fechaTxt(c.vigencia_inicio)} al ${fechaTxt(c.vigencia_fin)} · cifras al ${hoy}`, M, 81, F(400, 13.5), "#4b5563");

  // Barra de avance (ejercido) con marca de la proyección al cierre
  let y = 104;
  t("Avance del contrato", M, y + 4, F(700, 13));
  t(`${Math.round(pctEj * 100)}% ejercido · ${money(x.facDev)} de ${money(x.enlace)}`, W - M, y + 4, F(700, 13), "#1f2937", "right");
  const bx = M, by = y + 16, bw = W - M * 2, bh = 18;
  ctx.fillStyle = "#e5e7eb"; redondo(bx, by, bw, bh, 9); ctx.fill();
  if (pctEj > 0.003) { ctx.fillStyle = "#2f6fae"; redondo(bx, by, Math.max(18, Math.min(1, pctEj) * bw), bh, 9); ctx.fill(); }
  const px = bx + Math.min(1, pctPr) * bw;
  ctx.strokeStyle = cFuerte; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(px, by - 4); ctx.lineTo(px, by + bh + 4); ctx.stroke(); ctx.setLineDash([]);
  t(`Proyección al cierre: ${Math.round(pctPr * 100)}%`, Math.min(Math.max(px, M + 90), W - M - 90), by + bh + 18, F(700, 11.5), cFuerte, "center");
  y += 74;

  // Tarjetas
  const tarjeta = (i, fila, etiqueta, valor, sub, color = "#1f2937", fondo = "#f7f8fa", borde = "#e5e7eb") => {
    const x0 = M + i * (CW + GAP), y0 = y + fila * (CH + GAP);
    ctx.fillStyle = fondo; redondo(x0, y0, CW, CH, 10); ctx.fill(); ctx.strokeStyle = borde; ctx.lineWidth = 1; ctx.stroke();
    t(etiqueta.toUpperCase(), x0 + 14, y0 + 24, F(700, 11.5), "#6b7280");
    t(valor, x0 + 14, y0 + 54, F(700, 23), color);
    if (sub) t(sub, x0 + 14, y0 + 73, F(400, 11.5), "#6b7280");
  };
  tarjeta(0, 0, "Asignado HGZ 2", money(x.enlace), "importe máximo del contrato");
  tarjeta(1, 0, "Devengo", money(x.facDev), `${Math.round(pctEj * 100)}% del contrato`);
  tarjeta(2, 0, "Saldo del contrato", money(x.saldo), `${Math.round((x.enlace ? x.saldo / x.enlace : 0) * 100)}% disponible`, x.saldo < 0 ? COL.rojo[0] : "#1f2937");
  tarjeta(0, 1, "Gasto promedio mensual", money(promedio), "base de la proyección");
  tarjeta(1, 1, "Proyección al cierre", money(proyeccion), `${mesesProy} meses de vigencia · ${Math.round(pctPr * 100)}% del contrato`);
  tarjeta(2, 1, economia < 0 ? "Faltante" : "Economía", money(Math.abs(economia)), economia < 0 ? "lo que faltaría al cierre" : "lo que sobraría al cierre", cFuerte, cSuave, cSuave);
  y += CH * 2 + GAP + 18;

  // Conclusión
  const mh = lMsg.length * 19 + 20;
  ctx.fillStyle = cSuave; redondo(M, y, W - M * 2, mh, 10); ctx.fill();
  ctx.fillStyle = cFuerte; ctx.fillRect(M, y, 5, mh);
  ctx.beginPath(); ctx.arc(M + 22, y + mh / 2, 7, 0, Math.PI * 2); ctx.fill();
  lMsg.forEach((l, i) => t(l, M + 38, y + 24 + i * 19, F(700, 14), cFuerte));
  y += mh + 14;

  // Viajes por destino: cuántos llevan acompañante y cuánto cuestan
  if (conViajes) {
    const T = viajes.total, pctCon = T.viajes ? Math.round((T.con / T.viajes) * 100) : 0, pctA = T.gasto ? Math.round((T.gastoA / T.gasto) * 100) : 0;
    y += 4;
    t(`Viajes del contrato · del ${fechaTxt(viajes.desde)} al ${fechaTxt(viajes.hasta)}`, M, y + 16, F(700, 15));
    t(`${T.viajes} viajes · ${T.con} con acompañante (${pctCon}%) · los acompañantes cuestan ${money(T.gastoA)} (${pctA}% del gasto en viajes)`, M, y + 36, F(400, 13), "#4b5563");
    y += 22 + 20 + 10;
    const cols = [{ t: "Destino", w: 196, al: "left" }, { t: "Viajes", w: 96 }, { t: "Con acompañante", w: 150 }, { t: "Gasto en viajes", w: 145 }, { t: "Gasto en acompañantes", w: W - M * 2 - 196 - 96 - 150 - 145 }];
    const filaT = (vals, yy, { enc = false, tot = false, fondo = null } = {}) => {
      if (fondo) { ctx.fillStyle = fondo; ctx.fillRect(M, yy, W - M * 2, RH); }
      let xx = M;
      cols.forEach((col, i) => {
        const der = col.al !== "left";
        t(vals[i], der ? xx + col.w - 12 : xx + 12, yy + 17.5, F(enc || tot ? 700 : 400, enc ? 11.5 : 13), enc ? "#ffffff" : "#1f2937", der ? "right" : "left");
        xx += col.w;
      });
      if (!enc) { ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M, yy + RH - 0.5); ctx.lineTo(W - M, yy + RH - 0.5); ctx.stroke(); }
    };
    ctx.fillStyle = "#2f3b48"; redondo(M, y, W - M * 2, RH, 6); ctx.fill();
    filaT(cols.map((col) => col.t.toUpperCase()), y, { enc: true }); y += RH;
    viajes.filas.forEach((k, i) => { filaT([k.ciudad, String(k.viajes), `${k.con} (${k.viajes ? Math.round((k.con / k.viajes) * 100) : 0}%)`, money(k.gasto), money(k.gastoA)], y, { fondo: i % 2 ? "#f7f8fa" : null }); y += RH; });
    filaT(["Total", String(T.viajes), `${T.con} (${pctCon}%)`, money(T.gasto), money(T.gastoA)], y, { tot: true, fondo: "#eef0f3" }); y += RH;
    y += 18;
  }

  // Notas
  lineas.forEach((l, i) => t(l, M, y + 11 + i * 15, F(400, 11.5), "#6b7280"));
  return cv;
}
