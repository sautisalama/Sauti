"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
	return (
		<button
			type="button"
			onClick={() => window.print()}
			className="inline-flex h-10 items-center gap-2 rounded-xl border border-serene-neutral-200 bg-white px-4 text-sm font-semibold text-serene-neutral-800 transition-[transform,background-color] duration-150 ease-out hover:bg-serene-neutral-50 active:scale-[0.98]"
		>
			<Printer className="size-4" aria-hidden /> Print
		</button>
	);
}
