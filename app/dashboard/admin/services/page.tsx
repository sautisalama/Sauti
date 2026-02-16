"use client";

import { AdminServicesTable } from "../_components/AdminServicesTable";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";

export default function ServicesPage() {
	return (
		<div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
			<SereneBreadcrumb
				items={[
					{ label: "Admin", href: "/dashboard/admin" },
					{ label: "Services", active: true },
				]}
			/>
			<AdminServicesTable
				onRefresh={() => {
					// Refresh logic
				}}
			/>
		</div>
	);
}
