"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

// Navegación unificada de SIGAF. Se usa igual en la home y en todas las
// pantallas internas. Detecta el rol y muestra SOLO lo que le toca a cada
// quien (Presupuesto/Finanzas, AUO/ventanilla, Jefe de servicio, Dirección).

const CARGO = {
  jefa_finanzas: "Jefa del Departamento de Finanzas",
  jefe_presupuesto: "Jefe de la Oficina de Presupuesto",
  auo: "Ventanilla de facturación",
};

// Menús por rol. Un item con `items` es un desplegable.
function menuPara(perfil) {
  if (perfil === "admin") return [{ label: "Panel de dirección", href: "/admin", icon: "📊" }];
  if (perfil === "jefe") return [{ label: "Validación del servicio", href: "/validacion", icon: "✔️" }];
  if (perfil === "auo") return [
    { label: "Inicio", href: "/", icon: "◧" },
    { label: "Facturas", icon: "🧾", items: [
      { label: "Capturar factura", href: "/facturas/nueva", desc: "Ingreso de ventanilla" },
      { label: "Seguimiento", href: "/facturas", desc: "Dónde va cada factura" },
    ] },
    { label: "Oficios", href: "/oficios", icon: "📨" },
  ];
  // Presupuesto / Finanzas (completo)
  return [
    { label: "Inicio", href: "/", icon: "◧" },
    { label: "Facturas", icon: "🧾", items: [
      { label: "Seguimiento", href: "/facturas", desc: "Estatus y circuitos de firmas" },
      { label: "Capturar factura", href: "/facturas/nueva", desc: "Ingreso de ventanilla" },
      { label: "Validación del servicio", href: "/validacion", desc: "Cumplimiento / incumplimiento" },
      { label: "Oficios emitidos", href: "/oficios", desc: "Buscar por folio" },
    ] },
    { label: "Presupuesto", icon: "💰", items: [
      { label: "Cédula de gasto", href: "/cedula", desc: "Avance presupuestal (lo que se usa)" },
      { label: "Contratos", href: "/contratos", desc: "Cédula de contratos y apoyos" },
      { label: "Dictámenes", href: "/dictamenes", desc: "Suficiencia FINAT (IMKK036)" },
      { label: "Fondo fijo", href: "/fondo-fijo", desc: "Pliegos, otras cuentas y reembolsos" },
    ] },
    { label: "Catálogos", href: "/catalogos", icon: "📚" },
    { label: "Reportes", icon: "📈", items: [
      { label: "Cargar reportes", href: "/comprobantes", desc: "OOAD / FINAT + disponibilidad" },
      { label: "Exportar reportes", href: "/reportes", desc: "Consultas en Excel o PDF" },
    ] },
  ];
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [perfil, setPerfil] = useState("full");
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [abierto, setAbierto] = useState(null); // índice del desplegable abierto
  const ref = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = (session?.user?.email || "").toLowerCase();
        const matricula = email.includes("@") ? email.split("@")[0] : email;
        if (email) {
          const { data: adm } = await supabase.from("administradores").select("nombre, cargo")
            .or(`email.eq.${email},matricula.eq.${matricula}`).eq("activo", true).limit(1);
          if (adm && adm.length) { setPerfil("admin"); setNombre(adm[0].nombre || ""); setCargo(adm[0].cargo || ""); return; }
          const { data: js } = await supabase.from("jefes_servicio").select("nombre, cargo, jefatura")
            .or(`email.eq.${email},matricula.eq.${matricula}`).eq("activo", true).limit(1);
          if (js && js.length) {
            setPerfil("jefe");
            setNombre([js[0].cargo, js[0].nombre].filter(Boolean).join(" "));
            setCargo(js[0].jefatura ? `Jefatura de ${js[0].jefatura}` : "Jefe(a) de servicio");
            return;
          }
        }
        const { data: u } = await supabase.from("usuarios").select("nombre, rol")
          .eq("auth_id", session?.user?.id).maybeSingle();
        setPerfil(u?.rol === "auo" ? "auo" : "full");
        setNombre(u?.nombre || session?.user?.email || "Usuario");
        setCargo(CARGO[u?.rol] || "");
      } catch { setPerfil("full"); }
    })();
  }, []);

  // Cerrar el desplegable al hacer clic fuera.
  useEffect(() => {
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(null); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);
  // Cerrar al cambiar de ruta.
  useEffect(() => { setAbierto(null); }, [pathname]);

  async function salir() { await supabase.auth.signOut(); router.replace("/login"); }

  const menu = menuPara(perfil);
  const activo = (m) => {
    if (m.href) return m.href === "/" ? pathname === "/" : pathname.startsWith(m.href);
    return (m.items || []).some((it) => pathname.startsWith(it.href));
  };

  const linkBase = { color: "#eafff4", textDecoration: "none", fontSize: 13.5, padding: "8px 13px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "none", background: "transparent", fontFamily: "inherit" };
  const linkAct = { background: "rgba(255,255,255,0.17)", color: "#fff", fontWeight: 700 };

  return (
    <header ref={ref} style={{ position: "sticky", top: 0, zIndex: 20, background: "linear-gradient(90deg,#0b5d3b,#0e6b44)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 56, boxShadow: "0 2px 10px rgba(0,0,0,0.12)" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Link href={perfil === "admin" ? "/admin" : perfil === "jefe" ? "/validacion" : "/"} style={{ color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: 9, marginRight: 22 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7fd1a6" }} />
          <strong style={{ fontSize: 15, letterSpacing: 0.2 }}>SIGAF · HGZ No. 02</strong>
        </Link>
        <nav style={{ display: "flex", gap: 3 }}>
          {menu.map((m, i) => m.items ? (
            <div key={m.label} style={{ position: "relative" }}>
              <button onClick={() => setAbierto(abierto === i ? null : i)} style={{ ...linkBase, ...(activo(m) ? linkAct : {}) }}>
                <span>{m.icon}</span>{m.label}<span style={{ fontSize: 10, opacity: 0.8 }}>▾</span>
              </button>
              {abierto === i && (
                <div style={{ position: "absolute", top: 46, left: 0, background: "#fff", border: "1px solid #e2e7e4", borderRadius: 12, boxShadow: "0 14px 40px rgba(0,0,0,0.18)", padding: 8, width: 268, zIndex: 30 }}>
                  {m.items.map((it) => (
                    <Link key={it.href} href={it.href} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 11px", borderRadius: 9, textDecoration: "none", color: "#1c2521", background: pathname.startsWith(it.href) ? "#eef7f1" : "transparent" }}>
                      <span style={{ fontSize: 13.5 }}>
                        <b style={{ display: "block" }}>{it.label}</b>
                        {it.desc && <span style={{ fontSize: 11.5, color: "#6b776f" }}>{it.desc}</span>}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link key={m.label} href={m.href} style={{ ...linkBase, ...(activo(m) ? linkAct : {}) }}>
              <span>{m.icon}</span>{m.label}
            </Link>
          ))}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ textAlign: "right", lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{nombre || "Usuario"}</div>
          {cargo && <div style={{ fontSize: 11, opacity: 0.82 }}>{cargo}</div>}
        </div>
        <button onClick={salir} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.55)", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Salir</button>
      </div>
    </header>
  );
}
