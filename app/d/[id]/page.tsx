import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicDoc } from "@/lib/mjengo/public-doc";
import { getActor } from "@/lib/access/super-admin";
import { PublicDoc } from "./PublicDoc";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared document | Sauti Salama", robots: { index: false, follow: false } };

/** A document its owner opened to anyone with the link: no account needed. */
export default async function SharedDocPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const d = await publicDoc(id);
	if (!d) notFound();
	const actor = await getActor();
	return <PublicDoc id={d.id} name={d.name} access={d.access} signedInName={actor?.name ?? null} signedInId={actor?.id ?? null} />;
}
