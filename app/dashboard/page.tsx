import { createClient, getSession } from "@/utils/supabase/server";
import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions/auth";
import SurvivorView from "./_views/SurvivorView";
import ProfessionalView from "./_views/ProfessionalView";
import { MainSidebar } from "./_views/MainSidebar";
import ChooseUser from "./_views/ChooseUser";
import { useUser } from "@/hooks/useUser";
import { ChatComponent } from "./chat/_components/Chat";
import { Suspense } from "react";

export default async function Dashboard() {
	const user = await getUser();

	if (!user) {
		redirect("/signin");
	}

	// If user exists but has no user_type, show the ChooseUser component
	if (!user.user_type) {
		return <ChooseUser />;
	}

	return (
		<div className="flex h-screen overflow-hidden">
			{/* Main content area */}
			<div className="flex-1 overflow-auto md:ml-[72px]">
				<Suspense fallback={<div className="p-6">Loading dashboard...</div>}>
					{user.user_type === "survivor" ? (
						<SurvivorView userId={user.id} profileDetails={user} />
					) : user.user_type === "professional" || user.user_type === "ngo" ? (
						<ProfessionalView userId={user.id} profileDetails={user} />
					) : user.user_type === null ? (
						<ChooseUser />
					) : (
						redirect("/error?message=Invalid user type")
					)}
				</Suspense>
			</div>
		</div>
	);
	// return <div>Dashboard</div>;
}
