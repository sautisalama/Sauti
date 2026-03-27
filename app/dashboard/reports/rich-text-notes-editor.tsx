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
	Check,
	Loader2,
	Heading2,
	Heading3,
	MinusSquare,
} from "lucide-react";
import { Tables } from "@/types/db-schema";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Tiptap imports
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import LinkExt from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";

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
	const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
	const isMountedRef = useRef(true);

	// Track report ID to detect report switching
	const currentReportIdRef = useRef(report.report_id);

	const initialHtml = useMemo(() => report.notes || "", [report.report_id, report.notes]);

	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				// StarterKit already includes: bulletList, orderedList, listItem,
				// blockquote, codeBlock, heading, horizontalRule, etc.
				// We configure what we need here:
				heading: {
					levels: [2, 3],
				},
			}),
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
				types: ["heading", "paragraph"],
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
			// Debounced autosave: 2s after last keystroke (industry best practice)
			if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
			autosaveTimerRef.current = setTimeout(() => {
				void save(editor.getHTML(), { autosave: true });
			}, 2000);
		},
		onBlur: ({ editor }) => {
			// Immediately save on blur if dirty
			if (dirty) {
				if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
				void save(editor.getHTML(), { autosave: true });
			}
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
					"tiptap-editor prose prose-sm max-w-none focus:outline-none break-words whitespace-pre-wrap min-h-[300px] p-4",
			},
		},
	});

	useEffect(() => {
		isMountedRef.current = true;
		return () => { isMountedRef.current = false; };
	}, []);

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
				if (isMountedRef.current) {
					setDirty(false);
					setLastSavedAt(new Date().toLocaleTimeString());
				}
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
				if (isMountedRef.current) setSaving(false);
			}
		},
		[editor, report.report_id, supabase, toast, onSaved]
	);

	// Sync editor when the selected report changes
	useEffect(() => {
		if (!editor) return;
		
		// Only replace content when the report actually changes
		if (currentReportIdRef.current !== report.report_id) {
			currentReportIdRef.current = report.report_id;
			// Cancel any pending autosave for the old report
			if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
			editor.commands.setContent(initialHtml || "", { emitUpdate: false });
			setDirty(false);
			setLastSavedAt(null);
		}
	}, [editor, initialHtml, report.report_id]);

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

	// Cleanup autosave timer on unmount
	useEffect(() => {
		return () => {
			if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
		};
	}, []);

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

	const ToolbarBtn = ({
		active,
		onClick,
		children,
		title,
		disabled = false,
	}: {
		active?: boolean;
		onClick: () => void;
		children: React.ReactNode;
		title: string;
		disabled?: boolean;
	}) => (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			disabled={disabled}
			className={`h-8 w-8 transition-all duration-150 ${
				active
					? "bg-sauti-teal/10 text-sauti-teal border border-sauti-teal/20 shadow-sm"
					: "hover:bg-serene-neutral-50 text-serene-neutral-600"
			}`}
			onClick={onClick}
			title={title}
		>
			{children}
		</Button>
	);

	return (
		<div className="flex flex-col h-full bg-white rounded-2xl border border-serene-neutral-200 shadow-sm overflow-hidden">
			{/* Tiptap editor styles */}
			<style>{`
				.tiptap-editor {
					outline: none;
					color: #1f2937;
					font-size: 0.9375rem;
					line-height: 1.7;
				}
				.tiptap-editor p.is-editor-empty:first-child::before {
					content: attr(data-placeholder);
					color: #9ca3af;
					float: left;
					height: 0;
					pointer-events: none;
					font-style: italic;
				}
				.tiptap-editor img {
					max-width: 100%;
					height: auto;
					border-radius: 0.5rem;
				}
				.tiptap-editor blockquote {
					border-left: 3px solid #1A3434;
					margin: 1rem 0;
					padding: 0.75rem 1rem;
					color: #4b5563;
					background: linear-gradient(90deg, rgba(26, 52, 52, 0.05) 0%, transparent 100%);
					border-radius: 0 0.5rem 0.5rem 0;
				}
				.tiptap-editor pre {
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
				.tiptap-editor ul {
					list-style: disc;
					padding-left: 1.5rem;
					margin: 0.5rem 0;
				}
				.tiptap-editor ol {
					list-style: decimal;
					padding-left: 1.5rem;
					margin: 0.5rem 0;
				}
				.tiptap-editor li {
					margin: 0.25rem 0;
				}
				.tiptap-editor li p {
					margin: 0;
				}
				.tiptap-editor ul ul {
					list-style: circle;
				}
				.tiptap-editor ol ol {
					list-style: lower-alpha;
				}
				.tiptap-editor h2 {
					font-size: 1.25rem;
					font-weight: 700;
					margin: 1.5rem 0 0.5rem;
					color: #111827;
				}
				.tiptap-editor h3 {
					font-size: 1.1rem;
					font-weight: 600;
					margin: 1.25rem 0 0.5rem;
					color: #1f2937;
				}
				.tiptap-editor a {
					color: #1A3434;
					text-decoration: underline;
					cursor: pointer;
				}
				.tiptap-editor hr {
					border: none;
					border-top: 2px solid #e5e7eb;
					margin: 1.5rem 0;
				}
				/* Bubble menu styling */
				.tiptap-bubble-menu {
					display: flex;
					gap: 2px;
					padding: 4px;
					background: white;
					border-radius: 0.75rem;
					border: 1px solid #e5e7eb;
					box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
				}
			`}</style>

			{/* Floating Bubble Menu — appears on text selection for quick formatting */}
			{editor && (
				<BubbleMenu editor={editor} className="tiptap-bubble-menu">
					<ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
						<Bold className="h-3.5 w-3.5" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
						<Italic className="h-3.5 w-3.5" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
						<Underline className="h-3.5 w-3.5" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
						<Strikethrough className="h-3.5 w-3.5" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("link")} onClick={insertOrEditLink} title="Link">
						<LinkIcon className="h-3.5 w-3.5" />
					</ToolbarBtn>
				</BubbleMenu>
			)}

			{/* Premium Toolbar */}
			<div className="flex flex-col gap-2 p-3 bg-gradient-to-b from-serene-neutral-50 to-white border-b border-serene-neutral-100">
				<div className="flex items-center gap-1 flex-wrap" onMouseDown={prevent}>
					<ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
						<Undo2 className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
						<Redo2 className="h-4 w-4" />
					</ToolbarBtn>
					<Separator orientation="vertical" className="h-4 mx-1" />
					<ToolbarBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
						<Heading2 className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
						<Heading3 className="h-4 w-4" />
					</ToolbarBtn>
					<Separator orientation="vertical" className="h-4 mx-1" />
					<ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
						<Bold className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
						<Italic className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
						<Underline className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
						<Strikethrough className="h-4 w-4" />
					</ToolbarBtn>
					<Separator orientation="vertical" className="h-4 mx-1" />
					<ToolbarBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
						<List className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
						<ListOrdered className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
						<Quote className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block">
						<Code className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
						<MinusSquare className="h-4 w-4" />
					</ToolbarBtn>
				</div>
				<div className="flex items-center gap-1 flex-wrap" onMouseDown={prevent}>
					<ToolbarBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align Left">
						<AlignLeft className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align Center">
						<AlignCenter className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align Right">
						<AlignRight className="h-4 w-4" />
					</ToolbarBtn>
					<ToolbarBtn active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justify">
						<AlignJustify className="h-4 w-4" />
					</ToolbarBtn>
					<Separator orientation="vertical" className="h-4 mx-1" />
					<ToolbarBtn active={editor.isActive("link")} onClick={insertOrEditLink} title="Insert/Edit Link">
						<LinkIcon className="h-4 w-4" />
					</ToolbarBtn>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) void uploadImage(file);
							if (fileInputRef.current) fileInputRef.current.value = "";
						}}
					/>
					<ToolbarBtn onClick={onPickImage} title="Insert Image">
						<ImageIcon className="h-4 w-4" />
					</ToolbarBtn>
					<div className="ml-auto flex items-center gap-3">
						<span className="text-xs font-medium text-serene-neutral-400">
							{saving ? (
								<span className="flex items-center gap-1.5 text-sauti-teal">
									<Loader2 className="h-3 w-3 animate-spin" />
									Saving…
								</span>
							) : dirty ? (
								<span className="text-amber-600">Unsaved changes</span>
							) : lastSavedAt ? (
								<span className="flex items-center gap-1 text-serene-green-600">
									<Check className="h-3 w-3" /> Saved {lastSavedAt}
								</span>
							) : null}
						</span>
						<Button
							type="button"
							size="sm"
							onClick={() => save()}
							disabled={saving || !dirty}
							className="h-8 px-3.5 bg-sauti-teal hover:bg-sauti-dark text-white font-semibold rounded-xl shadow-sm transition-all duration-200 text-xs"
						>
							<Save className="h-3.5 w-3.5 mr-1.5" /> Save
						</Button>
					</div>
				</div>
			</div>

			{/* Premium Editor Area */}
			<div className="flex-1 overflow-hidden bg-white">
				<EditorContent editor={editor} className="h-full overflow-y-auto" />
			</div>
		</div>
	);
}
