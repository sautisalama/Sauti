"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";

export function DailyProgress() {
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		const supabase = createClient();

		const fetchProgress = async () => {
			// Get the current user's ID
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			// Get all reports for this user
			const { data: reports } = await supabase
				.from("reports")
				.select(
					`
					report_id,
					matched_services (
						match_status_type
					)
				`
				)
				.eq("user_id", user.id);

			if (!reports || reports.length === 0) {
				setProgress(0);
				return;
			}

			// Count reports with accepted matches
			const acceptedCount = reports.filter((report) =>
				report.matched_services?.some(
					(match) => match.match_status_type === "accepted"
				)
			).length;

			// Calculate percentage
			const percentage = (acceptedCount / reports.length) * 100;
			setProgress(Math.round(percentage));
		};

		fetchProgress();

		// Set up real-time subscription
		const channel = supabase
			.channel("reports-progress")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "matched_services",
				},
				() => {
					fetchProgress();
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, []);

	// Calculate stroke-dashoffset
	const circumference = 251.2; // 2 * π * radius (40)
	const strokeDashoffset = circumference * (1 - progress / 100);

	return (
		<div className="rounded-2xl bg-gradient-to-br from-[#E0F7F7] to-[#F0F9FF] p-6">
			<h3 className="text-xl font-semibold text-[#1A3434]">
				Your Matching Progress
			</h3>
			<p className="text-sm text-gray-600 mt-1">
				We are analyzing your reports and connecting you with the most suitable
				service providers in your area.
			</p>

			<div className="relative mt-8 flex items-center justify-center">
				<div className="relative h-40 w-40">
					{/* Progress circle background */}
					<svg className="h-full w-full" viewBox="0 0 100 100">
						<circle
							className="stroke-current text-[#E0F7F7]"
							strokeWidth="10"
							fill="transparent"
							r="40"
							cx="50"
							cy="50"
						/>
						{/* Progress circle foreground */}
						<circle
							className="stroke-current text-[#00A5A5]"
							strokeWidth="10"
							strokeLinecap="round"
							fill="transparent"
							r="40"
							cx="50"
							cy="50"
							strokeDasharray={circumference}
							strokeDashoffset={strokeDashoffset}
							transform="rotate(-90 50 50)"
						/>
					</svg>

					{/* Percentage text */}
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="text-3xl font-bold text-[#1A3434]">{progress}%</span>
					</div>
				</div>
			</div>
		</div>
	);
}
