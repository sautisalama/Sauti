import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ServicesClient from "./services-client";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";

export default async function ServicesPage() {
  const user = await getUser();
  if (!user) redirect("/signin");
  return (
    <div className="mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <SereneBreadcrumb items={[{ label: "Services", active: true }]} className="mb-4" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Services</h1>
            <p className="text-gray-500 mt-1">Register and manage your support services.</p>
          </div>
        </div>
      </div>
      <ServicesClient userId={user.id} />
    </div>
  );
}

