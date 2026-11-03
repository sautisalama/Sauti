import type { Metadata } from "next";
import { getActor, isSuperAdminEmail } from "@/lib/access/super-admin";
import { MeetHome } from "@/components/meet/MeetHome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meet | Sauti Salama", robots: { index: false, follow: false } };

export default async function MeetIndex() {
	const actor = await getActor();
	const isSuper = !!actor && (await isSuperAdminEmail(actor.email));
	return <MeetHome isAdmin={!!actor?.isAdmin} isSuper={isSuper} />;
}
