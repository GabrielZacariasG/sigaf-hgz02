'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function Portal() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [c, setC] = useState({});

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      const { data: u } = await supabase
        .from('usuarios')
        .select('nombre, rol')
        .eq('auth_id', session.user.id)
        .single();
      setUsuario(u);

      // Cuenta filas de una tabla. Si la tabla aún no existe (o hay
      // cualquier otro error), devuelve 0 en vez de propagar la excepción,
      // para que una tabla faltante no tumbe todo el panel.
      const n = async (tabla, filtro) => {
        try {
          let q = supabase.from(tabla).select('*', { count: 'exact', head: true });
          if (filtro) q = filtro(q);
          const { count, error } = await q;
          if (error) return 0;
          return count ?? 0;
        } catch {
          return 0;
        }
      };

      const [facturas, firmas, pedidos, cortes, contratos] = await Promise.all([
        n('facturas'),
        n('factura_paradas', q => q.is('fecha_regreso', null)),
        n('pedidos_recepcion', q => q.is('fecha_respuesta', null).is('cancelacion_confirmada', null)),
        n('ooad_cortes'),
        n('contratos'),
      ]);

      setC({ facturas, firmas, pedidos, cortes, contratos });
      setCargando(false);
    })();
  }, [router]);

  const salir = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (cargando) return <p className="cargando">Cargando…</p>;

  const tarjetas = [
    { paso: 'Paso 1', titulo: 'Ingreso de facturas', desc: 'Capturar las facturas recibidas del proveedor.', cifra: c.facturas, etiqueta: 'facturas capturadas', ruta: '/facturas/nueva', listo: true },
    { paso: 'Paso 2', titulo: 'Circuito de firmas', desc: 'Validación del servicio, administración y dirección.', cifra: c.firmas, etiqueta: 'paradas sin regresar', ruta: '/firmas', listo: false },
    { paso: 'Paso 3', titulo: 'Pedido y recepción', desc: 'Solicitudes a Abastecimiento en espera de respuesta.', cifra: c.pedidos, etiqueta: 'sin respuesta', alerta: true, ruta: '/pedidos', listo: false },
    { paso: 'Paso 4', titulo: 'Envío a OOAD', desc: 'Facturas enviadas y seguimiento del contra recibo.', cifra: c.facturas, etiqueta: 'facturas capturadas', ruta: '/ooad', listo: false },
    { paso: 'Paso 5', titulo: 'Conciliación', desc: 'Cruce diario contra el reporte de disponibilidad.', cifra: c.cortes, etiqueta: 'cortes cargados', ruta: '/conciliacion', listo: false },
    { paso: 'Consulta', titulo: 'Catálogos', desc: 'Contratos, proveedores, cuentas y jefaturas.', cifra: c.contratos, etiqueta: 'contratos vigentes', ruta: '/catalogos', listo: false },
  ];

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
        <h1 className="titulo">Panel principal</h1>
        <p className="subtitulo">
          Seguimiento de facturas desde su ingreso en ventanilla hasta que se refleja el gasto.
        </p>

        <div className="rejilla">
          {tarjetas.map(t => {
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
            // Solo las tarjetas listas navegan; las demás quedan estáticas.
            return t.listo ? (
              <Link
                key={t.titulo}
                href={t.ruta}
                className="tarjeta"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
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
