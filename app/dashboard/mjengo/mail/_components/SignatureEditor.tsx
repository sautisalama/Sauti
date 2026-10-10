"use client";

import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { saveSignature } from "./api";

/** A small Tiptap editor for the email signature: bold, italic and links. */
export function SignatureEditor({ initial, onChange }: { initial: string; onChange: (html: string) => void }) {
	const editor = useEditor({
		immediatelyRender: false,
		content: initial,
		extensions: [
			StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, strike: false, link: { openOnClick: false, autolink: true } }),
			Placeholder.configure({ placeholder: "Your name, role, organisation, phone" }),
		],
		editorProps: { attributes: { class: "prose prose-sm max-w-none min-h-[110px] rounded-xl border border-serene-neutral-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" } },
		onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
	});

	const setLink = () => {
		if (!editor) return;
		const url = window.prompt("Link address (https://...)", "https://");
		if (url === null) return;
		if (!url.trim()) editor.chain().focus().unsetLink().run();
		else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
	};

	return (
		<div className="space-y-2">
			<div className="flex gap-1">
				<Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => editor?.chain().focus().toggleBold().run()} aria-label="Bold"><Bold className="h-4 w-4" /></Button>
				<Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => editor?.chain().focus().toggleItalic().run()} aria-label="Italic"><Italic className="h-4 w-4" /></Button>
				<Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={setLink} aria-label="Link"><Link2 className="h-4 w-4" /></Button>
			</div>
			<EditorContent editor={editor} />
		</div>
	);
}

/** Settings section: edit and save the signature. */
export function SignatureSettings({ initial, onSaved }: { initial: string; onSaved: (html: string) => void }) {
	const { toast } = useToast();
	const [html, setHtml] = useState(initial);
	const [busy, setBusy] = useState(false);
	return (
		<section className="space-y-2">
			<h3 className="text-sm font-bold">Signature</h3>
			<p className="text-xs text-serene-neutral-500">Added to the bottom of every new message and reply.</p>
			<SignatureEditor initial={initial} onChange={setHtml} />
			<Button
				size="sm"
				disabled={busy}
				className="gap-1.5"
				onClick={async () => {
					setBusy(true);
					try {
						const r = await saveSignature(html);
						onSaved(r.html);
						toast({ title: r.configured ? "Signature saved" : "Signature removed" });
					} catch (e) {
						toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
					} finally {
						setBusy(false);
					}
				}}
			>
				{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save signature
			</Button>
		</section>
	);
}
