import type { Metadata } from "next";
import { EditByLink } from "./EditByLink";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit form | Sauti Salama", robots: { index: false, follow: false } };

export default async function EditFormPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string }> }) {
	const { slug } = await params;
	const { k } = await searchParams;
	return <EditByLink slug={slug} k={k ?? ""} />;
}
