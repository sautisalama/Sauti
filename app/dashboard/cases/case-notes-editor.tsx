"use client";

import { useCallback, useEffect, useMemo, useRef, useState, MouseEvent, TouchEvent } from "react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	AlignJustify,
	Bold,
	Code,
	Heading1,
	Heading2,
	Heading3,
	Heading4,
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
	PenLine,
	Loader2,
	CheckCircle2
} from "lucide-react";
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
import { TextStyle } from "@tiptap/extension-text-style";

export default function CaseNotesEditor({
	matchId,
	initialHtml,
	onSaved,
}: {
	matchId: string;
	initialHtml?: string;
	onSaved: (html: string) => void;
}) {
	const supabase = createClient();
	const { toast } = useToast();
	const [saving, setSaving] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const initialContent = useMemo(() => initialHtml || "", [initialHtml]);

	const editor = useEditor({
		immediatelyRender: false,

		extensions: [
			StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
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
			Placeholder.configure({ placeholder: "Add case notes..." }),
		],
		content: initialContent,
		editable: true,
		onUpdate: ({ editor }) => {
			setDirty(true);
		},
		editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none focus:outline-none p-[5px] min-h-[300px]",
            },
			handlePaste: (view, e: ClipboardEvent) => {

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
			handleDrop: (view, e: DragEvent) => {

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
					"prose prose-sm max-w-none min-h-[200px] p-4 focus:outline-none",
					"text-sauti-dark font-medium leading-relaxed",
					"[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
					"[&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0",
					"tiptap"
				),
			},
		},
	});

	useEffect(() => {
		if (!editor || !editor.commands) return;
		if (initialContent !== editor.getHTML()) {
			editor.commands.setContent(initialContent, { emitUpdate: false });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialContent]);

	const save = useCallback(
		async (html?: string, opts?: { autosave?: boolean }) => {
			if (!editor || !editor.getHTML) return;
			const autosave = opts?.autosave === true;
			try {
				setSaving(true);
				const content = html ?? editor.getHTML();
				const { error } = await supabase
					.from("matched_services")
					.update({ notes: content, updated_at: new Date().toISOString() })
					.eq("id", matchId);
				if (error) throw error;
				setDirty(false);
				setLastSavedAt(new Date().toLocaleTimeString());
				onSaved(content);
				if (!autosave)
					toast({
						title: "Notes saved",
						description: "Your case notes have been saved.",
					});
			} catch (e: unknown) {

				if (!autosave)
					toast({
						title: "Failed to save",
						description: (e as Error)?.message || "Please try again.",
						variant: "destructive",
					});

			} finally {
				setSaving(false);
			}
		},
		[editor, matchId, onSaved, supabase, toast]
	);

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
		if (url === null) return;
		if (url === "") return void editor.chain().focus().unsetLink().run();
		const href = /^(https?:)?\/\//i.test(url) ? url : `https://${url}`;
		editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
	}, [editor]);

	const uploadImage = useCallback(
		async (file: File) => {
			if (!file || !editor || !editor.chain) return;
			const path = `matched_services/${matchId}/${Date.now()}-${file.name}`;
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
						description: "Uploaded to storage and inserted.",
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
		[editor, matchId, supabase, toast]
	);

	const onPickImage = useCallback(() => fileInputRef.current?.click(), []);

	// Prevent editor losing selection when toolbar is clicked
	const prevent = useCallback((e: MouseEvent | TouchEvent) => e.preventDefault(), []);



	if (!editor) {
		return (
			<div className="animate-pulse bg-serene-neutral-100 rounded-xl h-48" />
		);
	}

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
		<div className="rounded-xl border border-serene-neutral-200 bg-white overflow-hidden transition-all duration-300 focus-within:border-sauti-teal/50 focus-within:ring-2 focus-within:ring-sauti-teal/10">
			{/* Header area with title and save status */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-serene-neutral-100 bg-white">
				<div className="flex items-center gap-2">
					<div className="p-1.5 bg-sauti-teal/10 rounded-lg">
						<PenLine className="h-3.5 w-3.5 text-sauti-teal" />
					</div>
					<span className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-widest">Case Records</span>
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
							<CheckCircle2 className="h-3 w-3" />
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
				<ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
					<Undo2 className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
					<Redo2 className="h-3.5 w-3.5" />
				</ToolbarButton>
				
				<div className="w-px h-4 bg-serene-neutral-200 mx-1" />
				
				<ToolbarButton 
					active={editor.isActive("bold")} 
					onClick={() => editor.chain().focus().toggleBold().run()} 
					title="Bold"
				>
					<Bold className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton 
					active={editor.isActive("italic")} 
					onClick={() => editor.chain().focus().toggleItalic().run()} 
					title="Italic"
				>
					<Italic className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton 
					active={editor.isActive("underline")} 
					onClick={() => editor.chain().focus().toggleUnderline().run()} 
					title="Underline"
				>
					<Underline className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton 
					active={editor.isActive("strike")} 
					onClick={() => editor.chain().focus().toggleStrike().run()} 
					title="Strikethrough"
				>
					<Strikethrough className="h-3.5 w-3.5" />
				</ToolbarButton>

				<div className="w-px h-4 bg-serene-neutral-200 mx-1" />

				<ToolbarButton 
					active={editor.isActive("heading", { level: 1 })} 
					onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
					title="H1"
				>
					<Heading1 className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton 
					active={editor.isActive("heading", { level: 2 })} 
					onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
					title="H2"
				>
					<Heading2 className="h-3.5 w-3.5" />
				</ToolbarButton>

				<div className="w-px h-4 bg-serene-neutral-200 mx-1" />

				<ToolbarButton 
					active={editor.isActive("bulletList")} 
					onClick={() => editor.chain().focus().toggleBulletList().run()} 
					title="Bullet List"
				>
					<List className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton 
					active={editor.isActive("orderedList")} 
					onClick={() => editor.chain().focus().toggleOrderedList().run()} 
					title="Numbers"
				>
					<ListOrdered className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton 
					active={editor.isActive("blockquote")} 
					onClick={() => editor.chain().focus().toggleBlockquote().run()} 
					title="Quote"
				>
					<Quote className="h-3.5 w-3.5" />
				</ToolbarButton>

				<div className="w-px h-4 bg-serene-neutral-200 mx-1" />

				<ToolbarButton 
					active={editor.isActive({ textAlign: "left" })} 
					onClick={() => editor.chain().focus().setTextAlign("left").run()} 
					title="Left"
				>
					<AlignLeft className="h-3.5 w-3.5" />
				</ToolbarButton>
				<ToolbarButton 
					active={editor.isActive({ textAlign: "center" })} 
					onClick={() => editor.chain().focus().setTextAlign("center").run()} 
					title="Center"
				>
					<AlignCenter className="h-3.5 w-3.5" />
				</ToolbarButton>

				<div className="w-px h-4 bg-serene-neutral-200 mx-1" />

				<ToolbarButton 
					active={editor.isActive("link")} 
					onClick={insertOrEditLink} 
					title="Link"
				>
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

			{/* Editor Content Area */}
			<div className="bg-white">
				<EditorContent editor={editor} />
			</div>
		</div>
	);
}
