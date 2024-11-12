import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default async function Dashboard() {
	const supabase = createClient();

	const {
		data: { user },
	} = await (await supabase).auth.getUser();

	if (!user) {
		redirect("/signin");
	}

	const userDisplay = user?.user_metadata.full_name || user?.email;

	return (
		<div className="min-h-screen p-8">
			<div className="max-w-4xl mx-auto">
				<div className="bg-card rounded-lg shadow-lg p-6">
					<div className="flex justify-between items-center mb-4">
						<h1 className="text-3xl font-bold">Welcome to your Dashboard</h1>
						<form action={signOut} method="post">
							<Button variant="outline" size="sm" type="submit">
								<LogOut className="h-4 w-4 mr-2" />
								Sign out
							</Button>
						</form>
					</div>
					<p className="text-xl text-muted-foreground">Hello, {userDisplay}! 👋</p>

					{/* Add your dashboard content here */}
					<div className="mt-8 grid gap-6">
						<div className="bg-background p-6 rounded-md border">
							<h2 className="text-xl font-semibold mb-2">Getting Started</h2>
							<p className="text-muted-foreground">
								This is your protected dashboard page. Only authenticated users can see
								this content.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
