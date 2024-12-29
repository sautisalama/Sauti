import ChatWrapper from "@/app/chat/_components/ChatWrapper";

export default function ChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <ChatWrapper>{children}</ChatWrapper>;
}
