"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorScreen } from "@/components/ErrorScreen";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => { Sentry.captureException(error); }, [error]);
	return (
		<html lang="en">
			<body>
				<ErrorScreen error={error} reset={reset} full />
			</body>
		</html>
	);
}
