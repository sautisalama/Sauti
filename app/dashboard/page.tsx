import { createClient, getSession } from "@/utils/supabase/server";
import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import SurvivorView from "./_views/SurvivorView";
import ProfessionalView from "./_views/ProfesionalView";
import { MainSidebar } from "./_views/MainSidebar";

export default async function Dashboard() {
	const user = await getUser();
	// console.log("session", await getSession());

	if (!user) {
		redirect("/signin");
	}

	return (
		<div className="flex h-screen overflow-hidden">
			{/* Sticky sidebar */}
			<div className="fixed left-0 h-full">
				<MainSidebar />
			</div>

			{/* Main content area with independent scrolling */}
			<div className="flex-1 overflow-auto ml-[72px]">
				{user.user_type === "survivor" ? (
					<SurvivorView userId={user.id} profileDetails={user} />
				) : user.user_type === "professional" ? (
					<ProfessionalView userId={user.id} />
				) : (
					<p>Invalid user type</p>
				)}
			</div>
		</div>
	);
}
