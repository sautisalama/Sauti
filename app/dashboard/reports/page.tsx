import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ReportsMasterDetail from "./reports-master-detail";
import { MobileTabbar } from "@/components/MobileTabbar";

export default async function ReportsPage() {
  const user = await getUser();
  if (!user) redirect("/signin");
  return (
    <div className="mx-auto p-4 md:p-6 max-w-7xl pb-20 md:pb-6">
      <div className="mb-4 sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b md:border-0">
        <div className="py-3 md:py-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#1A3434]">My Reports</h1>
          <p className="hidden md:block text-sm text-muted-foreground">View your reports and related appointments.</p>
        </div>
      </div>
      <ReportsMasterDetail userId={user.id} />
      <MobileTabbar active="reports" base="/dashboard" userType="survivor" />
    </div>
  );
}

