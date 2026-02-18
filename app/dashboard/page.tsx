import { createClient, getSession } from "@/utils/supabase/server";
import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SurvivorView from "./_views/SurvivorView";
import AnonymousSurvivorView from "./_views/AnonymousSurvivorView";
import ProfessionalView from "./_views/ProfessionalView";
import OnboardingFlow from "./_views/OnboardingFlow";
import { Suspense } from "react";

export default async function Dashboard() {
	const user = await getUser();

	if (!user) {
		redirect("/signin");
	}

	// If anonymous, show dedicated incident management view
	// We check profile field, anon_username, or the email domain as redundant fallbacks
	const isAnonymous = user.is_anonymous || 
		!!user.anon_username || 
		user.email?.endsWith("@anon.sautisalama.org");

	// Check for policy acceptance in dedicated column
	const hasAcceptedPolicies = !!(user.policies as any)?.all_policies_accepted;

	if (isAnonymous) {
		return <AnonymousSurvivorView userId={user.id} profileDetails={user} />;
	}

	// If user exists but has no user_type, or is a pro without a title (incomplete onboarding), or hasn't accepted policies
	const needsOnboarding = 
		!user.user_type || 
		!hasAcceptedPolicies ||
		((user.user_type === 'professional' || user.user_type === 'ngo') && !user.professional_title);

	if (needsOnboarding) {
		return <OnboardingFlow />;
	}

	return (
		<Suspense fallback={<div className="p-6">Loading dashboard...</div>}>
			{user.user_type === "survivor" ? (
				<SurvivorView userId={user.id} profileDetails={user} />
			) : user.user_type === "professional" || user.user_type === "ngo" ? (
				<ProfessionalView userId={user.id} profileDetails={user} />
			) : (
				redirect("/error?message=Invalid user type")
			)}
		</Suspense>
	);
}
