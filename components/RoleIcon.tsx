import Image from "next/image";

const ALT = { survivor: "Survivor", professional: "Service Provider", ngo: "NGO" } as const;

/**
 * Role artwork with a light and a dark variant. The dark layer is an `html.dark` class
 * (see globals.css), not a media query, so the swap is CSS: both render, one is hidden.
 */
export function RoleIcon({ role, size, className = "object-contain p-2" }: { role: keyof typeof ALT; size: number; className?: string }) {
	return (
		<>
			<Image src={`/icons/${role}-light.png`} alt={ALT[role]} width={size} height={size} className={`role-icon-light ${className}`} />
			<Image src={`/icons/${role}-dark.png`} alt="" aria-hidden width={size} height={size} className={`role-icon-dark ${className}`} />
		</>
	);
}
