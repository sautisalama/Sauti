import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { DMChat } from "@/app/dashboard/chat/_components/DMChat";

export default async function DMChatPage({ params }: { params: { channelId: string } }) {
  const user = await getUser();
  if (!user) redirect("/signin");

  return (
    <div className="h-screen">
      <DMChat userId={user.id} username={user.first_name || user.id} channelId={params.channelId} />
    </div>
  );
}

