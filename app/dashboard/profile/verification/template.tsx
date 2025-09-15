"use client";

import { Suspense } from "react";
import VerificationLoading from "./loading";

interface VerificationTemplateProps {
	children: React.ReactNode;
}

export default function VerificationTemplate({
	children,
}: VerificationTemplateProps) {
	return <Suspense fallback={<VerificationLoading />}>{children}</Suspense>;
}
