import { redirect } from "next/navigation";
import { getActor, isSuperAdminEmail } from "@/lib/access/super-admin";
import { Suspense } from "react";
import { MjengoShell } from "./_components/MjengoShell";
import { SuiteWelcome } from "./_components/SuiteWelcome";

/** Mjengo is for administrators only; the People and Logs tabs are for super admins. */
export default async function MjengoLayout({ children }: { children: React.ReactNode }) {
	const actor = await getActor();
	if (!actor?.isAdmin) redirect("/dashboard");
	const isSuper = await isSuperAdminEmail(actor.email);
	return (
		<MjengoShell isSuper={isSuper}>
			{children}
			<Suspense fallback={null}><SuiteWelcome /></Suspense>
		</MjengoShell>
	);
}
