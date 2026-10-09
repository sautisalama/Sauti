"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A password field with a button to show or hide what has been typed. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "type">>(function PasswordInput({ className, ...props }, ref) {
	const [visible, setVisible] = React.useState(false);
	return (
		<div className="relative">
			<Input ref={ref} {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
			<button
				type="button"
				onClick={() => setVisible((v) => !v)}
				aria-label={visible ? "Hide password" : "Show password"}
				aria-pressed={visible}
				className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 touch-manipulation items-center justify-center rounded-lg text-serene-neutral-400 transition-colors hover:text-serene-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sauti-blue"
			>
				{visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
			</button>
		</div>
	);
});
