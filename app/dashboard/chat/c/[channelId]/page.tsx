import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { DMChat } from "@/app/dashboard/chat/_components/DMChat";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function DMChatPage({ params }: { params: { channelId: string } }) {
  const user = await getUser();
  if (!user) redirect("/signin");

  return (
    <div className="h-screen">
      <Link href="/dashboard/chat">
        <Button variant="ghost" className="absolute top-4 left-4 z-10">
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </Link>
      <DMChat userId={user.id} username={user.first_name || user.id} channelId={params.channelId} />
    </div>
  );
}

