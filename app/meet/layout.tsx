import { getUser } from "@/utils/supabase/server";
import DashboardLayout from "@/app/dashboard/layout";

/**
 * Signed-in people see Meet inside the Sauti Salama side panel, in the lobby too. Only the call itself covers
 * it. Guests who open a call link have no panel at all.
 */
export default async function MeetLayout({ children }: { children: React.ReactNode }) {
	const user = await getUser();
	if (!user) return <>{children}</>;
	return <DashboardLayout>{children}</DashboardLayout>;
}
