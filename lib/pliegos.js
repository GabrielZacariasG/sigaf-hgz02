// Pliegos de comisión. Fuentes: Oficio 3534/3243 (tarifas 2026), Cláusula 100 del CCT 2025-2027 y Norma 1000-001-024.
// Lo que dice "POR CONFIRMAR" la norma no lo resuelve; se avisa y no se decide solo.

// El folio se compara sin año ni ceros: FP-09265/2026 y FP-9265 son el mismo.
const normFolio = (s) => String(s || "").split("/")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^FP0*/, "FP");

export const CUOTA_BASE = 2840.81;
export const MINIMO_HORAS = 4;
export const TIPOS_CONTRATACION = [
  { clave: "02", nombre: "02 Base" },
  { clave: "00", nombre: "00 Estatuto" },
  { clave: "01", nombre: "01 Confianza" },
  { clave: "04", nombre: "04 Nómina de mando" },
  { clave: "03", nombre: "03 Temporal" },
  { clave: "08", nombre: "08 Sustitución" },
];
export const GRUPOS = [
  { clave: "OPER", nombre: "Operativo, nómina ordinaria y Estatuto A" },
  { clave: "PK", nombre: "Grupo P (equivalentes) K" },
  { clave: "JG", nombre: "Grupo J-G" },
];
// Recorridos cortos por tramo de hora de regreso: antes de la base, base a +2:59, +3:00 a +4:59, +5:00 en adelante.
const TARIFAS_CORTAS = {
  BASE: [519, 1028.28, 1552.43, 2840.81],
  OPER: [710.2, 923.26, 1207.34, 1420.4],
  PK: [350, 490, 650, 850],
  JG: [490, 650, 850, 1425],
};
const TABLA_NOMBRE = { BASE: "personal de base", OPER: "operativo y Estatuto A", PK: "grupo P/K", JG: "grupo J-G" };
const HORA_BASE = { MAT: 17 * 60, VESP: 23 * 60, NOCT: 5 * 60 };
const INICIO_TURNO = { MAT: 7 * 60, VESP: 14 * 60 + 30, NOCT: 20 * 60 + 30 };
const TEXTO_TRAMO = ["regreso antes de la hora base", "de la hora base a +2:59", "+3:00 a +4:59", "+5:00 en adelante"];

// km de ida según la Cláusula 100. León y Fresnillo no vienen en esa tabla.
export const DESTINOS = [
  { nombre: "LEON, GTO.", corto: true },
  { nombre: "FRESNILLO, ZAC." },
  { nombre: "GUADALAJARA, JAL.", km: 237 }, { nombre: "SAN LUIS POTOSI", km: 205 }, { nombre: "QUERETARO", km: 293 },
  { nombre: "SAN MIGUEL DE ALLENDE", km: 294 }, { nombre: "MORELIA", km: 323 }, { nombre: "COLIMA", km: 426 },
  { nombre: "DURANGO", km: 427 }, { nombre: "TEPIC, NAYARIT", km: 438 }, { nombre: "TOLUCA", km: 503 },
  { nombre: "CIUDAD DE MEXICO", km: 509 }, { nombre: "MEXICO ORIENTE", km: 509 }, { nombre: "MEXICO PONIENTE", km: 509 },
  { nombre: "CD. VICTORIA, TAMPS.", km: 516.5 }, { nombre: "PTO. VALLARTA", km: 566.5 }, { nombre: "CUERNAVACA", km: 587 },
  { nombre: "MORELOS", km: 609 }, { nombre: "TLAXCALA", km: 609 }, { nombre: "OAXTEPEC", km: 610 }, { nombre: "PUEBLA, PUE.", km: 622.5 },
  { nombre: "ATLIXCO, PUEBLA", km: 644.5 }, { nombre: "MONTERREY", km: 694 }, { nombre: "MAZATLAN, SIN.", km: 707 },
  { nombre: "METEPEC, PUEBLA", km: 745 }, { nombre: "VERACRUZ", km: 901 }, { nombre: "CULIACAN", km: 920 },
  { nombre: "CHIHUAHUA", km: 959 }, { nombre: "VILLAHERMOSA, TAB.", km: 1418 },
];

