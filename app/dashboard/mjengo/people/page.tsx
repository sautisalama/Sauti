import { redirect } from "next/navigation";
import { getActor, isSuperAdminEmail } from "@/lib/access/super-admin";
import { PeoplePanel } from "./PeoplePanel";

export const metadata = { title: "People & access" };

export default async function PeoplePage() {
	const actor = await getActor();
	if (!actor || !(await isSuperAdminEmail(actor.email))) redirect("/dashboard/mjengo");
	return <PeoplePanel />;
}
