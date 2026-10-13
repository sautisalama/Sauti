"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { financeInvoice, type InvoiceRow } from "@/app/actions/finance";
import { getBrand } from "@/app/actions/mjengo-brand";
import type { Brand } from "@/lib/mjengo/brand";
import { MjengoLoader } from "../../../_components/MjengoLoader";

const money = (n: number, c: string) => `${c} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The invoice on the organisation's letterhead, ready to print or save as a PDF. */
export default function InvoicePrintPage() {
	const { id } = useParams<{ id: string }>();
	const [inv, setInv] = useState<InvoiceRow | null | undefined>(undefined);
	const [brand, setBrand] = useState<Brand | null>(null);

	useEffect(() => {
		unwrap(financeInvoice(id)).then(setInv).catch(() => setInv(null));
		unwrap(getBrand()).then(setBrand).catch(() => setBrand(null));
	}, [id]);

	if (inv === undefined || !brand) return <MjengoLoader label="Preparing the invoice" />;
	if (inv === null) return <p className="py-20 text-center text-serene-neutral-500">That invoice could not be opened.</p>;

	return (
		<div className="mx-auto max-w-3xl">
			<div className="mb-4 flex justify-end print:hidden"><Button className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print or save as PDF</Button></div>
			<article className="rounded-2xl border border-serene-neutral-200 bg-white p-10 print:rounded-none print:border-0 print:p-0" style={{ fontFamily: `"${brand.fonts.body}", system-ui, sans-serif` }}>
				<header>
					<div className={cn("flex items-center gap-4", brand.letterhead.align === "center" && "flex-col text-center", brand.letterhead.align === "right" && "flex-row-reverse text-right")}>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						{brand.logo && <img src={brand.logo} alt="" style={{ width: brand.letterhead.logoWidth }} className="object-contain" />}
						<div>
							<p className="text-2xl font-bold leading-tight" style={{ color: brand.palette.primary, fontFamily: `"${brand.fonts.heading}", sans-serif` }}>{brand.name}</p>
							{brand.tagline && <p className="text-sm" style={{ color: brand.palette.secondary }}>{brand.tagline}</p>}
							<p className="text-xs" style={{ color: brand.palette.muted }}>{[brand.address, brand.contact].filter(Boolean).join("  ·  ")}</p>
						</div>
					</div>
					{brand.letterhead.rule && <div className="mt-4 h-0.5 w-full" style={{ background: brand.palette.accent }} />}
				</header>

				<div className="mt-8 flex flex-wrap justify-between gap-6">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">Billed to</p>
						<p className="mt-1 text-base font-semibold">{inv.client_name}</p>
						{inv.client_address && <p className="text-sm text-serene-neutral-600">{inv.client_address}</p>}
						{inv.client_email && <p className="text-sm text-serene-neutral-600">{inv.client_email}</p>}
					</div>
					<div className="text-right text-sm">
						<p className="text-xl font-bold" style={{ color: brand.palette.primary, fontFamily: `"${brand.fonts.heading}", sans-serif` }}>Invoice</p>
						<p className="font-mono">{inv.number}</p>
						<p className="text-serene-neutral-600">Issued {format(parseISO(inv.issue_date), "d MMMM yyyy")}</p>
						{inv.due_date && <p className="text-serene-neutral-600">Due {format(parseISO(inv.due_date), "d MMMM yyyy")}</p>}
					</div>
				</div>

				<table className="mt-8 w-full text-sm">
					<thead>
						<tr className="border-b-2 text-left text-xs uppercase tracking-wider" style={{ borderColor: brand.palette.accent, color: brand.palette.muted }}>
							<th className="py-2 font-semibold">Description</th><th className="w-16 py-2 text-right font-semibold">Qty</th><th className="w-32 py-2 text-right font-semibold">Unit</th><th className="w-32 py-2 text-right font-semibold">Amount</th>
						</tr>
					</thead>
					<tbody>
						{inv.items.map((i, k) => (
							<tr key={k} className="border-b border-serene-neutral-100">
								<td className="py-2.5">{i.description}</td><td className="py-2.5 text-right tabular-nums">{i.qty}</td>
								<td className="py-2.5 text-right tabular-nums">{money(i.unit, inv.currency)}</td><td className="py-2.5 text-right tabular-nums">{money(i.qty * i.unit, inv.currency)}</td>
							</tr>
						))}
					</tbody>
				</table>

				<div className="ml-auto mt-6 w-64 space-y-1 text-sm">
					<p className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(inv.subtotal, inv.currency)}</span></p>
					{inv.tax_pct > 0 && <p className="flex justify-between"><span>Tax ({inv.tax_pct}%)</span><span className="tabular-nums">{money(inv.tax, inv.currency)}</span></p>}
					<p className="flex justify-between border-t-2 pt-2 text-base font-bold" style={{ borderColor: brand.palette.accent, color: brand.palette.primary }}><span>Total</span><span className="tabular-nums">{money(inv.total, inv.currency)}</span></p>
					{inv.status === "paid" && <p className="pt-1 text-right text-xs font-semibold uppercase tracking-wider text-emerald-700">Paid</p>}
				</div>

				{inv.notes && <p className="mt-10 whitespace-pre-wrap text-sm text-serene-neutral-700">{inv.notes}</p>}
			</article>
		</div>
	);
}
