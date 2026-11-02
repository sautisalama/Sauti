"use client";

import { useCallback, useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { FilePreviewDialog, type PreviewSource } from "../../_components/FilePreviewDialog";

export interface MailAttachment { index: number; filename: string; size: number; contentType: string }

const sizeText = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** A message's attachments. Clicking one shows it in a window over the mail, like Gmail does; the download stays one click away. */
export function AttachmentList({ accountId, mailbox, uid, attachments }: { accountId: string; mailbox: string; uid: number; attachments: MailAttachment[] }) {
	const [open, setOpen] = useState<number | null>(null);
	const href = useCallback((i: number, inline: boolean) => `/api/mjengo/mail/attachment?account=${encodeURIComponent(accountId)}&mailbox=${encodeURIComponent(mailbox)}&uid=${uid}&i=${i}${inline ? "&inline=1" : ""}`, [accountId, mailbox, uid]);
	const pos = attachments.findIndex((a) => a.index === open);
	const current = pos >= 0 ? attachments[pos] : null;
	const load = useCallback(async (): Promise<PreviewSource> => {
		if (!current) throw new Error("No attachment.");
		return { name: current.filename, mime: current.contentType, size: current.size, url: href(current.index, true), downloadUrl: href(current.index, false) };
	}, [current, href]);
	const go = useMemo(() => (by: number) => () => setOpen(attachments[(pos + by + attachments.length) % attachments.length].index), [attachments, pos]);
	if (attachments.length === 0) return null;
	return (
		<>
			<ul className="mt-3 flex flex-wrap gap-2">
				{attachments.map((att) => (
					<li key={att.index}>
						<button type="button" onClick={() => setOpen(att.index)} aria-label={`Preview ${att.filename}`} className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/[0.03]">
							<Paperclip className="h-4 w-4 text-[#787774]" /><span className="max-w-[200px] truncate">{att.filename}</span><span className="text-xs text-[#9b9a97]">{sizeText(att.size)}</span>
						</button>
					</li>
				))}
			</ul>
			<FilePreviewDialog
				open={open !== null}
				onClose={() => setOpen(null)}
				load={load}
				label={current?.filename}
				position={attachments.length > 1 && pos >= 0 ? `${pos + 1} of ${attachments.length}` : undefined}
				onPrev={attachments.length > 1 ? go(-1) : undefined}
				onNext={attachments.length > 1 ? go(1) : undefined}
			/>
		</>
	);
}
