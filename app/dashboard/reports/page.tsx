import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ReportsMasterDetail from "./reports-master-detail";


export default async function ReportsPage() {
  const user = await getUser();
  if (!user) redirect("/signin");
  return (
    <div className="mx-auto p-4 md:p-6 max-w-7xl pb-20 md:pb-6">

      <ReportsMasterDetail userId={user.id} />

    </div>
  );
}

