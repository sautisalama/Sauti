"use client";

import { sceneDataUrl, type SizeId } from "@/lib/mjengo/design-templates";
import { cn } from "@/lib/utils";

const Line = ({ w, className }: { w: string; className?: string }) => <span className={cn("block h-[3px] rounded-full bg-black/15", className)} style={{ width: w }} />;
const Avatar = ({ className }: { className?: string }) => <span className={cn("block h-3 w-3 shrink-0 rounded-full bg-gradient-to-br from-[#00C4CC] to-[#7D2AE8]", className)} />;
const Pic = ({ scene, color, className }: { scene: "hills" | "people" | "city" | "portrait"; color: string; className?: string }) => (
	// eslint-disable-next-line @next/next/no-img-element
	<img alt="" src={sceneDataUrl(scene, color, 240, 180)} className={cn("block w-full object-cover", className)} />
);

/** What each size is for, drawn as the post it becomes: so a size tile reads as a place to post, not a swatch. */
export function SizeMock({ size, className }: { size: SizeId; className?: string }) {
	const shell = "overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/10";
	if (size === "instagram") {
		return (
			<div className={cn(shell, "w-[74px]", className)}>
				<div className="flex items-center gap-1 p-1"><Avatar /><Line w="40%" /></div>
				<Pic scene="hills" color="#7D2AE8" className="aspect-square" />
				<div className="space-y-1 p-1"><div className="flex gap-1"><span className="h-2 w-2 rounded-full border border-black/30" /><span className="h-2 w-2 rounded-full border border-black/30" /></div><Line w="70%" /><Line w="45%" /></div>
			</div>
		);
	}
	if (size === "story" || size === "tiktok") {
		const tik = size === "tiktok";
		return (
			<div className={cn("relative aspect-[9/16] w-[46px] overflow-hidden rounded-lg shadow-sm ring-1 ring-black/10", tik ? "bg-black" : "bg-white", className)}>
				<Pic scene={tik ? "city" : "people"} color={tik ? "#00C4CC" : "#FF5C8A"} className="absolute inset-0 h-full" />
				{!tik && <span className="absolute inset-x-1 top-1 flex gap-0.5"><i className="h-[2px] flex-1 rounded bg-white" /><i className="h-[2px] flex-1 rounded bg-white/50" /><i className="h-[2px] flex-1 rounded bg-white/50" /></span>}
				<span className="absolute left-1 top-3 flex items-center gap-0.5"><Avatar className="h-2 w-2" /><Line w="14px" className="bg-white/80" /></span>
				{tik && <span className="absolute bottom-6 right-1 flex flex-col gap-1">{[0, 1, 2].map((i) => <i key={i} className="h-2 w-2 rounded-full bg-white/80" />)}</span>}
				<span className="absolute inset-x-1 bottom-1"><Line w="70%" className="bg-white/80" /></span>
			</div>
		);
	}
	if (size === "x") {
		return (
			<div className={cn(shell, "w-[96px] p-1.5", className)}>
				<div className="flex gap-1"><Avatar className="h-3.5 w-3.5" /><div className="min-w-0 flex-1 space-y-1"><Line w="45%" /><Line w="90%" /><Line w="60%" /><Pic scene="hills" color="#00C4CC" className="mt-1 aspect-video rounded" /></div></div>
			</div>
		);
	}
	if (size === "poster") {
		return (
			<div className={cn("aspect-[1/1.414] w-[54px] overflow-hidden rounded-sm bg-white p-1 shadow-sm ring-1 ring-black/10", className)}>
				<span className="block h-1.5 w-2/3 rounded-sm bg-[#7D2AE8]" />
				<Pic scene="people" color="#00C4CC" className="mt-1 aspect-[4/3] rounded-sm" />
				<span className="mt-1 block space-y-1"><Line w="90%" /><Line w="75%" /><Line w="50%" /></span>
			</div>
		);
	}
	// linkedin and facebook posts
	return (
		<div className={cn(shell, "w-[92px]", className)}>
			<div className="flex items-center gap-1 p-1"><Avatar className="h-3.5 w-3.5" /><div className="flex-1 space-y-0.5"><Line w="55%" /><Line w="30%" className="bg-black/10" /></div></div>
			<div className="space-y-0.5 px-1 pb-1"><Line w="90%" /><Line w="65%" /></div>
			<Pic scene={size === "linkedin" ? "city" : "hills"} color={size === "linkedin" ? "#068297" : "#3B82F6"} className="aspect-[1.91/1]" />
		</div>
	);
}
