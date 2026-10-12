import { getUser } from "@/utils/supabase/server";
import { getActor, isSuperAdminEmail } from "@/lib/access/super-admin";
import DashboardLayout from "@/app/dashboard/layout";
import { MjengoShell } from "@/app/dashboard/mjengo/_components/MjengoShell";

/**
 * Signed-in people see Meet inside the platform's side panel, and administrators inside the Mjengo suite with
 * all its items and the quick actions. Only the call itself covers it. Guests who open a call link have no
 * panel at all.
 */
export default async function MeetLayout({ children }: { children: React.ReactNode }) {
	const user = await getUser();
	if (!user) return <>{children}</>;
	const actor = await getActor();
	if (!actor?.isAdmin) return <DashboardLayout>{children}</DashboardLayout>;
	const isSuper = await isSuperAdminEmail(actor.email);
	return (
		<DashboardLayout>
			<MjengoShell isSuper={isSuper}>{children}</MjengoShell>
		</DashboardLayout>
	);
}
