'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

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

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      // Si quien entra es un jefe de servicio (por correo), va directo a su panel de validación.
      try {
        const email = (session.user?.email || '').toLowerCase();
        if (email) {
          const matricula = email.includes('@') ? email.split('@')[0] : email;
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
            supabase.from('facturas').select('id, estatus_general, estatus_firmas, estatus_pedido_recepcion'),
            supabase.from('alertas_config').select('circuito, estatus, dias_umbral'),
            supabase.from('factura_estatus_historial').select('factura_id, circuito, estatus, fecha'),
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
    })();
  }, [router]);

  const salir = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (cargando) return <p className="cargando">Cargando…</p>;

  const tarjetas = [
    {
      paso: 'Paso 1', titulo: 'Ingreso de facturas',
      desc: 'Capturar las facturas recibidas del proveedor.',
      cifra: c.facturas, etiqueta: 'facturas capturadas',
      ruta: '/facturas/nueva', listo: true,
    },
    {
      paso: 'Paso 2', titulo: 'Seguimiento de facturas',
      desc: 'Estatus general + circuitos de firmas y pedido-recepción, con alertas de estancamiento.',
      cifra: c.estancadas, etiqueta: `estancada(s) · ${c.activas} en seguimiento`,
      alerta: true, ruta: '/facturas', listo: true,
    },
    {
      paso: 'Paso 3', titulo: 'Disponibilidad presupuestal',
      desc: 'Gasto real vs FINAT por cuenta, con partición pasivo / ejercicio corriente.',
      cifra: c.cuentas, etiqueta: 'cuenta(s) con datos',
      ruta: '/disponibilidad', listo: true,
    },
    {
      paso: 'Servicio', titulo: 'Validación del servicio',
      desc: 'El jefe de servicio valida las facturas que se le enviaron y genera el oficio de cumplimiento/incumplimiento.',
      cifra: c.facturas, etiqueta: 'facturas', ruta: '/validacion', listo: true,
    },
    {
      paso: 'Automatizar', titulo: 'Conciliar reportes',
      desc: 'Sube los reportes de OOAD/PREI y SIGAF rellena el comprobante, marca pagadas y avanza el estatus solo.',
      cifra: c.facturas, etiqueta: 'facturas a conciliar',
      ruta: '/conciliar', listo: true,
    },
    {
      paso: 'Consulta', titulo: 'Oficios emitidos',
      desc: 'Busca por folio los oficios de envío a pago, devolución y envío a servicio ya generados.',
      cifra: '🔎', etiqueta: 'buscar por folio',
      ruta: '/oficios', listo: true,
    },
    {
      paso: 'Consulta', titulo: 'Catálogos',
      desc: 'Contratos, proveedores, cuentas y jefaturas.',
      cifra: c.contratos, etiqueta: 'contratos',
      ruta: '/catalogos', listo: false,
    },
  ];

  // Rol AUO (ventanilla): panel simplificado, enfocado en capturar y dar
  // seguimiento. Sin conciliación, catálogos ni disponibilidad presupuestal.
  const esAuo = usuario?.rol === 'auo';
  // El "Ingreso de facturas" ya está cubierto por el botón grande "Capturar
  // nueva factura", así que solo quedan estas dos tarjetas.
  const AUO_VISIBLES = new Set([
    'Seguimiento de facturas',
    'Oficios emitidos',
  ]);
  const visibles = esAuo ? tarjetas.filter((t) => AUO_VISIBLES.has(t.titulo)) : tarjetas;
  // Saludo de bienvenida según la hora (sin el nombre de la cuenta).
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <>
      <header className="encabezado">
        <div>
          <div className="marca">SIGAF</div>
          <div className="sede">Hospital General de Zona No. 02 · Oficina de Presupuesto</div>
        </div>
        <div className="usuario">
          <span>{usuario?.nombre}</span>
          <button className="boton secundario" onClick={salir}>Salir</button>
        </div>
      </header>

      <main className="contenedor">
        <h1 className="titulo">
          {esAuo ? `${saludo} 👋` : 'Panel principal'}
        </h1>
        <p className="subtitulo">
          {esAuo
            ? 'Captura tus facturas y dales seguimiento. Eso es todo lo que necesitas aquí.'
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

        <div className="rejilla">
          {visibles.map(t => {
            const cuerpo = (
              <>
                <div className="paso">{t.paso}</div>
                <h3>{t.titulo}</h3>
                <p>{t.desc}</p>
                <div className={t.alerta && t.cifra > 0 ? 'cifra alerta' : 'cifra'}>{t.cifra}</div>
                <div className="etiqueta">{t.etiqueta}</div>
                {!t.listo && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--texto-suave)' }}>
                    En construcción
                  </div>
                )}
              </>
            );
            return t.listo ? (
              <Link key={t.titulo} href={t.ruta} className="tarjeta" style={{ textDecoration: 'none', color: 'inherit' }}>
                {cuerpo}
              </Link>
            ) : (
              <div key={t.titulo} className="tarjeta" style={{ opacity: .75 }}>
                {cuerpo}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
