"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [modo, setModo] = useState("login"); // 'login' | 'crear_password' | 'listo'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  // Cuando alguien llega desde el link de invitación/recuperación de
  // Supabase, la URL trae los datos de sesión en el "hash" (#...).
  // Si detectamos eso, mostramos el formulario de "crea tu contraseña"
  // en vez del login normal.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=invite")) {
      setModo("crear_password");
    } else if (hash && hash.includes("type=recovery")) {
      setModo("crear_password");
    }
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setCargando(true);
    setMensaje("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) {
      setMensaje("No se pudo iniciar sesión: " + error.message);
    } else {
      window.location.href = "/";
    }
  }

  async function handleCrearPassword(e) {
    e.preventDefault();
    setCargando(true);
    setMensaje("");
    const { error } = await supabase.auth.updateUser({ password });
    setCargando(false);
    if (error) {
      setMensaje("No se pudo guardar la contraseña: " + error.message);
    } else {
      setModo("listo");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: 340,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e2e4e2",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "var(--sigaf-verde)",
            padding: "24px 20px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#fff" }}>
            SIGAF
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
            HGZ No. 02 · Departamento de Finanzas
          </p>
        </div>

        <div style={{ padding: 24 }}>
          {modo === "login" && (
            <form onSubmit={handleLogin}>
              <label style={{ fontSize: 12, color: "#5a615e" }}>Correo institucional</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre.apellido@imss.gob.mx"
              />
              <div style={{ height: 14 }} />
              <label style={{ fontSize: 12, color: "#5a615e" }}>Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div style={{ height: 18 }} />
              <button
                type="submit"
                disabled={cargando}
                style={{ width: "100%", background: "var(--sigaf-verde)", color: "#fff", border: "none" }}
              >
                {cargando ? "Entrando..." : "Ingresar"}
              </button>
            </form>
          )}

          {modo === "crear_password" && (
            <form onSubmit={handleCrearPassword}>
              <p style={{ fontSize: 13, color: "#5a615e", marginTop: 0 }}>
                Bienvenido/a. Crea tu contraseña para SIGAF.
              </p>
              <label style={{ fontSize: 12, color: "#5a615e" }}>Nueva contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div style={{ height: 18 }} />
              <button
                type="submit"
                disabled={cargando}
                style={{ width: "100%", background: "var(--sigaf-verde)", color: "#fff", border: "none" }}
              >
                {cargando ? "Guardando..." : "Guardar contraseña"}
              </button>
            </form>
          )}

          {modo === "listo" && (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#085041" }}>
                Contraseña creada. Ya puedes iniciar sesión.
              </p>
              <button
                onClick={() => {
                  setModo("login");
                  setPassword("");
                }}
                style={{ width: "100%", background: "var(--sigaf-verde)", color: "#fff", border: "none" }}
              >
                Ir al login
              </button>
            </div>
          )}

          {mensaje && (
            <p style={{ fontSize: 12, color: "var(--sigaf-error)", marginTop: 14 }}>
              {mensaje}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
