"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import {
	AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CheckSquare, Code, Eraser, Highlighter,
	Image as ImageIcon, Italic, Link2, Link2Off, List, ListOrdered, Minus, Quote, Redo2, Strikethrough,
	Subscript as SubIcon, Superscript as SupIcon, Table as TableIcon, Underline as UnderlineIcon, Undo2,
	Youtube as YoutubeIcon, Loader2, X, Plus, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RichEditorProps {
	value: string;
	onChange: (html: string) => void;
	/** Upload an image and return its public URL. Enables the "upload" tab in the image dialog. */
	onUploadImage?: (file: File) => Promise<string>;
	placeholder?: string;
	minHeight?: number;
	className?: string;
	disabled?: boolean;
}

type Panel = null | "link" | "image" | "youtube";

const COLORS = ["#111827", "#1a365d", "#008080", "#b45309", "#b91c1c", "#6b21a8"];

export function RichEditor({
	value,
	onChange,
	onUploadImage,
	placeholder = "Start writing…",
	minHeight = 360,
	className,
	disabled,
}: RichEditorProps) {
	const [panel, setPanel] = useState<Panel>(null);
	const lastEmitted = useRef(value);

	const editor = useEditor({
		immediatelyRender: false,
		editable: !disabled,
		content: value,
		extensions: [
			// StarterKit v3 already bundles Link and Underline — configure, don't re-add.
			StarterKit.configure({
				heading: { levels: [1, 2, 3, 4] },
				link: {
					openOnClick: false,
					autolink: true,
					linkOnPaste: true,
					defaultProtocol: "https",
					protocols: ["http", "https", "mailto", "tel"],
					HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
				},
			}),
			Placeholder.configure({ placeholder }),
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			Highlight.configure({ multicolor: false }),
			Subscript,
			Superscript,
			Typography,
			TextStyle,
			Color,
			CharacterCount,
			Image.configure({ allowBase64: false }),
			Youtube.configure({ nocookie: true, controls: true, width: 640, height: 360 }),
			Table.configure({ resizable: false }),
			TableRow,
			TableHeader,
			TableCell,
			TaskList,
			TaskItem.configure({ nested: true }),
		],
		editorProps: {
			attributes: {
				class: "rich-content focus:outline-none px-5 py-4",
				style: `min-height:${minHeight}px`,
				"aria-label": "Article body",
				role: "textbox",
				"aria-multiline": "true",
			},
			handlePaste(view, event) {
				// Paste an image straight from the clipboard.
				const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
				if (file && onUploadImage) {
					event.preventDefault();
					onUploadImage(file)
						.then((url) => view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src: url, alt: "" }))))
						.catch(() => undefined);
					return true;
				}
				return false;
			},
		},
		onUpdate: ({ editor }) => {
			const html = editor.isEmpty ? "" : editor.getHTML();
			lastEmitted.current = html;
			onChange(html);
		},
	});

	// Load externally replaced content (import, "discard changes") without echoing our own edits back.
	useEffect(() => {
		if (!editor || value === lastEmitted.current) return;
		lastEmitted.current = value;
		editor.commands.setContent(value || "", { emitUpdate: false });
	}, [value, editor]);

	useEffect(() => {
		editor?.setEditable(!disabled);
	}, [disabled, editor]);

	if (!editor) {
		return <div className={cn("rounded-xl border border-gray-200 bg-white", className)} style={{ minHeight: minHeight + 48 }} />;
	}

	return (
		<div className={cn("rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#008080]/30", className)}
			onKeyDown={(e) => {
				if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
					e.preventDefault();
					setPanel("link");
				}
			}}
		>
			<Toolbar editor={editor} panel={panel} setPanel={setPanel} canUpload={!!onUploadImage} />
			{panel && <InsertPanel editor={editor} panel={panel} close={() => setPanel(null)} onUploadImage={onUploadImage} />}
			<EditorContent editor={editor} />
			<Footer editor={editor} />
		</div>
	);
}

function Footer({ editor }: { editor: Editor }) {
	const words = useEditorState({ editor, selector: (s) => s.editor.storage.characterCount?.words?.() ?? 0 });
	return (
		<div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500" aria-live="polite">
			<span>{words} words</span>
			<span>{Math.max(words ? 1 : 0, Math.round(words / 220))} min read</span>
		</div>
	);
}

function Btn({
	label, active, disabled, onClick, children,
}: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={active}
			disabled={disabled}
			onMouseDown={(e) => e.preventDefault()}
			onClick={onClick}
			className={cn(
				"inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent",
				active && "bg-[#008080]/10 text-[#008080]"
			)}
		>
			{children}
		</button>
	);
}
const Sep = () => <span aria-hidden className="mx-1 h-5 w-px bg-gray-200" />;

