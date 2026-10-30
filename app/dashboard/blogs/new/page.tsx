import { redirect } from "next/navigation";
import { requirePublisher } from "@/lib/auth/require-publisher";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { PublicationEditor } from "@/components/publishing/PublicationEditor";

export const metadata = { title: "New post" };

export default async function NewPostPage() {
	const auth = await requirePublisher();
	if (!auth.ok) redirect("/publications");
	if (auth.isAdmin) redirect("/dashboard/admin/publications/new");
	return (
		<div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
			<SereneBreadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Blogs & publications", href: "/dashboard/blogs" }, { label: "New", active: true }]} />
			<PublicationEditor isAdmin={false} basePath="/dashboard/blogs" />
		</div>
	);
}
