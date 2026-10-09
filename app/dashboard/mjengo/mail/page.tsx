import { MailApp } from "./_components/MailApp";

// IMAP/SMTP calls can take a while on a cold connection.
export const maxDuration = 60;
export const metadata = { title: "Mail" };

export default function MailPage() {
	return (
		<div className="h-full border-t border-serene-neutral-100">
			<MailApp />
		</div>
	);
}
