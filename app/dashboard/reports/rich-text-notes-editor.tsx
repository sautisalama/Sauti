"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	AlignJustify,
	Bold,
	Code,
	Image as ImageIcon,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	Redo2,
	Save,
	Strikethrough,
	Underline,
	Undo2,
	Quote,
} from "lucide-react";
import { Tables } from "@/types/db-schema";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Tiptap imports
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import LinkExt from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import OrderedList from "@tiptap/extension-ordered-list";
import BulletList from "@tiptap/extension-bullet-list";
import ListItem from "@tiptap/extension-list-item";

export default function ReportNotesEditor({
	userId,
	report,
	onSaved,
}: {
	userId: string;
	report: Tables<"reports">;
	onSaved: (updated: Tables<"reports">) => void;
}) {
	const supabase = createClient();
	const { toast } = useToast();
	const [saving, setSaving] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const initialHtml = useMemo(() => report.notes || "", [report.notes]);

const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: false,
			}),
			// Explicit list extensions to ensure list behavior works reliably
			BulletList,
			OrderedList,
			ListItem,
			UnderlineExt,
			TextStyle,
			LinkExt.configure({
				openOnClick: false,
				autolink: true,
				linkOnPaste: true,
				HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
			}),
			ImageExt.configure({ allowBase64: true }),
			TextAlign.configure({
				types: ["paragraph"],
				alignments: ["left", "center", "right", "justify"],
			}),
			Placeholder.configure({
				placeholder: "Start writing your notes here...",
			}),
		],
		content: initialHtml,
		editable: true,
		onUpdate: ({ editor }) => {
			setDirty(true);
		},
		editorProps: {
			handlePaste: (view: any, e: ClipboardEvent) => {
				const items = (e.clipboardData?.items ||
					[]) as unknown as DataTransferItem[];
				const imageItems = Array.from(items).filter(
					(it) => it.kind === "file" && it.type.startsWith("image/")
				);
				if (imageItems.length > 0) {
					e.preventDefault();
					imageItems.forEach((it) => {
						const file = it.getAsFile();
						if (file) void uploadImage(file);
					});
					return true;
				}
				return false;
			},
			handleDrop: (view: any, e: DragEvent) => {
				const files = Array.from(e.dataTransfer?.files || []);
				const imageFiles = files.filter((f) => f.type.startsWith("image/"));
				if (imageFiles.length > 0) {
					e.preventDefault();
					imageFiles.forEach((f) => void uploadImage(f));
					return true;
				}
				return false;
			},
			attributes: {
				class:
					"tiptap prose-sm max-w-none focus:outline-none break-words whitespace-pre-wrap min-h-[300px] p-4",
			},
		},
	});

	const save = useCallback(
		async (html?: string, opts?: { autosave?: boolean }) => {
			if (!editor || !editor.getHTML) return;
			const autosave = opts?.autosave === true;
			try {
				setSaving(true);
				const content = html ?? editor.getHTML();
				const { data, error } = await supabase
					.from("reports")
					.update({ notes: content })
					.eq("report_id", report.report_id)
					.select()
					.single();
				if (error) throw error;
				setDirty(false);
				setLastSavedAt(new Date().toLocaleTimeString());
				onSaved(data as any);
				if (!autosave) {
					toast({
						title: "Notes saved",
						description: "Your notes for this report have been saved.",
					});
				}
			} catch (e: any) {
				if (!autosave) {
					toast({
						title: "Failed to save",
						description: e?.message || "Please try again.",
						variant: "destructive",
					});
				}
			} finally {
				setSaving(false);
			}
		},
		[editor, report.report_id, supabase, toast, onSaved]
	);

	// Keep editor content in sync if the selected report changes
	useEffect(() => {
		if (editor && initialHtml !== editor.getHTML()) {
			editor.commands.setContent(initialHtml || "", false);
			setDirty(false);
		}
	}, [editor, initialHtml]);

	// Save on Ctrl/Cmd+S
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const isCtrlS = (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S");
			if (isCtrlS) {
				e.preventDefault();
				void save();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [save]);

	// 30-second autosave interval (only when there are unsaved changes)
	useEffect(() => {
		const id = window.setInterval(() => {
			if (dirty) void save(undefined, { autosave: true });
		}, 30000);
		return () => window.clearInterval(id);
	}, [dirty, save]);

	const insertOrEditLink = useCallback(() => {
		if (!editor || !editor.chain) return;
		const prev = editor.getAttributes("link").href as string | undefined;
		const url = prompt("Enter URL:", prev ?? "https://");
		if (url === null) return; // cancelled
		if (url === "") {
			editor.chain().focus().unsetLink().run();
			return;
		}
		const href = /^(https?:)?\/\//i.test(url) ? url : `https://${url}`;
		editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
	}, [editor]);

	const uploadImage = useCallback(
		async (file: File) => {
			if (!file || !editor || !editor.chain) return;
			const path = `reports/${report.report_id}/${Date.now()}-${file.name}`;
			try {
				const { error } = await supabase.storage
					.from("report-media")
					.upload(path, file, { contentType: file.type, upsert: true });
				if (error) throw error;
				const { data: urlData } = supabase.storage
					.from("report-media")
					.getPublicUrl(path);
				const src = urlData?.publicUrl;
				if (src) {
					editor?.chain().focus().setImage({ src, alt: file.name }).run();
					toast({
						title: "Image inserted",
						description: "Uploaded to report-media and inserted.",
					});
					return;
				}
				throw new Error("Failed to resolve public URL");
			} catch (err) {
				// Fallback to inline base64 to avoid data loss
				try {
					const dataUrl = await new Promise<string>((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => resolve(String(reader.result));
						reader.onerror = () => reject(reader.error);
						reader.readAsDataURL(file);
					});
					editor?.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
					toast({
						title: "Inserted inline image",
						description: "Upload failed; inserted as inline image instead.",
					});
				} catch (e) {
					toast({
						title: "Failed to insert image",
						description: String(e),
						variant: "destructive",
					});
				}
			}
		},
		[editor, report.report_id, supabase, toast]
	);

	const onPickImage = useCallback(() => fileInputRef.current?.click(), []);

	// Prevent editor losing selection when toolbar is clicked
	const prevent = useCallback((e: any) => e.preventDefault(), []);

	if (!editor || !editor.chain) return null;

	return (
		<div className="flex flex-col h-full bg-white rounded-2xl border border-serene-neutral-200 shadow-sm overflow-hidden">
			<style jsx>{`
				/* Tiptap premium styles */
				.tiptap :global(.ProseMirror) {
					outline: none;
					color: #1f2937;
					font-size: 0.9375rem;
					line-height: 1.7;
				}
				.tiptap :global(.ProseMirror p.is-editor-empty:first-child::before) {
					content: attr(data-placeholder);
					color: #9ca3af;
					float: left;
					height: 0;
					pointer-events: none;
					font-style: italic;
				}
				.tiptap :global(img) {
					max-width: 100%;
					height: auto;
				}
				.tiptap :global(blockquote) {
					border-left: 3px solid #1A3434;
					margin: 1rem 0;
					padding-left: 1rem;
					color: #4b5563;
					background: linear-gradient(90deg, rgba(26, 52, 52, 0.05) 0%, transparent 100%);
					border-radius: 0 0.5rem 0.5rem 0;
					padding: 0.75rem 1rem;
				}
				.tiptap :global(pre) {
					background: #f8fafc;
					border-radius: 0.75rem;
					border: 1px solid #e2e8f0;
					padding: 0.875rem 1rem;
					font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
						"Liberation Mono", "Courier New", monospace;
					font-size: 0.8125rem;
					line-height: 1.6;
					overflow-x: auto;
				}
				/* Ensure lists render with styles even without typography plugin */
				.tiptap :global(ul) {
					list-style: disc;
					padding-left: 1.5rem;
					margin: 0.5rem 0;
				}
				.tiptap :global(ol) {
					list-style: decimal;
					padding-left: 1.5rem;
					margin: 0.5rem 0;
				}
				.tiptap :global(li) {
					margin: 0.25rem 0;
				}
				.tiptap :global(ul ul) {
					list-style: circle;
				}
				.tiptap :global(ol ol) {
					list-style: lower-alpha;
				}
			`}</style>

			{/* Premium Toolbar */}
			<div className="flex flex-col gap-3 p-4 bg-gradient-to-b from-serene-neutral-50 to-white border-b border-serene-neutral-100">
				<div className="flex items-center gap-1.5 flex-wrap" onMouseDown={prevent}>
					<span className="text-xs font-bold text-serene-neutral-500 uppercase tracking-wider mr-2">Format</span>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => editor.chain().focus().undo().run()}
						title="Undo"
					>
						<Undo2 className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => editor.chain().focus().redo().run()}
						title="Redo"
					>
						<Redo2 className="h-4 w-4" />
					</Button>
					<Separator orientation="vertical" className="h-4" />
					<Button
						type="button"
						variant={editor.isActive("bold") ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive("bold")
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().toggleBold().run()}
						title="Bold"
					>
						<Bold
							className={`h-4 w-4 ${editor.isActive("bold") ? "font-bold" : ""}`}
						/>
					</Button>
					<Button
						type="button"
						variant={editor.isActive("italic") ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive("italic")
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().toggleItalic().run()}
						title="Italic"
					>
						<Italic
							className={`h-4 w-4 ${editor.isActive("italic") ? "italic" : ""}`}
						/>
					</Button>
					<Button
						type="button"
						variant={editor.isActive("underline") ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive("underline")
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().toggleUnderline().run()}
						title="Underline"
					>
						<Underline
							className={`h-4 w-4 ${editor.isActive("underline") ? "underline" : ""}`}
						/>
					</Button>
					<Button
						type="button"
						variant={editor.isActive("strike") ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive("strike")
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().toggleStrike().run()}
						title="Strikethrough"
					>
						<Strikethrough
							className={`h-4 w-4 ${editor.isActive("strike") ? "line-through" : ""}`}
						/>
					</Button>
					<Separator orientation="vertical" className="h-4" />
					<Button
						type="button"
						variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive("bulletList")
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().toggleBulletList().run()}
						title="Bullet List"
					>
						<List className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive("orderedList")
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().toggleOrderedList().run()}
						title="Numbered List"
					>
						<ListOrdered className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant={editor.isActive("blockquote") ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive("blockquote")
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().toggleBlockquote().run()}
						title="Blockquote"
					>
						<Quote className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant={editor.isActive("codeBlock") ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive("codeBlock")
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().toggleCodeBlock().run()}
						title="Code Block"
					>
						<Code className="h-4 w-4" />
					</Button>
				</div>
				<div className="flex items-center gap-1.5 flex-wrap" onMouseDown={prevent}>
					<span className="text-xs font-bold text-serene-neutral-500 uppercase tracking-wider mr-2">Align</span>
					<Button
						type="button"
						variant={editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive({ textAlign: "left" })
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().setTextAlign("left").run()}
						title="Align Left"
					>
						<AlignLeft className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant={editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive({ textAlign: "center" })
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().setTextAlign("center").run()}
						title="Align Center"
					>
						<AlignCenter className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant={editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive({ textAlign: "right" })
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().setTextAlign("right").run()}
						title="Align Right"
					>
						<AlignRight className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant={
							editor.isActive({ textAlign: "justify" }) ? "secondary" : "ghost"
						}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive({ textAlign: "justify" })
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={() => editor.chain().focus().setTextAlign("justify").run()}
						title="Justify"
					>
						<AlignJustify className="h-4 w-4" />
					</Button>
					<Separator orientation="vertical" className="h-4" />
					<Button
						type="button"
						variant={editor.isActive("link") ? "secondary" : "ghost"}
						size="icon"
						className={`h-8 w-8 ${
							editor.isActive("link")
								? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
								: "hover:bg-serene-neutral-50"
						}`}
						onClick={insertOrEditLink}
						title="Insert/Edit Link"
					>
						<LinkIcon className="h-4 w-4" />
					</Button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) void uploadImage(file);
							// reset input so the same file can be picked again
							if (fileInputRef.current) fileInputRef.current.value = "";
						}}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 hover:bg-serene-neutral-50"
						onClick={onPickImage}
						title="Insert Image"
					>
						<ImageIcon className="h-4 w-4" />
					</Button>
					<div className="ml-auto flex items-center gap-4">
						<span className="text-xs font-medium text-serene-neutral-400">
							{saving ? (
								<span className="flex items-center gap-1.5">
									<span className="h-2 w-2 bg-sauti-teal rounded-full animate-pulse" />
									Saving…
								</span>
							) : dirty ? (
								<span className="text-amber-600">Unsaved changes</span>
							) : lastSavedAt ? (
								<span className="text-serene-green-600">Saved {lastSavedAt}</span>
							) : null}
						</span>
						<Button
							type="button"
							size="sm"
							onClick={() => save()}
							disabled={saving}
							className="h-9 px-4 bg-sauti-teal hover:bg-sauti-dark text-white font-semibold rounded-xl shadow-sm transition-all duration-200"
						>
							<Save className="h-4 w-4 mr-1.5" /> Save Notes
						</Button>
					</div>
				</div>
			</div>

			{/* Premium Editor Area */}
			<div className="flex-1 overflow-hidden bg-white">
				<EditorContent editor={editor} className="h-full overflow-y-auto p-6" />
			</div>
		</div>
	);
}
