/**
 * Layout del grupo (public): rutas de cara al cliente y autenticación
 * (/tienda, /catalogo, /login y seguimiento de pedidos públicos).
 *
 * Sin chrome administrativo: NO renderiza Sidebar ni Omnibar del ERP.
 * Las páginas públicas gestionan su propio header/navegación de forma
 * 100% independiente (StorefrontHeader, menú móvil propio, drawers propios).
 */
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
