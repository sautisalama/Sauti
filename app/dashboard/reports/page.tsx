import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ReportsList from "./reports-list";

export default async function ReportsPage() {
  const user = await getUser();
  if (!user) redirect("/signin");
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#1A3434]">My Reports</h1>
        <p className="text-sm text-muted-foreground">An overview of all incident reports you have filed.</p>
      </div>
      <ReportsList userId={user.id} />
    </div>
  );
}

