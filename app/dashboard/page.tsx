import { createClient } from "@/lib/supabase/supabase-server";
import { redirect } from "next/navigation";

export default async function Dashboard() {
	const supabase = createClient();

	// Get user session
	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session) {
		redirect("/signin");
	}

	// Get user email or name
	const userDisplay = session.user.user_metadata.full_name || session.user.email;

	return (
		<div className="min-h-screen p-8">
			<div className="max-w-4xl mx-auto">
				<div className="bg-card rounded-lg shadow-lg p-6">
					<h1 className="text-3xl font-bold mb-4">Welcome to your Dashboard</h1>
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
