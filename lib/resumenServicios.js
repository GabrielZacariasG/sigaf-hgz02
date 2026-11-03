// Resumen de la etapa "En Servicio" para reuniones: qué facturas tiene cada servicio, con qué oficio
// se llevaron y desde cuándo. Parte de las mismas filas que la tarjeta de Seguimiento, para que cuadre con ella.

const GENERICO = /correspondiente/i;
const nk = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const dia = (iso) => String(iso || "").slice(0, 10);
const diasDesde = (iso, hoy) => (iso ? Math.max(0, Math.floor((hoy - new Date(iso).getTime()) / 86400000)) : null);
const SIN_SERVICIO = "Sin servicio identificado";
const CE_DESTINO = { abastecimiento: "Lic. Juan Ramón", administrador: "Subdirector Administrativo" };

// filas: facturas de Seguimiento (con etapa, fir.entrada, fir.estancada); oficios: los de tipo envio_servicio, del más viejo
// al más nuevo; provJefes: razón social normalizada -> [{ nombre, jefatura }].
export function armarResumenServicios(filas, oficios, provJefes, hoy = Date.now()) {
  const jefaturas = {};
  Object.values(provJefes || {}).flat().forEach((j) => { if (j.jefatura) jefaturas[j.nombre] = j.jefatura; });
  const oficiosDe = {};
  (oficios || []).forEach((o) => (o.factura_ids || []).forEach((id) => (oficiosDe[id] ||= []).push(o)));

  const servicios = {};
  const pendientes = { n: 0, monto: 0, sinOficio: 0, sinFecha: 0, servicios: [] };
  const validadas = { n: 0, monto: 0, filas: [] };

  for (const f of filas) {
    if (f.etapa !== "servicio") continue;
    const importe = Number(f.importe_factura) || 0;
    const delFolio = oficiosDe[f.id] || [];
    const ultimo = delFolio[delFolio.length - 1];
    // Una factura puede ir a varios jefes el mismo día; los oficios vigentes son los de su último envío.
    const vigentes = ultimo ? delFolio.filter((o) => dia(o.created_at) === dia(ultimo.created_at)) : [];
    const reenvio = ultimo && dia(delFolio[0].created_at) !== dia(ultimo.created_at) ? delFolio[0].created_at : null;

    if (f.estatus_firmas !== "envio_firmas_servicio") {
      const desde = f.fir?.entrada || null;
      validadas.n++; validadas.monto += importe;
      validadas.filas.push({ factura: f, importe, oficio: vigentes.map((o) => o.folio).join(", "), desde, dias: diasDesde(desde, hoy) });
      continue;
    }

    const nombrados = [...new Set(vigentes.map((o) => o.destinatario).filter((d) => d && !GENERICO.test(d)))];
    const catalogo = (provJefes?.[nk(f.prov)] || []).map((j) => j.nombre);
    const ce = CE_DESTINO[f.ce_destino];
    const destinos = nombrados.length ? nombrados : ce ? [ce] : catalogo.length ? catalogo : [SIN_SERVICIO];
    const desde = ultimo?.created_at || f.fir?.entrada || null;
    const dias = diasDesde(desde, hoy);

    pendientes.n++; pendientes.monto += importe;
    if (!ultimo) pendientes.sinOficio++;
    if (!desde) pendientes.sinFecha++;
    for (const nombre of destinos) {
      const s = (servicios[nombre] ||= { nombre, jefatura: jefaturas[nombre] || "", n: 0, monto: 0, maxDias: null, sinFecha: 0, filas: [] });
      s.n++; s.monto += importe;
      if (dias != null && (s.maxDias == null || dias > s.maxDias)) s.maxDias = dias;
      if (dias == null) s.sinFecha++;
      s.filas.push({
        factura: f, importe, desde, dias, reenvio,
        oficio: vigentes.find((o) => o.destinatario === nombre)?.folio || vigentes[0]?.folio || "",
        compartida: destinos.length > 1,
      });
    }
  }

  // Lo más viejo primero; lo que no tiene fecha va antes, porque es lo que hay que aclarar.
  const porAntiguedad = (a, b) => (a.dias == null ? -1 : b.dias == null ? 1 : b.dias - a.dias);
  pendientes.servicios = Object.values(servicios).sort((a, b) => (b.maxDias ?? -1) - (a.maxDias ?? -1) || b.monto - a.monto);
  pendientes.servicios.forEach((s) => s.filas.sort(porAntiguedad));
  validadas.filas.sort(porAntiguedad);

  return { n: pendientes.n + validadas.n, monto: pendientes.monto + validadas.monto, pendientes, validadas };
}
