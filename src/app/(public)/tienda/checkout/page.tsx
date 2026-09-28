import { getSystemSettings } from '@/app/actions/systemSettings';
import { getCurrentRate } from '@/app/actions/rates';
import { StorefrontCheckoutClient } from '@/components/storefront/StorefrontCheckoutClient';

export const dynamic = 'force-dynamic';

export default async function StorefrontCheckoutPage() {
  const [settingsRes, rateRes] = await Promise.all([
    getSystemSettings(),
    getCurrentRate(),
  ]);
  const settings = settingsRes.data;
  const exchangeRate = rateRes.data?.value_ars || 1250;

  return <StorefrontCheckoutClient settings={settings} exchangeRate={exchangeRate} />;
}
