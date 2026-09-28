import { getPublicProductDetail } from '@/app/actions/storefront';
import { getSystemSettings } from '@/app/actions/systemSettings';
import { getCurrentRate } from '@/app/actions/rates';
import { ProductDetailClient } from '@/components/storefront/ProductDetailClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const [productRes, settingsRes, rateRes] = await Promise.all([
    getPublicProductDetail(id),
    getSystemSettings(),
    getCurrentRate(),
  ]);

  if (!productRes.success || !productRes.data) {
    notFound();
  }

  const { product, related, decantsAvailable } = productRes.data;
  const settings = settingsRes.data;
  const exchangeRate = rateRes.data?.value_ars || 1250;

  return (
    <ProductDetailClient
      product={product}
      related={related}
      decantsAvailable={decantsAvailable}
      settings={settings}
      exchangeRate={exchangeRate}
    />
  );
}
