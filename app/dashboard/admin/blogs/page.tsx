"use client";

import { BlogManager } from "../_components/BlogManager";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";

export default function BlogsPage() {
	return (
		<div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
			<SereneBreadcrumb
				items={[
					{ label: "Admin", href: "/dashboard/admin" },
					{ label: "Blogs & Events", active: true },
				]}
			/>
			<BlogManager />
		</div>
	);
}
