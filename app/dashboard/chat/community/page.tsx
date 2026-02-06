import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { CommunityChat } from "@/app/dashboard/chat/_components/CommunityChat";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";

export default async function CommunityChatPage() {
  const user = await getUser();
  if (!user) redirect("/signin");

  return (
    <div className="h-screen flex flex-col">
      <div className="px-4 py-2 bg-serene-neutral-50/50">
         <SereneBreadcrumb items={[{ label: "Community", active: true }]} className="mb-0" />
      </div>
      <div className="flex-1">
         <CommunityChat userId={user.id} username={user.first_name || user.id} />
      </div>
    </div>
  );
}

