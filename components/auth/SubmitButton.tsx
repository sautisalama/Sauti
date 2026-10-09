"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Submit button that shows a spinner and locks while its form is being processed. */
export function SubmitButton({ children, pendingText, className, ...props }: React.ComponentProps<typeof Button> & { pendingText?: string }) {
	const { pending } = useFormStatus();
	return (
		<Button {...props} type="submit" disabled={pending || props.disabled} aria-busy={pending} className={className}>
			{pending ? (
				<span className="flex items-center justify-center gap-2">
					<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
					{pendingText ?? "Please wait..."}
				</span>
			) : (
				children
			)}
		</Button>
	);
}
