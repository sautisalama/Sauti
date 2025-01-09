import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { MainSidebar } from "./_views/MainSidebar";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const user = await getUser();

	if (!user) {
		redirect("/signin");
	}


	return (
		<div className="flex">
			<MainSidebar />
			<main className="flex-1">{children}</main>
		</div>
	);
}
