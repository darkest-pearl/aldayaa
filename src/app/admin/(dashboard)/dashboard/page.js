import { cookies } from "next/headers";
import { getAdminFromRequest } from "../../../../lib/auth";

export const metadata = {
  title: "Admin Dashboard",
};

export default async function DashboardPage() {
  const admin = await getAdminFromRequest(cookies());
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-textdark">
        Welcome back{admin?.email ? `, ${admin.email}` : ""}! Use the navigation above to manage the site
        content.
      </p>
    </div>
  );
}