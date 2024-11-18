import { createClient } from "@/utils/supabase/server";
import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import SurvivorView from "./_views/SurvivorView";
import ProfessionalView from "./_views/ProfesionalView";

export default async function Dashboard() {
	const user = await getUser();

	if (!user) {
		redirect("/signin");
	}

	const userDisplay = user.first_name || user.id;

	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto">
				<div className="bg-card rounded-lg shadow-lg p-6">
					<div className="flex justify-between items-center mb-6">
						<div>
							<h1 className="text-3xl font-bold">Dashboard</h1>
							<p className="text-muted-foreground">Welcome back, {userDisplay}</p>
							<p className="text-muted-foreground text-sm">
								You are signed in as a {user.user_type}
							</p>
						</div>
						<form action={signOut} method="post">
							<Button variant="outline" size="sm" type="submit">
								<LogOut className="h-4 w-4 mr-2" />
								Sign out
							</Button>
						</form>
					</div>

					{user.user_type === "survivor" ? (
						<SurvivorView userId={user.id} />
					) : user.user_type === "professional" ? (
						<ProfessionalView userId={user.id} />
					) : (
						<p>Invalid user type</p>
					)}
				</div>
			</div>
		</div>
	);
}
