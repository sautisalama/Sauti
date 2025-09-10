import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { CommunityChat } from "@/app/dashboard/chat/_components/CommunityChat";

export default async function CommunityChatPage() {
  const user = await getUser();
  if (!user) redirect("/signin");

  return (
    <div className="h-screen">
      <CommunityChat userId={user.id} username={user.first_name || user.id} />
    </div>
  );
}

