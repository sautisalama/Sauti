import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { KIND_LABEL } from "@/components/publishing/ArticleView";
import { cn } from "@/lib/utils";
import type { PublicationRow } from "@/types/publishing";

export const metadata = { title: "Publications" };

const FILTERS = ["all", "draft", "in_review", "published", "archived"] as const;
const BADGE: Record<string, string> = {
	draft: "bg-slate-100 text-slate-700",
	in_review: "bg-amber-100 text-amber-800",
	published: "bg-emerald-100 text-emerald-800",
	archived: "bg-gray-200 text-gray-600",
};

export default async function AdminPublicationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
	const auth = await requireAdmin();
	if (!auth.ok) redirect("/dashboard");
	const { status = "all", q = "" } = await searchParams;

	let query = auth.supabase
		.from("publications")
		.select("id, slug, title, kind, status, category, featured, updated_at, published_at, email_status, view_count")
		.order("updated_at", { ascending: false })
		.limit(200);
	if ((FILTERS as readonly string[]).includes(status) && status !== "all") query = query.eq("status", status);
	if (q.trim()) query = query.ilike("title", `%${q.trim().replace(/[%,]/g, " ")}%`);
	const { data, error } = await query;
	const rows = (data ?? []) as unknown as Pick<PublicationRow, "id" | "slug" | "title" | "kind" | "status" | "category" | "featured" | "updated_at" | "published_at" | "email_status" | "view_count">[];

	return (
		<div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
			<SereneBreadcrumb items={[{ label: "Admin", href: "/dashboard/admin" }, { label: "Publications", active: true }]} />
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-black text-[#1a365d]">Publications</h1>
					<p className="text-sm text-gray-600">Blogs, publications, resources and learning articles. Drafts are private until you publish.</p>
				</div>
				<Link href="/dashboard/admin/publications/new" className="inline-flex items-center gap-2 rounded-lg bg-[#008080] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#006666]">
					<Plus className="h-4 w-4" /> New publication
				</Link>
			</div>

			<form className="flex flex-wrap items-center gap-2" role="search">
				<input name="q" defaultValue={q} placeholder="Search titles" aria-label="Search titles" className="h-10 min-w-[14rem] flex-1 rounded-lg border border-gray-300 px-3 text-sm" />
				{status !== "all" && <input type="hidden" name="status" value={status} />}
				<button className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-bold">Search</button>
			</form>
			<nav className="flex flex-wrap gap-1" aria-label="Filter by status">
				{FILTERS.map((f) => (
					<Link key={f} href={`/dashboard/admin/publications?status=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={status === f ? "page" : undefined}
						className={cn("rounded-full px-3 py-1.5 text-sm font-bold capitalize", status === f ? "bg-[#1a365d] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
						{f.replace("_", " ")}
					</Link>
				))}
			</nav>

			{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">Could not load: {error.message}</p>}

			{rows.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center">
					<FileText className="mx-auto mb-3 h-8 w-8 text-gray-400" aria-hidden />
					<p className="font-bold text-gray-700">Nothing here yet</p>
					<p className="text-sm text-gray-500">Create one from scratch, or upload a Word / PDF document to start from.</p>
				</div>
			) : (
				<ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
					{rows.map((r) => (
						<li key={r.id}>
							<Link href={`/dashboard/admin/publications/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50">
								<div className="min-w-0 flex-1">
									<p className="truncate font-bold text-[#1a365d]">{r.title}{r.featured && <span className="ml-2 text-xs text-sauti-orange">★ featured</span>}</p>
									<p className="text-xs text-gray-500">
										{KIND_LABEL[r.kind]}{r.category ? ` · ${r.category}` : ""} · edited {new Date(r.updated_at).toLocaleDateString("en-GB")}
										{r.status === "published" && ` · ${r.view_count} views`}
									</p>
								</div>
								{r.email_status?.startsWith("failed") && <span className="text-xs font-bold text-red-700" title={r.email_status}>email failed</span>}
								<span className={cn("rounded-full px-2.5 py-1 text-xs font-bold capitalize", BADGE[r.status])}>{r.status.replace("_", " ")}</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
