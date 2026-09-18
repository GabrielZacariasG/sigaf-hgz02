"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

// Layout protegido: envuelve a todas las páginas del grupo (protegido).
// Solo renderiza su contenido si hay una sesión activa; si no, manda al
// login. Incluye el encabezado institucional fijo con el usuario y el
// botón de cerrar sesión.
export default function ProtegidoLayout({ children }) {
  const [estado, setEstado] = useState("verificando"); // 'verificando' | 'ok'
  const [usuario, setUsuario] = useState(null);
  const [esAdmin, setEsAdmin] = useState(null);   // null=desconocido, true/false
  const [nombreAdmin, setNombreAdmin] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let activo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      if (data.session) {
        setUsuario(data.session.user);
        setEstado("ok");
      } else {
        router.replace("/login");
      }
    });

    // Reaccionamos a cambios de sesión. Solo expulsamos al login cuando el
    // usuario CIERRA sesión explícitamente; los estados nulos transitorios
    // (renovación de token, cambio de pestaña) NO deben sacar de la app.
    const { data: sub } = supabase.auth.onAuthStateChange((evento, session) => {
      if (!activo) return;
      if (session) {
        setUsuario(session.user);
        setEstado("ok");
      } else if (evento === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  // Mantener la sesión viva: renovar el token periódicamente y al volver a la
  // pestaña, para que NO expire durante trabajos largos (capturas extensas).
  useEffect(() => {
    const refrescar = () => { supabase.auth.refreshSession().catch(() => {}); };
    const id = setInterval(refrescar, 10 * 60 * 1000); // cada 10 minutos
    const onFocus = () => refrescar();
    const onVis = () => { if (document.visibilityState === "visible") refrescar(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // ¿El usuario es un administrador (Subdirector)? Solo puede estar en /admin.
  useEffect(() => {
    if (!usuario) return;
    (async () => {
      try {
        const email = (usuario.email || "").toLowerCase();
        const matricula = email.includes("@") ? email.split("@")[0] : email;
        const { data } = await supabase.from("administradores").select("nombre")
          .or(`email.eq.${email},matricula.eq.${matricula}`).eq("activo", true).limit(1);
        if (data && data.length) { setEsAdmin(true); setNombreAdmin(data[0].nombre || ""); }
        else setEsAdmin(false);
      } catch { setEsAdmin(false); }
    })();
  }, [usuario]);

  // Candado: un administrador solo puede estar en /admin (si va a otra, regresa).
  useEffect(() => {
    if (esAdmin === true && pathname && pathname !== "/admin") router.replace("/admin");
  }, [esAdmin, pathname, router]);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (estado === "verificando") {
    return <p style={{ padding: 40 }}>Cargando...</p>;
  }

  // Nombre a mostrar: preferimos metadatos, con el correo como respaldo.
  const nombre =
    usuario?.user_metadata?.nombre ||
    usuario?.user_metadata?.full_name ||
    usuario?.user_metadata?.name ||
    usuario?.email ||
    "Usuario";

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--verde)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href={esAdmin ? "/admin" : "/"} style={{ color: "#fff", textDecoration: "none" }}>
            <strong style={{ fontSize: 15, letterSpacing: 0.2 }}>
              SIGAF · HGZ No. 02
            </strong>
          </Link>
          {esAdmin === false && (
            <>
              <Link href="/" style={{ color: "#fff", fontSize: 13, textDecoration: "none", opacity: 0.9 }}>Panel</Link>
              <Link href="/facturas" style={{ color: "#fff", fontSize: 13, textDecoration: "none", opacity: 0.9 }}>Facturas</Link>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
            {nombreAdmin || nombre}
          </span>
          <button
            onClick={cerrarSesion}
            style={{
              background: "transparent",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.6)",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
