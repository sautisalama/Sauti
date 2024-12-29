import ChatWrapper from "./_components/ChatWrapper";

export default function ChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <ChatWrapper>{children}</ChatWrapper>;
}
