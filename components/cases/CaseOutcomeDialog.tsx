"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { confirmCaseOutcome } from "@/app/actions/case-outcome";

interface Props {
	matchId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Called after the survivor's confirmation has been saved. */
	onDone?: (result: { completed: boolean; rating?: number }) => void;
}

/** Survivor confirms the support has concluded and optionally rates it. */
export function CaseOutcomeDialog({ matchId, open, onOpenChange, onDone }: Props) {
	const { toast } = useToast();
	const [rating, setRating] = useState(0);
	const [comment, setComment] = useState("");
	const [pending, start] = useTransition();

	const submit = () =>
		start(async () => {
			const res = await confirmCaseOutcome(matchId, { rating: rating || undefined, comment });
			if (!res.success) {
				toast({ title: "Could not save", description: res.error, variant: "destructive" });
				return;
			}
			toast({
				title: res.completed ? "Case completed" : "Thank you",
				description: res.completed ? "Both of you have confirmed. This case is now closed." : "We've let your professional know. The case closes once they confirm too.",
			});
			onOpenChange(false);
			onDone?.({ completed: res.completed, rating: rating || undefined });
		});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Is your support complete?</DialogTitle>
					<DialogDescription>Confirming lets us close this case. You can add a rating and a note — both are optional and are only shared with your professional and our team.</DialogDescription>
				</DialogHeader>
				<div className="flex items-center justify-center gap-1 py-2" role="radiogroup" aria-label="Rate the support you received">
					{[1, 2, 3, 4, 5].map((n) => (
						<button
							key={n}
							type="button"
							role="radio"
							aria-checked={rating === n}
							aria-label={`${n} star${n > 1 ? "s" : ""}`}
							onClick={() => setRating(rating === n ? 0 : n)}
							className="p-1.5 rounded-md transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauti-teal"
						>
							<Star className={`h-8 w-8 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-serene-neutral-300"}`} />
						</button>
					))}
				</div>
				<Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} placeholder="Anything you'd like to share about the support you received (optional)" />
				<DialogFooter className="gap-2 sm:gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
						Not yet
					</Button>
					<Button onClick={submit} disabled={pending} className="bg-sauti-teal hover:bg-sauti-dark text-white">
						{pending ? "Saving…" : "Yes, mark complete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
