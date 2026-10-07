import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { PublicationEditor } from "@/components/publishing/PublicationEditor";

export const metadata = { title: "New publication" };

export default async function NewPublicationPage() {
	const auth = await requireAdmin();
	if (!auth.ok) redirect("/dashboard");
	return (
		<div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
			<SereneBreadcrumb items={[{ label: "Admin", href: "/dashboard/admin" }, { label: "Publications", href: "/dashboard/admin/publications" }, { label: "New", active: true }]} />
			<PublicationEditor />
		</div>
	);
}
