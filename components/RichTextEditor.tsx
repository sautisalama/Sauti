"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Button } from "@/components/ui/button";
import { 
	Bold, 
	Italic, 
	Underline as UnderlineIcon, 
	List, 
	ListOrdered,
	Check,
	Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback, useOptimistic } from "react";

interface RichTextEditorProps {
	content?: string;
	onSave?: (content: string) => Promise<void>;
	placeholder?: string;
	className?: string;
	readOnly?: boolean;
	/** Debounce delay in ms before autosave triggers (default: 1500) */
	autosaveDelay?: number;
}

/**
 * Calming WYSIWYG editor with debounced autosave
 * Uses Tiptap with minimal toolbar and Sauti Salama theme
 */
export function RichTextEditor({ 
	content = "", 
	onSave, 
	placeholder = "Write your private notes here...",
	className,
	readOnly = false,
	autosaveDelay = 1500
}: RichTextEditorProps) {
	const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved'>('idle');
	const [optimisticStatus, setOptimisticStatus] = useOptimistic(
		saveStatus,
		(state: string, newStatus: 'idle' | 'saving' | 'saved' | 'unsaved') => newStatus
	);

	const debounceRef = useRef<NodeJS.Timeout | null>(null);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;
		return () => { isMountedRef.current = false; };
	}, []);

	const doSave = useCallback(async (html: string) => {
		if (!onSave) return;
		setSaveStatus('saving');
		try {
			await onSave(html);
			if (isMountedRef.current) setSaveStatus('saved');
		} catch {
			if (isMountedRef.current) setSaveStatus('unsaved');
		}
	}, [onSave]);

	const scheduleSave = useCallback((html: string) => {
		setOptimisticStatus('saving');
		setSaveStatus('unsaved');
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			doSave(html);
		}, autosaveDelay);
	}, [doSave, autosaveDelay, setOptimisticStatus]);

	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				heading: false,
				codeBlock: false,
				blockquote: false,
				horizontalRule: false,
			}),
			Underline,
			Placeholder.configure({
				placeholder,
				emptyEditorClass: "is-editor-empty",
			}),
		],
		content,
		editable: !readOnly,
		onUpdate: ({ editor }) => {
			if (onSave) scheduleSave(editor.getHTML());
		},
		onBlur: ({ editor }) => {
			// Immediately save on blur if there are pending changes
			if (onSave && saveStatus === 'unsaved') {
				if (debounceRef.current) clearTimeout(debounceRef.current);
				doSave(editor.getHTML());
			}
		},
		editorProps: {
			attributes: {
				class: cn(
					"prose prose-sm max-w-none min-h-[120px] p-4 focus:outline-none",
					"text-sauti-dark font-medium leading-relaxed",
					"[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
					"[&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0"
				),
			},
		},
	});

	// Sync external content changes
	useEffect(() => {
		if (editor && content !== editor.getHTML() && saveStatus !== 'unsaved') {
			editor.commands.setContent(content);
		}
	}, [content, editor]);

	// Ctrl/Cmd+S keyboard shortcut
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
				e.preventDefault();
				if (editor && onSave) {
					if (debounceRef.current) clearTimeout(debounceRef.current);
					doSave(editor.getHTML());
				}
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [editor, onSave, doSave]);

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	if (!editor) {
		return (
			<div className={cn("animate-pulse bg-serene-neutral-100 rounded-xl h-48", className)} />
		);
	}

	const ToolbarButton = ({ 
		active, 
		onClick, 
		children,
		disabled = false 
	}: { 
		active?: boolean; 
		onClick: () => void; 
		children: React.ReactNode;
		disabled?: boolean;
	}) => (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"h-7 w-7 p-0 rounded-lg transition-colors",
				active 
					? "bg-sauti-teal/10 text-sauti-teal" 
					: "text-serene-neutral-500 hover:text-sauti-teal hover:bg-sauti-teal/5"
			)}
		>
			{children}
		</Button>
	);

	return (
		<div className={cn(
			"rounded-xl border border-serene-neutral-200 bg-white overflow-hidden",
			"transition-all duration-300 focus-within:border-sauti-teal/50 focus-within:ring-2 focus-within:ring-sauti-teal/10",
			className
		)}>
			{/* Toolbar */}
			{!readOnly && (
				<div className="flex items-center gap-1 px-3 py-1.5 border-b border-serene-neutral-100 bg-serene-neutral-50/80">
					<ToolbarButton
						active={editor.isActive("bold")}
						onClick={() => editor.chain().focus().toggleBold().run()}
					>
						<Bold className="h-3.5 w-3.5" />
					</ToolbarButton>
					
					<ToolbarButton
						active={editor.isActive("italic")}
						onClick={() => editor.chain().focus().toggleItalic().run()}
					>
						<Italic className="h-3.5 w-3.5" />
					</ToolbarButton>
					
					<ToolbarButton
						active={editor.isActive("underline")}
						onClick={() => editor.chain().focus().toggleUnderline().run()}
					>
						<UnderlineIcon className="h-3.5 w-3.5" />
					</ToolbarButton>

					<div className="w-px h-4 bg-serene-neutral-200 mx-0.5" />

					<ToolbarButton
						active={editor.isActive("bulletList")}
						onClick={() => editor.chain().focus().toggleBulletList().run()}
					>
						<List className="h-3.5 w-3.5" />
					</ToolbarButton>
					
					<ToolbarButton
						active={editor.isActive("orderedList")}
						onClick={() => editor.chain().focus().toggleOrderedList().run()}
					>
						<ListOrdered className="h-3.5 w-3.5" />
					</ToolbarButton>

					{/* Autosave status indicator */}
					{onSave && (
						<div className="ml-auto flex items-center gap-1.5 h-6">
							<div className="flex items-center gap-1.5 min-w-[70px] justify-end">
								{optimisticStatus === 'saving' && (
									<span className="flex items-center gap-1.5 text-sauti-teal animate-in fade-in duration-300">
										<Loader2 className="h-3 w-3 animate-spin" /> 
										<span className="text-[10px] font-bold uppercase tracking-wider">Saving</span>
									</span>
								)}
								{optimisticStatus === 'saved' && (
									<span className="flex items-center gap-1.5 text-serene-green-600 animate-in fade-in zoom-in-95 duration-500">
										<Check className="h-3 w-3 transition-transform duration-500 hover:scale-125" /> 
										<span className="text-[10px] font-bold uppercase tracking-wider">Saved</span>
									</span>
								)}
								{optimisticStatus === 'unsaved' && (
									<span className="text-amber-500 text-[10px] font-bold uppercase tracking-wider animate-in fade-in duration-300">
										Changes Pending
									</span>
								)}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Editor Content */}
			<EditorContent 
				editor={editor} 
				className={cn(
					"[&_.is-editor-empty:first-child::before]:text-serene-neutral-400",
					"[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
					"[&_.is-editor-empty:first-child::before]:float-left",
					"[&_.is-editor-empty:first-child::before]:h-0",
					"[&_.is-editor-empty:first-child::before]:pointer-events-none"
				)}
			/>
		</div>
	);
}
