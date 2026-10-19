/** What the verification of an opportunity found. Stored with the opportunity and shown on its card. */
export type TrustTier = "verified" | "likely" | "repost" | "unverified" | "suspicious";

export interface VerificationWebsite {
	url: string;
	host: string;
	title: string | null;
	description: string | null;
	image: string | null;
	favicon: string | null;
	siteName: string | null;
}

export interface VerificationCheck { id: string; label: string; ok: boolean; note?: string }

export interface Verification {
	status: "done" | "failed";
	at: string;
	trust: TrustTier;
	trustReason: string;
	/** Where the person found it: a social post, the organisation's own page, a repost site. */
	sourceKind: "social_post" | "official" | "repost" | "aggregator" | "unknown";
	sourceHost: string | null;
	/** The account that posted it, for example an Instagram handle. */
	account: string | null;
	/** Who the opportunity is from. */
	organisation: string | null;
	/** The organisation's own website (not the social post). */
	website: VerificationWebsite | null;
	/** Where to apply, if the post or page gives a link. */
	applyUrl: string | null;
	title: string | null;
	category: string | null;
	deadline: string | null;
	deadlineQuote: string | null;
	eligibility: string | null;
	deliverables: string | null;
	email: string | null;
	checks: VerificationCheck[];
	/** How the website was found. */
	foundBy: "post" | "page" | "link" | "bio" | "search" | null;
	error?: string;
}

export const TRUST_LABEL: Record<TrustTier, { label: string; hint: string }> = {
	verified: { label: "Verified source", hint: "The organisation's own website was found and matches." },
	likely: { label: "Looks genuine", hint: "A website was found, but it could not be matched fully. Check it before applying." },
	repost: { label: "Repost", hint: "This is a copy on another site. Use the organisation's own page." },
	unverified: { label: "Not verified", hint: "No official website could be found yet." },
	suspicious: { label: "Be careful", hint: "It asks for money or sends you to a site that is not the organisation's." },
};
