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
	FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
			if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
			autosaveTimerRef.current = setTimeout(() => {
				void save(editor.getHTML(), { autosave: true });
			}, 2000);
		},
		onBlur: ({ editor }) => {
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
				class: cn(
					"prose prose-sm max-w-none min-h-[300px] p-4 focus:outline-none",
					"text-sauti-dark font-medium leading-relaxed",
					"[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
					"[&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0",
					"tiptap"
				),
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

	useEffect(() => {
		if (!editor) return;
		if (currentReportIdRef.current !== report.report_id) {
			currentReportIdRef.current = report.report_id;
			if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
			editor.commands.setContent(initialHtml || "", { emitUpdate: false });
			setDirty(false);
			setLastSavedAt(null);
		}
	}, [editor, initialHtml, report.report_id]);

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

	useEffect(() => {
		return () => {
			if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
		};
	}, []);

	const insertOrEditLink = useCallback(() => {
		if (!editor || !editor.chain) return;
		const prev = editor.getAttributes("link").href as string | undefined;
		const url = prompt("Enter URL:", prev ?? "https://");
		if (url === null) return;
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
	const prevent = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

	if (!editor) return null;

	const ToolbarButton = ({ 
		active, 
		onClick, 
		children,
		disabled = false,
		className: extraClassName,
		title
	}: { 
		active?: boolean; 
		onClick: () => void; 
		children: React.ReactNode;
		disabled?: boolean;
		className?: string;
		title?: string;
	}) => (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={cn(
				"h-8 w-8 p-0 rounded-lg transition-colors",
				active 
					? "bg-sauti-teal/10 text-sauti-teal" 
					: "text-serene-neutral-500 hover:text-sauti-teal hover:bg-sauti-teal/5",
				extraClassName
			)}
		>
			{children}
		</Button>
	);

	return (
		<div className="rounded-xl border border-serene-neutral-200 bg-white overflow-hidden transition-all duration-300 focus-within:border-sauti-teal/50 focus-within:ring-2 focus-within:ring-sauti-teal/10 h-full flex flex-col">
			{/* Floating Bubble Menu */}
			<BubbleMenu editor={editor} className="flex gap-1 p-1.5 bg-white border border-serene-neutral-200 rounded-xl shadow-xl shadow-slate-200/50 animate-in fade-in zoom-in-95 duration-200">
				<ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
					<Bold className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
					<Italic className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton active={editor.isActive("link")} onClick={insertOrEditLink} title="Link">
					<LinkIcon className="h-3.5 w-3.5" />
				</ToolbarButton>
			</BubbleMenu>

			{/* Header area */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-serene-neutral-100 bg-white">
				<div className="flex items-center gap-2">
					<div className="p-1.5 bg-sauti-teal/10 rounded-lg">
						<FileText className="h-3.5 w-3.5 text-sauti-teal" />
					</div>
					<span className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-widest">Report Journal</span>
				</div>
				<div className="flex items-center gap-3">
					{saving ? (
						<span className="flex items-center gap-1.5 text-sauti-teal animate-in fade-in duration-300">
							<Loader2 className="h-3 w-3 animate-spin" />
							<span className="text-[10px] font-bold uppercase tracking-wider">Saving</span>
						</span>
					) : dirty ? (
						<span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider animate-in fade-in duration-300">Unsaved Changes</span>
					) : lastSavedAt ? (
						<span className="flex items-center gap-1.5 text-serene-green-600 animate-in fade-in zoom-in-95 duration-500">
							<Check className="h-3 w-3" />
							<span className="text-[10px] font-bold uppercase tracking-wider">Saved at {lastSavedAt}</span>
						</span>
					) : null}
					
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => save()}
						disabled={saving || !dirty}
						className={cn(
							"h-7 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border",
							dirty 
								? "bg-sauti-teal text-white hover:bg-sauti-teal/90 border-sauti-teal" 
								: "text-serene-neutral-400 border-serene-neutral-100"
						)}
					>
						<Save className="h-3 w-3 mr-1.5" /> Save
					</Button>
				</div>
			</div>

			{/* Toolbar */}
			<div className="flex items-center gap-1 p-1.5 bg-serene-neutral-50/50 border-b border-serene-neutral-100 overflow-x-auto no-scrollbar scrollbar-hide" onMouseDown={prevent}>
				<ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
					<Undo2 className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
					<Redo2 className="h-3.5 w-3.5" />
				</ToolbarButton>
				
				<div className="w-px h-4 bg-serene-neutral-200 mx-1" />
				
				<ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
					<Bold className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
					<Italic className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
					<Underline className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strike">
					<Strikethrough className="h-3.5 w-3.5" />
				</ToolbarButton>

				<div className="w-px h-4 bg-serene-neutral-200 mx-1" />

				<ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2">
					<Heading2 className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3">
					<Heading3 className="h-3.5 w-3.5" />
				</ToolbarButton>

				<div className="w-px h-4 bg-serene-neutral-200 mx-1" />

				<ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullets">
					<List className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbers">
					<ListOrdered className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
					<Quote className="h-3.5 w-3.5" />
				</ToolbarButton>

				<div className="w-px h-4 bg-serene-neutral-200 mx-1" />

				<ToolbarButton active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Left">
					<AlignLeft className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Center">
					<AlignCenter className="h-3.5 w-3.5" />
				</ToolbarButton>

				<div className="w-px h-4 bg-serene-neutral-200 mx-1" />

				<ToolbarButton active={editor.isActive("link")} onClick={insertOrEditLink} title="Link">
					<LinkIcon className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton onClick={onPickImage} title="Image">
					<ImageIcon className="h-3.5 w-3.5" />
				</ToolbarButton>
				
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
			</div>

			{/* Editor Area */}
			<div className="flex-1 bg-white overflow-hidden">
				<EditorContent editor={editor} className="h-full overflow-y-auto" />
			</div>
		</div>
	);
}
