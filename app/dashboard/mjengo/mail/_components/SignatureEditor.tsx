"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { AlignCenter, AlignLeft, AlignRight, Bold, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Redo2, RemoveFormatting, Underline as UnderlineIcon, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { putToSignedUrl } from "@/lib/client/upload";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { signatureImageUpload } from "@/app/actions/mjengo-signatures";
import { saveSignature } from "./api";

/** Images keep a width, so a logo can be small and a banner wide. */
const SizedImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			width: {
				default: null,
				parseHTML: (el) => el.getAttribute("width"),
				renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
			},
		};
	},
});

const COLORS = ["#111827", "#6b7280", "#068297", "#2563eb", "#7c3aed", "#dc2626", "#ea580c", "#16a34a"];
const SIZES = [["Small", 80], ["Medium", 160], ["Large", 320]] as const;

function Tool({ on, onClick, label, children, disabled }: { on?: boolean; onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean }) {
	return (
		<button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} aria-pressed={on} className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#787774] hover:bg-black/5 disabled:opacity-30", on && "bg-sauti-teal-light text-sauti-dark")}>
			{children}
		</button>
	);
}

/** A WYSIWYG editor for the email signature: type, format, colour, align, lists, links and pictures. */
export function SignatureEditor({ initial, onChange }: { initial: string; onChange: (html: string) => void }) {
	const { toast } = useToast();
	const pick = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [, bump] = useState(0);

	const editor = useEditor({
		immediatelyRender: false,
		content: initial,
		extensions: [
			StarterKit.configure({ blockquote: false, codeBlock: false, code: false, horizontalRule: false, link: { openOnClick: false, autolink: true } }),
			Underline,
			TextStyle,
			Color,
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			SizedImage.configure({ inline: true, allowBase64: false }),
			Placeholder.configure({ placeholder: "Your name, role, organisation, phone" }),
		],
		editorProps: { attributes: { class: "prose prose-sm max-w-none min-h-[160px] px-4 py-3 focus:outline-none [&_img]:inline-block [&_img]:max-w-full" } },
		onUpdate: ({ editor: ed }) => { onChange(ed.getHTML()); bump((n) => n + 1); },
		onSelectionUpdate: () => bump((n) => n + 1),
	});

	const setLink = (ed: Editor) => {
		const prev = ed.getAttributes("link").href as string | undefined;
		const url = window.prompt("Link address (https://...)", prev ?? "https://");
		if (url === null) return;
		if (!url.trim()) ed.chain().focus().unsetLink().run();
		else ed.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
	};

	const addImage = async (files: FileList | null) => {
		const f = files?.[0];
		if (!f || !editor) return;
		if (!f.type.startsWith("image/") || f.size > 3 * 1024 * 1024) {
			toast({ title: "Use an image under 3 MB", variant: "destructive" });
			return;
		}
		setUploading(true);
		try {
			const { signedUrl, publicUrl } = await unwrap(signatureImageUpload(f.name));
			await putToSignedUrl(signedUrl, f);
			editor.chain().focus().setImage({ src: publicUrl, alt: "" }).updateAttributes("image", { width: 160 }).run();
		} catch (e) {
			toast({ title: "Could not add the picture", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setUploading(false);
			if (pick.current) pick.current.value = "";
		}
	};

	if (!editor) return <div className="h-48 animate-pulse rounded-xl bg-serene-neutral-50" />;
	const imageSelected = editor.isActive("image");

	return (
		<div className="overflow-hidden rounded-xl border border-black/10 bg-white focus-within:border-sauti-teal/60">
			<div className="flex flex-wrap items-center gap-0.5 border-b border-black/[0.07] bg-[#fafaf9] px-1.5 py-1">
				<Tool label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className="h-4 w-4" /></Tool>
				<Tool label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className="h-4 w-4" /></Tool>
				<span className="mx-1 h-5 w-px bg-black/10" />
				<select
					aria-label="Text style"
					value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p"}
					onChange={(e) => { const v = e.target.value; const c = editor.chain().focus(); if (v === "p") c.setParagraph().run(); else c.toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run(); }}
					className="h-8 rounded-md border border-black/10 bg-white px-1.5 text-sm"
				>
					<option value="p">Normal</option><option value="h1">Large</option><option value="h2">Medium</option><option value="h3">Small heading</option>
				</select>
				<span className="mx-1 h-5 w-px bg-black/10" />
				<Tool label="Bold" on={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Tool>
				<Tool label="Italic" on={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Tool>
				<Tool label="Underline" on={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Tool>
				<span className="mx-1 flex items-center gap-0.5">
					{COLORS.map((c) => (
						<button key={c} type="button" aria-label={`Text colour ${c}`} onClick={() => editor.chain().focus().setColor(c).run()} className={cn("h-4 w-4 rounded-full border border-black/10", editor.isActive("textStyle", { color: c }) && "ring-2 ring-sauti-teal ring-offset-1")} style={{ background: c }} />
					))}
				</span>
				<span className="mx-1 h-5 w-px bg-black/10" />
				<Tool label="Align left" on={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Tool>
				<Tool label="Align centre" on={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Tool>
				<Tool label="Align right" on={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Tool>
				<span className="mx-1 h-5 w-px bg-black/10" />
				<Tool label="Bulleted list" on={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Tool>
				<Tool label="Numbered list" on={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Tool>
				<Tool label="Link" on={editor.isActive("link")} onClick={() => setLink(editor)}><Link2 className="h-4 w-4" /></Tool>
				<Tool label="Add a picture" onClick={() => pick.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}</Tool>
				<input ref={pick} type="file" accept="image/*" className="hidden" onChange={(e) => addImage(e.target.files)} />
				<Tool label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="h-4 w-4" /></Tool>
			</div>
			{imageSelected && (
				<div className="flex items-center gap-2 border-b border-black/[0.07] bg-sauti-teal-light/30 px-3 py-1.5 text-xs">
					<span className="font-medium text-sauti-dark">Picture size</span>
					{SIZES.map(([l, w]) => <button key={l} type="button" onClick={() => editor.chain().focus().updateAttributes("image", { width: w }).run()} className="rounded-md border border-black/10 bg-white px-2 py-0.5 hover:bg-black/[0.03]">{l}</button>)}
					<button type="button" onClick={() => editor.chain().focus().deleteSelection().run()} className="ml-auto text-red-600 hover:underline">Remove</button>
				</div>
			)}
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
		<section className="space-y-3">
			<p className="text-sm text-serene-neutral-600">Added to the bottom of every new message and reply. Type it like a document: format it, colour it and add your logo or a photo.</p>
			<SignatureEditor initial={initial} onChange={setHtml} />
			<div className="flex items-center justify-end gap-2">
				<Button
					size="sm"
					disabled={busy}
					className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark"
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
			</div>
		</section>
	);
}
