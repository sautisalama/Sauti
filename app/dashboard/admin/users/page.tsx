"use client";

import { AdminUsersTable } from "../_components/AdminUsersTable";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";

export default function UsersPage() {
	return (
		<div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
			<SereneBreadcrumb
				items={[
					{ label: "Admin", href: "/dashboard/admin" },
					{ label: "User Management", active: true },
				]}
			/>
			<AdminUsersTable
				onRefresh={() => {
					// Handle refresh if needed
				}}
			/>
		</div>
	);
}
