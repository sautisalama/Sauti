"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { sendNotification } from "@/lib/notifications";

type Feedback = {
	is_prof_complete?: boolean;
	is_surv_complete?: boolean;
	survivor_rating?: number;
	survivor_comment?: string;
	survivor_completed_at?: string;
};

function parseFeedback(raw: unknown): Feedback {
	try {
		if (raw && typeof raw === "object") return raw as Feedback;
		if (typeof raw === "string" && raw.trim().startsWith("{")) return JSON.parse(raw) as Feedback;
	} catch {
		/* fall through */
	}
	return {};
}

/**
 * The survivor confirms that the support they received has concluded and (optionally) rates it.
 * The case is archived once BOTH sides have confirmed; either order works. If the provider already
 * closed it, this only records the survivor's confirmation and rating. Only the survivor who
 * owns the match may call this, and only for a case that was accepted.
 */
export async function confirmCaseOutcome(matchId: string, input: { rating?: number; comment?: string }) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { success: false as const, error: "Please sign in." };

	const rating = input.rating == null ? undefined : Math.round(Number(input.rating));
	if (rating != null && !(rating >= 1 && rating <= 5)) return { success: false as const, error: "Rating must be between 1 and 5." };
	const comment = (input.comment ?? "").trim().slice(0, 1000);

	const admin = createAdminClient();
	const { data: match } = await admin
		.from("matched_services")
		.select("id, survivor_id, report_id, service_id, hrd_profile_id, match_status_type, feedback")
		.eq("id", matchId)
		.maybeSingle();
	if (!match || match.survivor_id !== user.id) return { success: false as const, error: "Case not found." };
	if (match.match_status_type !== "accepted" && match.match_status_type !== "completed") {
		return { success: false as const, error: "This case has not been accepted yet." };
	}
	const alreadyClosed = match.match_status_type === "completed";

	const fb = parseFeedback(match.feedback);
	if (fb.is_surv_complete) return { success: false as const, error: "You have already confirmed this case." };

	const next: Feedback = {
		...fb,
		is_surv_complete: true,
		survivor_completed_at: new Date().toISOString(),
		...(rating != null ? { survivor_rating: rating } : {}),
		...(comment ? { survivor_comment: comment } : {}),
	};
	const bothDone = alreadyClosed || next.is_prof_complete === true;

	const { error } = await admin
		.from("matched_services")
		.update({
			feedback: JSON.stringify(next),
			...(bothDone && !alreadyClosed ? { match_status_type: "completed" as const, completed_at: new Date().toISOString() } : {}),
		})
		.eq("id", matchId);
	if (error) return { success: false as const, error: "Could not save your response. Please try again." };

	if (bothDone && !alreadyClosed && match.report_id) {
		await admin.from("reports").update({ match_status: "completed" }).eq("report_id", match.report_id);
	}

	// Tell the provider.
	let providerId = match.hrd_profile_id;
	if (!providerId && match.service_id) {
		providerId = (await admin.from("support_services").select("user_id").eq("id", match.service_id).maybeSingle()).data?.user_id ?? null;
	}
	if (providerId) {
		await sendNotification({
			userId: providerId,
			type: "review_received",
			title: bothDone ? "Case completed" : "Survivor confirmed the case is complete",
			message: rating != null ? `The survivor rated their support ${rating}/5.` : "The survivor has confirmed that support is complete.",
			link: "/dashboard/cases",
			metadata: { match_id: matchId },
			sendEmail: false,
		}).catch((e) => console.error("case outcome notification failed:", e));
	}

	revalidatePath("/dashboard/reports");
	revalidatePath("/dashboard/cases");
	return { success: true as const, completed: bothDone };
}
