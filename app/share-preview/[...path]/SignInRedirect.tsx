"use client";

import { useEffect } from "react";

/** Sends a signed-out visitor to sign in, bringing them back to the link they opened. */
export function SignInRedirect({ next }: { next: string }) {
	const href = `/signin?next=${encodeURIComponent(next)}`;
	useEffect(() => {
		window.location.replace(`/signin?next=${encodeURIComponent(next + window.location.search)}`);
	}, [next]);
	return (
		<a href={href} className="mt-6 inline-block rounded-full bg-sauti-teal px-6 py-2.5 text-sm font-bold text-white">
			Sign in to open
		</a>
	);
}
