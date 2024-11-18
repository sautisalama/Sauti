import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const user = await getUser();

	if (!user) {
		redirect("/signin");
	}

	return <div className="min-h-screen">{children}</div>;
}
