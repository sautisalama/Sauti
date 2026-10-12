"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { openRouterBalance, type OpenRouterBalance as Balance } from "@/app/actions/mjengo-openrouter";

const usd = (n: number) => `$${n.toFixed(n < 10 ? 2 : 0)}`;

/** A slim strip for the one account that tops up AI credit: how much is left, and a loud warning when it runs out. */
export function OpenRouterBalance() {
	const [b, setB] = useState<Balance | null>(null);
	useEffect(() => {
		let live = true;
		const load = () => unwrap(openRouterBalance()).then((r) => live && setB(r)).catch(() => live && setB(null));
		load();
		const t = setInterval(load, 5 * 60_000);
		const onFocus = () => load();
		window.addEventListener("focus", onFocus);
		return () => { live = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
	}, []);
	if (!b) return null;
	const bad = b.exhausted || b.low;
	return (
		<div role={b.exhausted ? "alert" : "status"} className={cn("flex shrink-0 items-center justify-center gap-2 px-3 py-1 text-xs font-medium", b.exhausted ? "bg-red-600 text-white" : b.low ? "bg-amber-100 text-amber-900" : "bg-serene-neutral-100 text-serene-neutral-600")}>
			{bad ? <AlertTriangle className="h-3.5 w-3.5" /> : <Coins className="h-3.5 w-3.5" />}
			{b.exhausted
				? "OpenRouter credit is used up. AI features have stopped until you top up."
				: b.remaining !== null
					? <>OpenRouter credit: {usd(b.remaining)} left{b.total ? ` of ${usd(b.total)}` : ""}{b.low ? ". Top up soon." : ""}</>
					: <>OpenRouter spend so far: {b.used !== null ? usd(b.used) : "unknown"}</>}
			<a href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer" className="underline underline-offset-2">Top up</a>
		</div>
	);
}