export const aMinutos = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || "").trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
const dif = (de, a) => (a - de + 1440) % 1440;
const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
const dinero = (n) => `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const esTransportes = (categoria) => /CHOFER|OPERADOR/i.test(categoria || ""); // numeral 5.23

// Recorrido corto: mayor de 50 y menor de 200 km (7.5.9).
export const esCorto = (d) => !!d && (d.corto === true || (d.km > 50 && d.km < 200));

// JA y sustitutos: el turno sale de la hora de salida, no de la plantilla.
export function turnoEfectivo(jornada, salidaMin) {
  if (["MAT", "VESP", "NOCT"].includes(jornada)) return jornada;
  if (salidaMin == null) return null;
  if (salidaMin >= 420 && salidaMin < 870) return "MAT";
  if (salidaMin >= 870 && salidaMin < 1260) return "VESP";
  return "NOCT";
}

export function tramoCorto(turno, regresoMin) {
  if (HORA_BASE[turno] == null || regresoMin == null) return null;
  const horas = dif(HORA_BASE[turno], regresoMin) / 60;
  return horas >= 14 ? 0 : horas >= 5 ? 3 : horas >= 3 ? 2 : 1;
}

export function cuotaCorta(tabla, turno, regresoMin) {
  const t = tramoCorto(turno, regresoMin);
  return t == null ? null : { importe: TARIFAS_CORTAS[tabla][t], tramo: t, base: hhmm(HORA_BASE[turno]) };
}

// Cláusula 100: (km de ida y vuelta / 400 + factor), redondeado, por la cuota diaria.
const factorKm = (km) => (km < 400 ? 0 : km <= 800 ? 1.5 : km <= 1200 ? 1.31 : km <= 1600 ? 1.13 : km <= 2000 ? 0.94 : km <= 2400 ? 0.75 : km <= 2800 ? 0.56 : km <= 3200 ? 0.38 : km <= 3600 ? 0.19 : 0);
export function diasClausula100(kmIda) {
  const idaVuelta = kmIda * 2;
  return Math.round(Math.round((idaVuelta / 400) * 100) / 100 + factorKm(idaVuelta));
}

export const tablaDe = (tc, gj) => (["02", "03", "08"].includes(tc) ? "BASE" : TARIFAS_CORTAS[gj] ? gj : null);

// Revisa un pliego. Cada aviso es "bloquea" (no deja guardar) o "avisa" (deja guardar, pero se ve).
export function revisarPliego(p, persona, destino, capturados = [], hoy = new Date().toISOString().slice(0, 10)) {
  const av = [];
  const bloquea = (t) => av.push({ nivel: "bloquea", t });
  const avisa = (t) => av.push({ nivel: "avisa", t });
  const [sa, ll, sd, re] = [p.salida, p.llegada, p.salidaDestino, p.regreso].map(aMinutos);
  const importe = p.importe === "" || p.importe == null ? null : Number(p.importe);
  const folio = normFolio(p.folio);
  const anio = String(p.fecha || "").slice(0, 4);
  const acompanante = p.calidad === "ACOMPANANTE";
  const transportes = esTransportes(persona?.categoria) && !acompanante;

  if (!folio) bloquea("Falta el folio.");
  if (folio && capturados.some((c) => c.folioNorm === folio && c.anio === anio)) bloquea(`El folio ${p.folio} ya está capturado este año.`);
  if (!persona) bloquea("La matrícula no está en la plantilla de comisionados.");
  if (!destino) bloquea("Elige el destino del catálogo.");
  if (!p.fecha) bloquea("Falta la fecha del viaje.");
  if (p.fecha && p.fecha > hoy) bloquea("La fecha del viaje es futura.");
  if (p.fecha && p.recibido && p.recibido < p.fecha) bloquea("Se recibió en Finanzas antes de la fecha del viaje.");
  if (p.recibido && p.pago && p.pago < p.recibido) bloquea("La fecha de pago es anterior a la de recepción.");
  if (persona && !p.tc) bloquea("Falta el tipo de contratación del pliego.");
  if (persona && p.fecha) {
    const otro = capturados.find((c) => c.matricula === p.matricula && c.fecha === p.fecha);
    if (otro) bloquea(`Ya tiene el folio ${otro.folio} ese día: corresponde un solo pliego por día (Norma 7.5.7).`);
  }

  const tabla = tablaDe(p.tc, p.gj);
  if (p.tc && !tabla) bloquea("Elige el grupo jerárquico del pliego.");

  const faltanHoras = [sa, ll, sd, re].some((h) => h == null);
  if (faltanHoras) bloquea("Faltan horas: sin las cuatro no se puede calcular la cuota.");
  let duracion = null;
  if (!faltanHoras) {
    duracion = dif(sa, re) / 60;
    if (dif(sa, ll) + dif(ll, sd) + dif(sd, re) >= 1440) bloquea("Las horas no siguen el orden salida → llegada → salida del destino → regreso.");
    if (duracion < MINIMO_HORAS) avisa(`Duró ${hhmm(Math.round(duracion * 60))} h, menos del mínimo de ${MINIMO_HORAS} h (Norma 7.5.9).`);
  }

  if (acompanante) {
    const fc = normFolio(p.folioChofer);
    if (!fc) avisa("Acompañante: falta el pliego del chofer y la copia del peaje; sin ellos se descuenta un día (Norma 7.4.11).");
    else {
      const chofer = capturados.find((c) => c.folioNorm === fc && c.anio === anio);
      if (!chofer) avisa(`El pliego del chofer ${p.folioChofer} todavía no está capturado.`);
      else if (chofer.destino !== p.destino || chofer.fecha !== p.fecha) avisa(`El pliego del chofer ${p.folioChofer} es de otro día o destino.`);
    }
  }

  const turno = persona ? turnoEfectivo(persona.jornada, sa) : null;
  if (persona && !["MAT", "VESP", "NOCT", "JA"].includes(persona.jornada) && sa != null) avisa(`POR CONFIRMAR: a ${persona.jornada === "SUPLENTE" ? "suplentes" : "sustitutos"} se les deduce el turno por la salida; la nota oficial solo habla de jornada acumulada.`);

  let cuota = null, detalle = "";
  if (destino && esCorto(destino) && tabla && turno && re != null) {
    const c = cuotaCorta(tabla, turno, re);
    cuota = c.importe;
    detalle = `Tabla ${TABLA_NOMBRE[tabla]}. Turno ${turno}, hora base ${c.base}: ${TEXTO_TRAMO[c.tramo]}.`;
    if (tabla !== "BASE" && duracion != null && duracion >= 8) {
      cuota = TARIFAS_CORTAS[tabla][3];
      detalle = `Tabla ${TABLA_NOMBRE[tabla]}. Duró 8 h o más: aplica el Apéndice C.`;
    }
    const inicio = INICIO_TURNO[turno];
    if (sa != null && c.tramo === 0 && dif(sa, inicio) > 0 && dif(sa, inicio) < 720) avisa(`POR CONFIRMAR: salió antes de iniciar su turno (${hhmm(inicio)}) y la tabla solo mira el regreso.`);
    // Como se maneja hoy: en corto, el acompañante de base cobra lo mismo que el chofer de ese viaje.
    const fcNorm = normFolio(p.folioChofer);
    const delChofer = acompanante && tabla === "BASE" ? capturados.find((x) => x.folioNorm === fcNorm && x.anio === anio && x.destino === p.destino && x.fecha === p.fecha) : null;
    if (delChofer) {
      const suTurno = cuota;
      cuota = delChofer.importe ?? delChofer.total;
      detalle = `Acompañante: mismo importe que el chofer (${delChofer.folio}), como se maneja hoy.`;
      if (Math.abs(suTurno - cuota) > 0.01) avisa(`POR CONFIRMAR: por su propio turno serían ${dinero(suTurno)}; se usa el importe del chofer.`);
    } else if (acompanante && tabla === "BASE") avisa("Sin el pliego del chofer, la cuota se calcula con su propio turno.");
  } else if (destino && !esCorto(destino)) {
    if (!destino.km) detalle = "Este destino no viene en la Cláusula 100: captura sus kilómetros para saber si es recorrido corto. POR CONFIRMAR.";
    else if (transportes && tabla === "BASE") {
      const d = diasClausula100(destino.km);
      cuota = Math.round(d * CUOTA_BASE * 100) / 100;
      detalle = `Cláusula 100: ${destino.km * 2} km de ida y vuelta = ${d} días × ${dinero(CUOTA_BASE)}.`;
    } else if (tabla === "BASE") {
      cuota = CUOTA_BASE;
      detalle = "No es personal de transportes: un día de cuota, sin kilometraje.";
      avisa("POR CONFIRMAR: sin pernocta, la Norma 7.5.6 habla de hasta 50% conforme al grupo jerárquico; no queda claro para personal de base.");
    } else if (tabla) detalle = "Viaje largo de Estatuto, confianza o mando: va por grupo jerárquico (Apéndice A), según días y nivel de cuota. POR CONFIRMAR.";
  }
  if (cuota != null && importe != null && Math.abs(importe - cuota) > 0.01) {
    if (String(p.motivo || "").trim()) avisa(`Importe distinto de la cuota: ${importe > cuota ? "de más" : "de menos"} ${dinero(Math.abs(importe - cuota))}. Motivo: ${p.motivo}`);
    else bloquea(`El importe difiere de la cuota por ${importe > cuota ? "+" : "-"}${dinero(Math.abs(importe - cuota))}: escribe el motivo.`);
  }
  if (importe == null) bloquea("Falta el importe a pagar.");
  if (p.infarto === "SI" && (!String(p.paciente || "").trim() || !String(p.tp01 || "").trim())) avisa("Código infarto: faltan paciente y folio TP01.");

  const total = (importe || 0) + (Number(p.casetas) || 0) + (Number(p.boletos) || 0);
  return { avisos: av, puedeGuardar: !av.some((a) => a.nivel === "bloquea"), turno, cuota, detalle, duracion, total, tabla };
}
