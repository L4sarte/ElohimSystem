import { getPublicProductDetail } from '@/app/actions/storefront';
import { getSystemSettings } from '@/app/actions/systemSettings';
import { ProductDetailClient } from '@/components/storefront/ProductDetailClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const [productRes, settingsRes] = await Promise.all([
    getPublicProductDetail(id),
    getSystemSettings(),
  ]);

  if (!productRes.success || !productRes.data) {
    notFound();
  }

  const { product, related, decantsAvailable } = productRes.data;
  const settings = settingsRes.data;

  return (
    <ProductDetailClient
      product={product}
      related={related}
      decantsAvailable={decantsAvailable}
      settings={settings}
    />
  );
}
