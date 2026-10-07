import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { PublicationEditor } from "@/components/publishing/PublicationEditor";
import type { PublicationRow } from "@/types/publishing";

export const metadata = { title: "Edit publication" };

export default async function EditPublicationPage({ params }: { params: Promise<{ id: string }> }) {
	const auth = await requireAdmin();
	if (!auth.ok) redirect("/dashboard");
	const { id } = await params;
	if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
	const { data } = await auth.supabase.from("publications").select("*").eq("id", id).maybeSingle();
	if (!data) notFound();
	const row = data as unknown as PublicationRow;
	return (
		<div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
			<SereneBreadcrumb items={[{ label: "Admin", href: "/dashboard/admin" }, { label: "Publications", href: "/dashboard/admin/publications" }, { label: row.title, active: true }]} />
			<PublicationEditor key={row.id + row.updated_at} initial={row} />
		</div>
	);
}
