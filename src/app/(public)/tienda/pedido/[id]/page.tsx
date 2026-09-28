import { getPublicOrder } from '@/app/actions/storefront';
import { OrderConfirmationClient } from '@/components/storefront/OrderConfirmationClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface StorefrontOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function StorefrontOrderPage({ params }: StorefrontOrderPageProps) {
  const { id } = await params;
  const orderRes = await getPublicOrder(id);

  if (!orderRes.success || !orderRes.data) {
    notFound();
  }

  return <OrderConfirmationClient order={orderRes.data} />;
}
