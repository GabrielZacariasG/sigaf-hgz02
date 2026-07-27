'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: clave,
    });
    if (error) {
      setError('Correo o contraseña incorrectos.');
      setCargando(false);
      return;
    }
    router.replace('/');
  };

  return (
    <div className="pantalla-acceso">
      <form className="caja-acceso" onSubmit={entrar}>
        <div className="acceso-marca">SIGAF</div>
        <div className="acceso-nombre">
          Sistema Integral de Gestión y Avance de Facturación
        </div>
        <div className="acceso-sede">Hospital General de Zona No. 02</div>

        <div className="acceso-linea" />

        {error && <div className="aviso error">{error}</div>}

        <div className="campo">
          <label htmlFor="correo">Correo institucional</label>
          <input
            id="correo"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="nombre.apellido@imss.gob.mx"
            required
            autoComplete="username"
          />
        </div>

        <div className="campo">
          <label htmlFor="clave">Contraseña</label>
          <input
            id="clave"
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <button className="boton" style={{ width: '100%' }} disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="acceso-pie">Uso exclusivo del personal autorizado</div>
      </form>
    </div>
  );
}
