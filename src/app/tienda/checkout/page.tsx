import { getSystemSettings } from '@/app/actions/systemSettings';
import { StorefrontCheckoutClient } from '@/components/storefront/StorefrontCheckoutClient';

export const dynamic = 'force-dynamic';

export default async function StorefrontCheckoutPage() {
  const settingsRes = await getSystemSettings();
  const settings = settingsRes.data;

  return <StorefrontCheckoutClient settings={settings} />;
}
