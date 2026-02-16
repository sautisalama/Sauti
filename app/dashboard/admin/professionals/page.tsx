"use client";

import { ProfessionalsTable } from "../_components/ProfessionalsTable";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";

export default function ProfessionalsPage() {
	return (
		<div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
			<SereneBreadcrumb
				items={[
					{ label: "Admin", href: "/dashboard/admin" },
					{ label: "Professionals", active: true },
				]}
			/>
			<ProfessionalsTable />
		</div>
	);
}
