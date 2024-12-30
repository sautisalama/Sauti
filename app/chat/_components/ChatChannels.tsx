"use client";

import { useEffect, useState } from "react";
import { ChannelList, ChannelPreview } from "stream-chat-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import NewChatDialog from "./NewChatDialog";
import { StreamChat } from "stream-chat";

const streamClient = StreamChat.getInstance(process.env.NEXT_PUBLIC_STREAM_KEY!);

export default function ChatChannels({ userId }: { userId: string }) {
  const [showNewChat, setShowNewChat] = useState(false);
  const supabase = createClient();

  const filters = {
    members: { $in: [userId] },
  };

  const sort = {
    last_message_at: -1,
  };

  useEffect(() => {
    // Join default channel on component mount
    const joinDefaultChannel = async () => {
      try {
        const channel = streamClient.channel("messaging", "default", {
          name: "General Chat",
          members: [userId],
        });
        await channel.watch();
      } catch (error) {
        console.error("Error joining default channel:", error);
      }
    };

    joinDefaultChannel();
  }, [userId]);

  return (
    <div className="w-80 border-r bg-muted/20">
      <div className="p-4 border-b">
        <Button 
          onClick={() => setShowNewChat(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ChannelList
        filters={filters}
        sort={sort}
        options={{ state: true, presence: true, limit: 10 }}
        Preview={CustomChannelPreview}
      />

      <NewChatDialog 
        open={showNewChat} 
        onClose={() => setShowNewChat(false)}
        userId={userId}
      />
    </div>
  );
}

function CustomChannelPreview(props: any) {
  return (
    <div className="px-4 py-3 hover:bg-muted/50 cursor-pointer">
      <ChannelPreview {...props} />
    </div>
  );
} 