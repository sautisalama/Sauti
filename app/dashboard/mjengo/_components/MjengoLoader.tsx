import { LottieLoader } from "@/components/ui/LottieLoader";
import loadingHands from "@/public/lottie-animations/loading-hands.json";
import { cn } from "@/lib/utils";

/** The same animation the chats show while they open, used wherever a Mjengo section is loading. */
export function MjengoLoader({ label = "Loading", hint, compact, className }: { label?: string; hint?: string; compact?: boolean; className?: string }) {
	return (
		<div role="status" aria-live="polite" className={cn("flex w-full flex-col items-center justify-center text-center", compact ? "py-8" : "min-h-[50vh] py-16", className)}>
			<LottieLoader animationData={loadingHands} size={compact ? 96 : 168} />
			<p className="mt-2 animate-pulse text-sm font-semibold text-sauti-dark">{label}</p>
			{hint && <p className="mt-1 text-xs text-serene-neutral-500">{hint}</p>}
		</div>
	);
}
