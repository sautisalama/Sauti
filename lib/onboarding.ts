/**
 * Single rule for "is this person still being onboarded?", used by the dashboard page, sidebar,
 * bottom bar, top bar and reports view. They used to each carry a copy, and admins (who have no
 * professional title) were treated as unfinished: the sidebar showed "Setup in Progress" instead of
 * the admin navigation.
 */
export interface OnboardingProfile {
	user_type?: string | null;
	professional_title?: string | null;
	policies?: unknown;
	is_admin?: boolean | null;
	onboarded_by_admin?: boolean | null;
}

export function hasAcceptedPolicies(profile?: OnboardingProfile | null): boolean {
	return !!(profile?.policies as { all_policies_accepted?: boolean } | null | undefined)?.all_policies_accepted;
}

export function profileNeedsOnboarding(profile?: OnboardingProfile | null, opts: { includeAdminInvited?: boolean } = {}): boolean {
	if (!profile?.user_type) return true;
	if (!hasAcceptedPolicies(profile)) return true;
	if (opts.includeAdminInvited && profile.onboarded_by_admin) return true;
	// Admins run the platform; they do not offer a professional service, so no title is required.
	const isProvider = profile.user_type === "professional" || profile.user_type === "ngo";
	if (isProvider && !profile.is_admin && !profile.professional_title) return true;
	return false;
}
