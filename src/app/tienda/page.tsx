import { getPublicCatalog } from '@/app/actions/storefront';
import { getSystemSettings } from '@/app/actions/systemSettings';
import { StorefrontCatalogClient } from '@/components/storefront/StorefrontCatalogClient';

export const dynamic = 'force-dynamic';

export default async function TiendaPage() {
  const [catalogRes, settingsRes] = await Promise.all([
    getPublicCatalog(),
    getSystemSettings(),
  ]);

  const products = catalogRes.data || [];
  const brands = catalogRes.brands || [];
  const families = catalogRes.families || [];
  const settings = settingsRes.data;

  return (
    <StorefrontCatalogClient
      initialProducts={products}
      brands={brands}
      families={families}
      settings={settings}
    />
  );
}
