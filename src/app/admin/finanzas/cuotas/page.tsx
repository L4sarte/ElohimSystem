import { redirect } from 'next/navigation';

export default function AdminCuotasRedirect() {
  redirect('/config/pagos');
}
