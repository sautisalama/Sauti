"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorScreen } from "@/components/ErrorScreen";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => { Sentry.captureException(error); }, [error]);
	return <ErrorScreen error={error} reset={reset} />;
}
