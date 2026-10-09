import { redirect } from "next/navigation";
import { getActor, isSuperAdminEmail } from "@/lib/access/super-admin";
import { LogsPanel } from "./LogsPanel";

export const metadata = { title: "Logs" };

export default async function LogsPage() {
	const actor = await getActor();
	if (!actor || !(await isSuperAdminEmail(actor.email))) redirect("/dashboard/admin/mjengo");
	return <LogsPanel />;
}
