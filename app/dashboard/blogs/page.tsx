import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { requirePublisher } from "@/lib/auth/require-publisher";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { KIND_LABEL } from "@/components/publishing/ArticleView";
import { cn } from "@/lib/utils";
import type { PublicationRow } from "@/types/publishing";

export const metadata = { title: "My blogs & publications" };

const BADGE: Record<string, string> = {
	draft: "bg-slate-100 text-slate-700",
	in_review: "bg-amber-100 text-amber-800",
	published: "bg-emerald-100 text-emerald-800",
	archived: "bg-gray-200 text-gray-600",
};
const LABEL: Record<string, string> = { draft: "Draft", in_review: "Awaiting approval", published: "Published", archived: "Archived" };

// Admins manage everything (and publish directly) in Publications. Professionals and NGOs
// write here and submit for approval. Everyone else reads what has been published.
export default async function MyBlogsPage() {
	const auth = await requirePublisher();
	if (!auth.ok) redirect("/publications");
	if (auth.isAdmin) redirect("/dashboard/admin/publications");

	const { data } = await auth.supabase
		.from("publications")
		.select("id, title, kind, status, category, updated_at, rejection_reason, slug, view_count")
		.eq("author_id", auth.user.id)
		.order("updated_at", { ascending: false })
		.limit(100);
	const rows = (data ?? []) as unknown as Pick<PublicationRow, "id" | "title" | "kind" | "status" | "category" | "updated_at" | "rejection_reason" | "slug" | "view_count">[];

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
			<SereneBreadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Blogs & publications", active: true }]} />
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-black text-[#1a365d]">Your blogs & publications</h1>
					<p className="text-sm text-gray-600">Write a post or upload a PDF. An administrator approves it before it goes live.</p>
				</div>
				<Link href="/dashboard/blogs/new" className="inline-flex items-center gap-2 rounded-lg bg-[#008080] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#006666]">
					<Plus className="h-4 w-4" /> New post
				</Link>
			</div>

			{rows.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center">
					<FileText className="mx-auto mb-3 h-8 w-8 text-gray-400" aria-hidden />
					<p className="font-bold text-gray-700">You haven’t written anything yet</p>
					<p className="text-sm text-gray-500">Start a post, or upload a Word or PDF document.</p>
				</div>
			) : (
				<ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
					{rows.map((r) => (
						<li key={r.id}>
							<Link href={`/dashboard/blogs/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50">
								<div className="min-w-0 flex-1">
									<p className="truncate font-bold text-[#1a365d]">{r.title}</p>
									<p className="text-xs text-gray-500">
										{KIND_LABEL[r.kind]}{r.category ? ` · ${r.category}` : ""} · edited {new Date(r.updated_at).toLocaleDateString("en-GB")}
										{r.status === "published" && ` · ${r.view_count} views`}
									</p>
									{r.status === "draft" && r.rejection_reason && <p className="mt-0.5 truncate text-xs font-semibold text-orange-700">Changes requested: {r.rejection_reason}</p>}
								</div>
								<span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", BADGE[r.status])}>{LABEL[r.status]}</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
