"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [status, setStatus] = useState("checking");
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStatus("ok");
      } else {
        router.replace("/login");
      }
    });
  }, [router]);

  if (status === "checking") {
    return <p style={{ padding: 40 }}>Cargando...</p>;
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Bienvenido a SIGAF</h1>
      <p>Sesión iniciada correctamente.</p>
    </div>
  );
}
