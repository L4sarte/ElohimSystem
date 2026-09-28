import { getSystemSettings } from '@/app/actions/systemSettings';
import { ConfiguracionClient } from '@/components/settings/ConfiguracionClient';

export const dynamic = 'force-dynamic';

export default async function ConfiguracionPage() {
  const res = await getSystemSettings();
  const settings = res.data;

  return <ConfiguracionClient initialSettings={settings} />;
}
