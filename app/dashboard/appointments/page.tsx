import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AppointmentsClient from "./client";

export default async function AppointmentsPage() {
  const user = await getUser();
  if (!user) redirect("/signin");
  return (
    <div className="mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-4 sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b md:border-0">
        <div className="py-3 md:py-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#1A3434]">Appointments</h1>
          <p className="hidden md:block text-sm text-muted-foreground">View and manage your appointments.</p>
        </div>
      </div>
      <AppointmentsClient userId={user.id} userType={user.user_type || 'survivor'} username={user.first_name || user.id} />
    </div>
  );
}

