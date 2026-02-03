import { Tables } from "@/types/db-schema";
import { MatchCard } from "../../_components/MatchCard";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { updateMatchFeedback } from "@/app/dashboard/_views/actions/matched-services";

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
	const { toast } = useToast();
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const [feedbackText, setFeedbackText] = useState("");
	const [feedbackMatchId, setFeedbackMatchId] = useState<string | null>(null);

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-xl font-black text-sauti-dark tracking-tight">Matched Cases</h2>
					<p className="text-sm text-gray-500">
						{matchedServices.length} {matchedServices.length === 1 ? "case" : "cases"}{" "}
						matched
					</p>
				</div>
			</div>

			{matchedServices.length > 0 ? (
				<div className="space-y-4">
					{matchedServices.map((matchedCase) => (
						<div key={matchedCase.id} className="space-y-2">
							<MatchCard
								match={matchedCase}
								onAccept={onRefresh}
							/>
							<div className="flex gap-2">
								{(matchedCase.match_status_type === "accepted" || matchedCase.match_status_type === "completed") && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => { setFeedbackMatchId(matchedCase.id); setFeedbackOpen(true); }}
									>
										Leave Feedback
									</Button>
								)}
							</div>
						</div>
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
		{/* Feedback Dialog */}
		<Dialog open={feedbackOpen} onOpenChange={(o) => { setFeedbackOpen(o); if (!o) { setFeedbackText(""); setFeedbackMatchId(null); } }}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Leave feedback</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					<Textarea
						placeholder="Share feedback about the support received..."
						value={feedbackText}
						onChange={(e) => setFeedbackText(e.target.value)}
						className="min-h-[120px]"
					/>
					<div className="flex justify-end gap-2">
						<Button variant="ghost" onClick={() => { setFeedbackOpen(false); setFeedbackText(""); setFeedbackMatchId(null); }}>Cancel</Button>
						<Button
							onClick={async () => {
								if (!feedbackMatchId) return;
								try {
									await updateMatchFeedback(feedbackMatchId, feedbackText.trim());
									toast({ title: "Feedback submitted" });
									setFeedbackOpen(false);
									setFeedbackText("");
									await onRefresh();
								} catch (e) {
									toast({ title: "Error", description: "Failed to submit feedback", variant: "destructive" });
								}
						}}
						>
							Submit
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
		</div>
	);
}
