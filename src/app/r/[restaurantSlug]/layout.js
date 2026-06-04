import PublicLayout from '../../public/layout';

export const dynamic = 'force-dynamic';

export default function TenantPublicLayout({ children }) {
  return <PublicLayout>{children}</PublicLayout>;
}
