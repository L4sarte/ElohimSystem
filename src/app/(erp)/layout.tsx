import { Omnibar } from "@/components/navigation/Omnibar";
import { Sidebar } from "@/components/navigation/Sidebar";

/**
 * Layout del grupo (erp): rutas internas de gestión.
 *
 * Chrome exclusivo del ERP: Sidebar (con drawer móvil integrado) + Omnibar
 * (atajos de teclado). NO se renderiza en las rutas públicas del grupo (public)
 * (/tienda, /catalogo, /login).
 *
 * Verificación de sesión: delegada al middleware (src/utils/supabase/middleware.ts),
 * que redirige fail-closed a /login toda ruta no pública sin sesión válida.
 * Se evita duplicar la consulta de autenticación aquí para no penalizar
 * cada navegación interna con queries redundantes.
 */
export default function ErpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {children}
      </div>
      <Omnibar />
    </>
  );
}
