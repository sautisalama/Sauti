"use client";

import { VerificationSection } from "../verification-section";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { useState } from "react";

export default function VerificationPage() {
	const dash = useDashboardData();
	const profile = dash?.data?.profile;
	const userId = dash?.data?.userId;
	const [activeTab, setActiveTab] = useState("verification");

	if (!userId || !profile) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-center">
					<p className="text-gray-500">Loading profile data...</p>
				</div>
			</div>
		);
	}

	return (
		<VerificationSection
			userId={userId}
			userType={profile.user_type || "professional"}
			profile={profile}
			onUpdate={() => {
				// Refresh provider data
				try {
					const supabase = require("@/utils/supabase/client").createClient();
					(async () => {
						const { data } = await supabase
							.from("profiles")
							.select(
								"verification_status, last_verification_check, accreditation_files_metadata"
							)
							.eq("id", userId)
							.single();
						const docs = data?.accreditation_files_metadata
							? Array.isArray(data.accreditation_files_metadata)
								? data.accreditation_files_metadata
								: JSON.parse(data.accreditation_files_metadata)
							: [];
						dash?.updatePartial({
							verification: {
								overallStatus: data?.verification_status || "pending",
								lastChecked: data?.last_verification_check || null,
								documentsCount: (docs || []).length,
							},
						});
					})();
				} catch {}
			}}
			onNavigateToServices={() => setActiveTab("services")}
		/>
	);
}
