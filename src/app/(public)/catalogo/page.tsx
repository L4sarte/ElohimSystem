import { permanentRedirect } from 'next/navigation';

/**
 * /catalogo fue unificado en /tienda (fuente autoritativa del storefront B2C).
 * Este redirect permanente (308) conserva los enlaces existentes (footer,
 * link-in-bio) y la indexación SEO apuntando a la vidriera oficial.
 */
export default function CatalogoRedirect() {
  permanentRedirect('/tienda');
}
