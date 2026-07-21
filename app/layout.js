import "./globals.css";

export const metadata = {
  title: "SIGAF · HGZ No. 02",
  description: "Sistema Integral de Gestión y Avance de Facturación",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