function Toolbar({
	editor, panel, setPanel, canUpload,
}: { editor: Editor; panel: Panel; setPanel: (p: Panel) => void; canUpload: boolean }) {
	const s = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"),
			strike: e.isActive("strike"), code: e.isActive("code"), highlight: e.isActive("highlight"),
			sub: e.isActive("subscript"), sup: e.isActive("superscript"), link: e.isActive("link"),
			bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), task: e.isActive("taskList"),
			quote: e.isActive("blockquote"), codeBlock: e.isActive("codeBlock"), table: e.isActive("table"),
			h: [1, 2, 3, 4].find((l) => e.isActive("heading", { level: l })) ?? 0,
			align: (["left", "center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
			canUndo: e.can().undo(), canRedo: e.can().redo(),
		}),
	});
	const c = () => editor.chain().focus();

	return (
		<div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-white px-2 py-1.5">
			<Btn label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()}><Undo2 className="h-4 w-4" /></Btn>
			<Btn label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()}><Redo2 className="h-4 w-4" /></Btn>
			<Sep />
			<select
				aria-label="Text style"
				value={s.h}
				onChange={(e) => {
					const l = Number(e.target.value);
					l ? c().setHeading({ level: l as 1 | 2 | 3 | 4 }).run() : c().setParagraph().run();
				}}
				className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700"
			>
				<option value={0}>Paragraph</option>
				<option value={1}>Heading 1</option>
				<option value={2}>Heading 2</option>
				<option value={3}>Heading 3</option>
				<option value={4}>Heading 4</option>
			</select>
			<Sep />
			<Btn label="Bold (Ctrl+B)" active={s.bold} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></Btn>
			<Btn label="Italic (Ctrl+I)" active={s.italic} onClick={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></Btn>
			<Btn label="Underline (Ctrl+U)" active={s.underline} onClick={() => c().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Btn>
			<Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Btn>
			<Btn label="Highlight" active={s.highlight} onClick={() => c().toggleHighlight().run()}><Highlighter className="h-4 w-4" /></Btn>
			<Btn label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}><Code className="h-4 w-4" /></Btn>
			<Btn label="Subscript" active={s.sub} onClick={() => c().toggleSubscript().run()}><SubIcon className="h-4 w-4" /></Btn>
			<Btn label="Superscript" active={s.sup} onClick={() => c().toggleSuperscript().run()}><SupIcon className="h-4 w-4" /></Btn>
			<span className="ml-1 flex items-center gap-1" role="group" aria-label="Text colour">
				{COLORS.map((col) => (
					<button
						key={col}
						type="button"
						aria-label={`Text colour ${col}`}
						title={`Text colour ${col}`}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => c().setColor(col).run()}
						className="h-4 w-4 rounded-full border border-white shadow ring-1 ring-gray-300"
						style={{ background: col }}
					/>
				))}
			</span>
			<Sep />
			<Btn label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></Btn>
			<Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Btn>
			<Btn label="Checklist" active={s.task} onClick={() => c().toggleTaskList().run()}><CheckSquare className="h-4 w-4" /></Btn>
			<Btn label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Btn>
			<Btn label="Code block" active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()}><Code className="h-4 w-4 rotate-90" /></Btn>
			<Btn label="Divider" onClick={() => c().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Btn>
			<Sep />
			<Btn label="Align left" active={s.align === "left"} onClick={() => c().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Btn>
			<Btn label="Align centre" active={s.align === "center"} onClick={() => c().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Btn>
			<Btn label="Align right" active={s.align === "right"} onClick={() => c().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Btn>
			<Btn label="Justify" active={s.align === "justify"} onClick={() => c().setTextAlign("justify").run()}><AlignJustify className="h-4 w-4" /></Btn>
			<Sep />
			<Btn label="Add or edit link (Ctrl+K)" active={s.link || panel === "link"} onClick={() => setPanel(panel === "link" ? null : "link")}><Link2 className="h-4 w-4" /></Btn>
			<Btn label="Remove link" disabled={!s.link} onClick={() => c().extendMarkRange("link").unsetLink().run()}><Link2Off className="h-4 w-4" /></Btn>
			<Btn label={canUpload ? "Insert image" : "Insert image from link"} active={panel === "image"} onClick={() => setPanel(panel === "image" ? null : "image")}><ImageIcon className="h-4 w-4" /></Btn>
			<Btn label="Embed YouTube video" active={panel === "youtube"} onClick={() => setPanel(panel === "youtube" ? null : "youtube")}><YoutubeIcon className="h-4 w-4" /></Btn>
			<Btn label="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="h-4 w-4" /></Btn>
			{s.table && (
				<span className="ml-1 flex items-center gap-1 rounded-md bg-gray-50 px-1" role="group" aria-label="Table controls">
					<TextBtn label="+ Row" onClick={() => c().addRowAfter().run()} />
					<TextBtn label="+ Col" onClick={() => c().addColumnAfter().run()} />
					<TextBtn label="− Row" onClick={() => c().deleteRow().run()} />
					<TextBtn label="− Col" onClick={() => c().deleteColumn().run()} />
					<button type="button" aria-label="Delete table" title="Delete table" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteTable().run()} className="p-1 text-red-600 hover:bg-red-50 rounded">
						<Trash2 className="h-3.5 w-3.5" />
					</button>
				</span>
			)}
			<Sep />
			<Btn label="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}><Eraser className="h-4 w-4" /></Btn>
		</div>
	);
}

function TextBtn({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="rounded px-1.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200">
			{label}
		</button>
	);
}

/** Normalise user-typed URLs: add https://, reject dangerous schemes. */
export function cleanUrl(raw: string): string | null {
	const v = raw.trim();
	if (!v) return null;
	if (/^(mailto:|tel:)/i.test(v)) return v;
	try {
		const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
		return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
	} catch {
		return null;
	}
}

function InsertPanel({
	editor, panel, close, onUploadImage,
}: { editor: Editor; panel: NonNullable<Panel>; close: () => void; onUploadImage?: (f: File) => Promise<string> }) {
	const existing = panel === "link" ? (editor.getAttributes("link").href as string | undefined) ?? "" : "";
	const [url, setUrl] = useState(existing);
	const [alt, setAlt] = useState("");
	const [text, setText] = useState("");
	const [err, setErr] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const hasSelection = !editor.state.selection.empty;

	useEffect(() => inputRef.current?.focus(), []);

	const submit = useCallback(() => {
		setErr(null);
		const clean = cleanUrl(url);
		if (!clean) return setErr(panel === "youtube" ? "Paste a YouTube link." : "Enter a valid link (https://…).");
		if (panel === "link") {
			if (hasSelection || editor.isActive("link")) {
				editor.chain().focus().extendMarkRange("link").setLink({ href: clean }).run();
			} else {
				editor.chain().focus().insertContent({ type: "text", text: text.trim() || clean, marks: [{ type: "link", attrs: { href: clean } }] }).run();
			}
		} else if (panel === "image") {
			editor.chain().focus().setImage({ src: clean, alt: alt.trim() }).run();
		} else {
			if (!/(youtube\.com|youtu\.be)/i.test(clean)) return setErr("Only YouTube links can be embedded.");
			editor.chain().focus().setYoutubeVideo({ src: clean }).run();
		}
		close();
	}, [url, alt, text, panel, editor, close, hasSelection]);

	const upload = async (file: File) => {
		setErr(null);
		if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) return setErr("Use a PNG, JPG, GIF or WebP image.");
		if (file.size > 8 * 1024 * 1024) return setErr("Images must be under 8 MB.");
		setBusy(true);
		try {
			const src = await onUploadImage!(file);
			editor.chain().focus().setImage({ src, alt: alt.trim() }).run();
			close();
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Upload failed.");
		} finally {
			setBusy(false);
		}
	};

	const title = { link: "Link to another source", image: "Insert image", youtube: "Embed YouTube video" }[panel];
	return (
		<div className="border-b border-gray-200 bg-[#f0fafa] px-3 py-3" role="group" aria-label={title}>
			<div className="mb-2 flex items-center justify-between">
				<p className="text-sm font-bold text-[#1a365d]">{title}</p>
				<button type="button" aria-label="Close" onClick={close} className="rounded p-1 text-gray-500 hover:bg-white"><X className="h-4 w-4" /></button>
			</div>
			<div className="flex flex-wrap items-end gap-2">
				{panel === "link" && !hasSelection && !editor.isActive("link") && (
					<label className="flex min-w-[10rem] flex-1 flex-col text-xs font-semibold text-gray-600">
						Text to show
						<input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. WHO guidance" className="mt-1 h-9 rounded-md border border-gray-300 bg-white px-2 text-sm font-normal" />
					</label>
				)}
				<label className="flex min-w-[14rem] flex-[2] flex-col text-xs font-semibold text-gray-600">
					{panel === "youtube" ? "YouTube link" : panel === "image" ? "Image link" : "URL"}
					<input
						ref={inputRef}
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
						placeholder="https://"
						inputMode="url"
						className="mt-1 h-9 rounded-md border border-gray-300 bg-white px-2 text-sm font-normal"
					/>
				</label>
				{panel === "image" && (
					<label className="flex min-w-[10rem] flex-1 flex-col text-xs font-semibold text-gray-600">
						Alt text (describe the image)
						<input value={alt} onChange={(e) => setAlt(e.target.value)} className="mt-1 h-9 rounded-md border border-gray-300 bg-white px-2 text-sm font-normal" />
					</label>
				)}
				<button type="button" onClick={submit} className="inline-flex h-9 items-center gap-1 rounded-md bg-[#008080] px-3 text-sm font-bold text-white hover:bg-[#006666]">
					<Plus className="h-4 w-4" /> {panel === "link" && existing ? "Update" : "Insert"}
				</button>
				{panel === "image" && onUploadImage && (
					<>
						<input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} aria-label="Upload image file" />
						<button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex h-9 items-center gap-1 rounded-md border border-[#008080] bg-white px-3 text-sm font-bold text-[#008080] hover:bg-[#f0fafa] disabled:opacity-50">
							{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} Upload
						</button>
					</>
				)}
			</div>
			{err && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{err}</p>}
		</div>
	);
}
