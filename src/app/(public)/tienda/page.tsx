import { getPublicCatalog } from '@/app/actions/storefront';
import { getSystemSettings } from '@/app/actions/systemSettings';
import { getCurrentRate } from '@/app/actions/rates';
import { StorefrontCatalogClient } from '@/components/storefront/StorefrontCatalogClient';

export const dynamic = 'force-dynamic';

export default async function TiendaPage() {
  const [catalogRes, settingsRes, rateRes] = await Promise.all([
    getPublicCatalog(),
    getSystemSettings(),
    getCurrentRate(),
  ]);

  const products = catalogRes.data || [];
  const brands = catalogRes.brands || [];
  const families = catalogRes.families || [];
  const settings = settingsRes.data;
  const exchangeRate = rateRes.data?.value_ars || 1250;

  return (
    <StorefrontCatalogClient
      initialProducts={products}
      brands={brands}
      families={families}
      settings={settings}
      exchangeRate={exchangeRate}
    />
  );
}
