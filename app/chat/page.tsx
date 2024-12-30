"use client";

import { Channel, MessageInput, MessageList, Window } from "stream-chat-react";

import { ChannelHeader } from "@/app/chat/_components/ChannelHeader";

export default function ChatPage() {
  return (
    <Channel>
      <Window>
        <ChannelHeader />
        <MessageList />
        <MessageInput focus />
      </Window>
    </Channel>
  );
}
