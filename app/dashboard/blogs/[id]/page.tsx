import { notFound, redirect } from "next/navigation";
import { requirePublisher } from "@/lib/auth/require-publisher";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { PublicationEditor } from "@/components/publishing/PublicationEditor";
import type { PublicationRow } from "@/types/publishing";

export const metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
	const auth = await requirePublisher();
	if (!auth.ok) redirect("/publications");
	const { id } = await params;
	if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
	if (auth.isAdmin) redirect(`/dashboard/admin/publications/${id}`);
	// RLS only returns this author's own rows.
	const { data } = await auth.supabase.from("publications").select("*").eq("id", id).eq("author_id", auth.user.id).maybeSingle();
	if (!data) notFound();
	const row = data as unknown as PublicationRow;
	return (
		<div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
			<SereneBreadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Blogs & publications", href: "/dashboard/blogs" }, { label: row.title, active: true }]} />
			<PublicationEditor key={row.id + row.updated_at} initial={row} isAdmin={false} basePath="/dashboard/blogs" />
		</div>
	);
}
