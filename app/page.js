'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import TopNav from './components/TopNav';
import { leerTodo } from '../lib/paginar';
import { cargarAvisos } from '../lib/avisos';

const diasEntre = (desde) =>
  Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 86400000));

// ¿La factura está estancada en ese eje? (entró a su etapa actual hace más
// días que el umbral de alertas_config para ese circuito/estatus).
function ejeEstancado(hist, circuito, valor, umbralMap) {
  const propias = hist.filter((h) => h.circuito === circuito && h.estatus === valor);
  if (!propias.length) return false;
  const entrada = propias.reduce((m, h) => (h.fecha > m ? h.fecha : m), propias[0].fecha);
  const lim = umbralMap[`${circuito}:${valor}`];
  return lim != null && diasEntre(entrada) > lim;
}

export default function Portal() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [c, setC] = useState({});
  const [avisos, setAvisos] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      // Si quien entra es un jefe de servicio (por correo), va directo a su panel de validación.
      // Si es un administrador (Subdirector), va directo a su panel /admin.
      try {
        const email = (session.user?.email || '').toLowerCase();
        if (email) {
          const matricula = email.includes('@') ? email.split('@')[0] : email;
          const { data: adm } = await supabase.from('administradores').select('id')
            .or(`email.eq.${email},matricula.eq.${matricula}`).eq('activo', true).limit(1);
          if (adm && adm.length) { router.replace('/admin'); return; }
          const { data: js } = await supabase.from('jefes_servicio').select('id')
            .or(`email.eq.${email},matricula.eq.${matricula}`).eq('activo', true).limit(1);
          if (js && js.length) { router.replace('/validacion'); return; }
        }
      } catch { /* si la tabla no existe aún, seguir normal */ }

      const { data: u } = await supabase
        .from('usuarios')
        .select('nombre, rol')
        .eq('auth_id', session.user.id)
        .single();
      setUsuario(u);

      // Cuenta filas de una tabla; 0 si falla (tabla faltante, etc.).
      const n = async (tabla, filtro) => {
        try {
          let q = supabase.from(tabla).select('*', { count: 'exact', head: true });
          if (filtro) q = filtro(q);
          const { count, error } = await q;
          if (error) return 0;
          return count ?? 0;
        } catch { return 0; }
      };

      // Seguimiento: facturas activas (no 'gasto_reflejado') y estancadas
      // (cualquiera de los 3 ejes supera su umbral). Resiliente si el
      // esquema de 3 ejes aún no se migró.
      const seguimiento = async () => {
        try {
          const [rF, rA, rH] = await Promise.all([
            // Por páginas: Supabase corta en 1,000 filas (facturas e historial ya pasan de eso).
            leerTodo((d, h) => supabase.from('facturas').select('id, estatus_general, estatus_firmas, estatus_pedido_recepcion').eq('anulada', false).order('id').range(d, h)),
            leerTodo((d, h) => supabase.from('alertas_config').select('circuito, estatus, dias_umbral').range(d, h)),
            leerTodo((d, h) => supabase.from('factura_estatus_historial').select('factura_id, circuito, estatus, fecha').order('id').range(d, h)),
          ]);
          if (rF.error) return { activas: 0, estancadas: 0 };
          const umbralMap = {};
          (rA.data || []).forEach((a) => (umbralMap[`${a.circuito}:${a.estatus}`] = a.dias_umbral));
          const histByF = {};
          (rH.data || []).forEach((h) => (histByF[h.factura_id] ||= []).push(h));

          let activas = 0, estancadas = 0;
          for (const f of rF.data || []) {
            if (f.estatus_general !== 'gasto_reflejado') activas++;
            const hist = histByF[f.id] || [];
            const est =
              ejeEstancado(hist, 'general', f.estatus_general, umbralMap) ||
              ejeEstancado(hist, 'firmas', f.estatus_firmas, umbralMap) ||
              ejeEstancado(hist, 'pedido_recepcion', f.estatus_pedido_recepcion, umbralMap);
            if (est) estancadas++;
          }
          return { activas, estancadas };
        } catch { return { activas: 0, estancadas: 0 }; }
      };

      const [facturas, contratos, cuentas, seg] = await Promise.all([
        n('facturas'),
        n('contratos'),
        n('disponibilidad_presupuestal'),
        seguimiento(),
      ]);

      setC({ facturas, contratos, cuentas, activas: seg.activas, estancadas: seg.estancadas });
      setCargando(false);
      // Bandeja de avisos: se arma después para no detener el panel
      cargarAvisos().then((a) => setAvisos(a.cuentas)).catch(() => setAvisos(false));
    })();
  }, [router]);

  const salir = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (cargando) return <p className="cargando">Cargando…</p>;

  const tarjetas = [
    // ---- Facturas ----
    { grupo: 'Facturas', icon: '📋', titulo: 'Seguimiento', desc: 'Estatus general + circuitos de firmas y pedido-recepción, con alertas de estancamiento.', cifra: c.estancadas, etiqueta: `estancada(s) · ${c.activas} en seguimiento`, alerta: true, ruta: '/facturas' },
    { grupo: 'Facturas', icon: '＋', titulo: 'Capturar factura', desc: 'Ingreso de las facturas recibidas del proveedor.', cifra: c.facturas, etiqueta: 'facturas capturadas', ruta: '/facturas/nueva' },
    { grupo: 'Facturas', icon: '✔️', titulo: 'Validación del servicio', desc: 'El jefe valida las facturas que se le enviaron y genera el oficio de cumplimiento/incumplimiento.', cifra: '→', etiqueta: 'bandeja de jefes', ruta: '/validacion' },
    { grupo: 'Facturas', icon: '📨', titulo: 'Oficios emitidos', desc: 'Envío a pago, devolución y validación. Busca por folio.', cifra: '🔎', etiqueta: 'buscar por folio', ruta: '/oficios' },
    // ---- Presupuesto ----
    { grupo: 'Presupuesto', icon: '📑', titulo: 'Cédula de gasto', desc: 'Avance presupuestal por cuenta (presupuesto, gasto, pasivo, disponible) — la cédula que ya usan.', cifra: c.cuentas, etiqueta: 'cuenta(s) con datos', ruta: '/cedula' },
    { grupo: 'Presupuesto', icon: '📁', titulo: 'Contratos', desc: 'Cédula de contratos: gasto, pagos, pasivo y apoyos por contrato.', cifra: c.contratos, etiqueta: 'contratos', ruta: '/contratos' },
    { grupo: 'Presupuesto', icon: '🩺', titulo: 'Folios de subrogados', desc: 'Resumen por contrato: folios facturados, en devengo y cancelados. Entra a un contrato para ver su detalle.', cifra: '🔎', etiqueta: 'devengo y facturados', ruta: '/subrogados' },
    { grupo: 'Presupuesto', icon: '🧾', titulo: 'Dictámenes', desc: 'Suficiencia FINAT (IMKK036) por contrato y mes.', cifra: '📋', etiqueta: 'suficiencia', ruta: '/dictamenes' },
    // ---- Catálogos y reportes ----
    { grupo: 'Catálogos y reportes', icon: '📚', titulo: 'Catálogos', desc: 'Contratos, precios, proveedores, cuentas y jefaturas — editable.', cifra: '✎', etiqueta: 'editar', ruta: '/catalogos' },
    { grupo: 'Catálogos y reportes', icon: '📥', titulo: 'Cargar reportes', desc: 'Importa OOAD / FINAT (incluida la disponibilidad) para conciliar y reflejar el gasto.', cifra: '↑', etiqueta: 'OOAD · FINAT', ruta: '/comprobantes' },
    { grupo: 'Catálogos y reportes', icon: '📈', titulo: 'Exportar reportes', desc: 'Consultas financieras: facturas, vigencias… en Excel o PDF.', cifra: '📊', etiqueta: 'exportables', ruta: '/reportes' },
    { grupo: 'Catálogos y reportes', icon: '🏛', titulo: 'Panel de dirección', desc: 'Estado de la facturación por etapa y capítulo (solo consulta).', cifra: '📋', etiqueta: 'dirección', ruta: '/admin' },
  ];
  const GRUPOS = ['Facturas', 'Presupuesto', 'Catálogos y reportes'];

  // Rol AUO (ventanilla): panel simplificado, enfocado en capturar y dar
  // seguimiento (el captura ya está en el botón grande de arriba).
  const esAuo = usuario?.rol === 'auo';
  const AUO_VISIBLES = new Set(['Seguimiento', 'Oficios emitidos']);
  const visibles = esAuo ? tarjetas.filter((t) => AUO_VISIBLES.has(t.titulo)) : tarjetas;
  // Saludo de bienvenida según la hora (sin el nombre de la cuenta).
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  // Cargo según el rol, para personalizar el portal.
  const CARGO = {
    jefa_finanzas: 'Jefa del Departamento de Finanzas',
    jefe_presupuesto: 'Jefe de la Oficina de Presupuesto',
    auo: 'Ventanilla de facturación',
  };
  const cargo = CARGO[usuario?.rol] || '';
  const primerNombre = (usuario?.nombre || '').trim().split(/\s+/)[0] || '';

  return (
    <>
      <TopNav />

      <main className="contenedor">
        <h1 className="titulo">
          {saludo}{primerNombre ? `, ${primerNombre}` : ''} 👋
        </h1>
        <p className="subtitulo">
          {usuario?.nombre && cargo
            ? `${usuario.nombre} · ${cargo} — HGZ No. 02`
            : esAuo
              ? 'Captura tus facturas y dales seguimiento.'
              : 'Seguimiento de facturas desde su ingreso en ventanilla hasta que se refleja el gasto.'}
        </p>

        {esAuo && (
          <Link
            href="/facturas/nueva"
            className="boton"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 16, padding: '14px 24px', textDecoration: 'none',
              margin: '4px 0 22px',
            }}
          >
            ＋ Capturar nueva factura
          </Link>
        )}

        {!esAuo && avisos !== false && (
          <div style={{ margin: '0 0 22px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <h2 style={{ fontSize: 17, margin: 0 }}>Bandeja de avisos</h2>
              <Link href="/avisos" style={{ fontSize: 13, color: 'var(--verde)' }}>ver todo →</Link>
            </div>
            {!avisos ? <p style={{ fontSize: 13, color: 'var(--texto-suave)', margin: 0 }}>Revisando facturas, pedido-recepción y dictámenes…</p> : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { n: avisos.ampliacion + avisos.oficio, t: `contrato(s) sin dinero${avisos.oficio ? ` · ${avisos.oficio} con oficio de apoyo` : ''}${avisos.porActualizar ? ` · ${avisos.porActualizar} dictamen(es) sin IMKK036 del mes` : ''}`, color: 'var(--rojo)', ancla: 'dictamen' },
                  { n: avisos.enError, t: 'CR con error de presupuesto en FINAT', color: 'var(--rojo)', ancla: 'error' },
                  { n: avisos.ooadSinPR, t: 'en OOAD sin cumplir el candado', color: 'var(--rojo)', ancla: 'sin-pr' },
                  { n: avisos.foliosSinFacturar, t: `folio(s) de subrogados sin facturar${avisos.tocaCorteFolios ? ' · ya toca corte' : ''}`, color: '#7c3aed', ancla: 'folios' },
                  { n: avisos.conPR, t: `con pedido-recepción listo, sin mandar a OOAD${avisos.prNuevos ? ` · ${avisos.prNuevos} nuevo(s)` : ''}`, color: '#2b6cb0', ancla: 'pr' },
                  { n: avisos.listasOOAD, t: `lista(s) para mandar a OOAD${avisos.listasSinDinero ? ` · ${avisos.listasSinDinero} sin dinero en dictamen` : ''}`, color: 'var(--verde)', ancla: 'ooad' },
                ].map((x) => (
                  <Link key={x.ancla} href={`/avisos#${x.ancla}`} style={{ flex: '1 1 210px', textDecoration: 'none', color: 'inherit', background: 'var(--blanco)', border: '1px solid var(--borde)', borderLeft: `5px solid ${x.color}`, borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: x.n ? x.color : 'var(--texto-suave)' }}>{x.n}</div>
                    <div style={{ fontSize: 13 }}>{x.t}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {(esAuo
          ? [['Accesos', visibles]]
          : GRUPOS.map((g) => [g, visibles.filter((t) => t.grupo === g)]).filter(([, arr]) => arr.length)
        ).map(([grupo, arr]) => (
          <section key={grupo} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--verde)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{grupo}</span><span style={{ flex: 1, height: 1, background: 'var(--borde)' }} />
            </div>
            <div className="rejilla">
              {arr.map((t) => (
                <Link key={t.titulo} href={t.ruta} className="tarjeta" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: '#e5f3ea', color: 'var(--verde)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, marginBottom: 10 }}>{t.icon}</div>
                  <h3>{t.titulo}</h3>
                  <p>{t.desc}</p>
                  <div className={t.alerta && t.cifra > 0 ? 'cifra alerta' : 'cifra'}>{t.cifra}</div>
                  <div className="etiqueta">{t.etiqueta}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
