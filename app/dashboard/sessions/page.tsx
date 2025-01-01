import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import CalendarView from "./_components/CalendarView";
import { createClient } from "@/utils/supabase/server";
import ProfessionalsList from "./_components/ProfessionalsList";

export default async function CalendarPage() {
	const user = await getUser();

	if (!user) {
		redirect("/signin");
	}

	const supabase = createClient();

	// Fetch user's appointments
	const { data: appointments } = await supabase
		.from("appointments")
		.select(
			`
      *,
      professional_profiles:professional_id (
        id,
        bio,
        profession,
        profiles:user_id (
          first_name,
          last_name
        )
      )
    `
		)
		.eq("survivor_id", user.id)
		.order("date");

	return (
		<div className="container mx-auto py-6">
			<h1 className="text-2xl font-bold mb-6">Calendar</h1>
			<div className="grid lg:grid-cols-[1fr_300px] gap-6">
				<CalendarView appointments={appointments || []} />
				<ProfessionalsList appointments={appointments || []} />
			</div>
		</div>
	);
}
