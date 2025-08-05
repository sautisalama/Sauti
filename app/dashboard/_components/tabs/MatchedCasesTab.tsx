import { Tables } from "@/types/db-schema";
import { MatchCard } from "../../_components/MatchCard";
import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MatchedServiceWithRelations {
	id: string;
	match_date: string;
	match_status_type: string;
	report: Tables<"reports">;
	support_service: Tables<"support_services">;
}

interface MatchedCasesTabProps {
	userId: string;
	matchedServices: MatchedServiceWithRelations[];
	onRefresh: () => Promise<void>;
}

export function MatchedCasesTab({
	userId,
	matchedServices,
	onRefresh,
}: MatchedCasesTabProps) {
	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		// Subscribe to changes in matched_services table with filter for this user
		const channel = supabase
			.channel("matched-services-changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "matched_services",
					filter: `professional_id=eq.${userId}`,
				},
				async () => {
					await onRefresh();
				}
			)
			.subscribe((status) => {
				if (status === "CHANNEL_ERROR") {
					toast({
						title: "Connection Error",
						description: "Failed to connect to real-time updates",
						variant: "destructive",
					});
				}
			});

		return () => {
			supabase.removeChannel(channel);
		};
	}, [supabase, onRefresh, toast, userId]);

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-xl font-semibold text-[#1A3434]">Matched Cases</h2>
					<p className="text-sm text-gray-500">
						{matchedServices.length} {matchedServices.length === 1 ? "case" : "cases"}{" "}
						matched
					</p>
				</div>
			</div>

			{matchedServices.length > 0 ? (
				<div className="space-y-4">
					{matchedServices.map((matchedCase) => (
						<MatchCard
							key={matchedCase.id}
							match={matchedCase}
							onAccept={onRefresh}
						/>
					))}
				</div>
			) : (
				<div className="text-center py-12 bg-gray-50 rounded-lg">
					<div className="space-y-3">
						<p className="text-gray-500">No matched cases found</p>
						<p className="text-sm text-gray-400">
							Matches will appear here when your services are matched with reports
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
