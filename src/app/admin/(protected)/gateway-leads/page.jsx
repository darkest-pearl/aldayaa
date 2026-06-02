import { redirect } from 'next/navigation';

export const metadata = { title: 'Gateway Leads moved' };

export default async function GatewayLeadsPage() {
  redirect('/platform-admin/leads');
}
