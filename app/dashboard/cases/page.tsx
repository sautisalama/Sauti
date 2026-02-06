import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import CasesClient from "./cases-client";


export default async function CasesPage() {
	const user = await getUser();
	if (!user) redirect("/signin");
	return (
		<div className="mx-auto p-4 md:p-6 max-w-7xl pb-20 md:pb-6">

			<CasesClient userId={user.id} />

		</div>
	);
}
