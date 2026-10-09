"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A scannable QR for a link (a Sauti ID or a group invite), with a PNG download for printing or sharing. */
export function QrShare({ value, caption, filename }: { value: string; caption?: string; filename: string }) {
	const wrap = useRef<HTMLDivElement>(null);

	const download = () => {
		const canvas = wrap.current?.querySelector("canvas");
		if (!canvas) return;
		const a = document.createElement("a");
		a.href = canvas.toDataURL("image/png");
		a.download = `${filename}.png`;
		a.click();
	};

	return (
		<div className="flex flex-col items-center gap-3 rounded-2xl border border-serene-neutral-100 bg-white p-4">
			<div ref={wrap} className="rounded-xl bg-white p-3 ring-1 ring-serene-neutral-100">
				{/* High error correction + quiet zone keep it scannable from a screen or a printout. */}
				<QRCodeCanvas value={value} size={192} level="Q" marginSize={2} bgColor="#ffffff" fgColor="#3b0764" />
			</div>
			{caption && <p className="max-w-[240px] text-center text-xs text-serene-neutral-500">{caption}</p>}
			<Button size="sm" variant="outline" className="gap-1.5" onClick={download}>
				<Download className="h-4 w-4" /> Download QR
			</Button>
		</div>
	);
}
