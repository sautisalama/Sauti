"use client";

import { Suspense } from "react";
import { VerificationSection } from "./verification-section";
import VerificationLoading from "./verification/loading";

interface VerificationWrapperProps {
	userId: string;
	userType: string;
	profile: any;
	onUpdate: () => void;
	onNavigateToServices: () => void;
}

export function VerificationWrapper({
	userId,
	userType,
	profile,
	onUpdate,
	onNavigateToServices,
}: VerificationWrapperProps) {
	return (
		<Suspense fallback={<VerificationLoading />}>
			<VerificationSection
				userId={userId}
				userType={userType}
				profile={profile}
				onUpdate={onUpdate}
				onNavigateToServices={onNavigateToServices}
			/>
		</Suspense>
	);
}
