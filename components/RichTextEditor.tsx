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
	Save,
	Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface RichTextEditorProps {
	content?: string;
	onSave?: (content: string) => Promise<void>;
	placeholder?: string;
	className?: string;
	readOnly?: boolean;
}

/**
 * Calming WYSIWYG editor for private notes
 * Uses Tiptap with minimal toolbar and Sauti Salama theme
 */
export function RichTextEditor({ 
	content = "", 
	onSave, 
	placeholder = "Write your private notes here...",
	className,
	readOnly = false
}: RichTextEditorProps) {
	const [isSaving, setIsSaving] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);

	const editor = useEditor({
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
		onUpdate: () => {
			setHasChanges(true);
		},
		editorProps: {
			attributes: {
				class: cn(
					"prose prose-sm max-w-none min-h-[150px] p-4 focus:outline-none",
					"text-sauti-dark font-medium leading-relaxed",
					"[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
					"[&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0"
				),
			},
		},
	});

	// Sync external content changes
	useEffect(() => {
		if (editor && content !== editor.getHTML() && !hasChanges) {
			editor.commands.setContent(content);
		}
	}, [content, editor, hasChanges]);

	const handleSave = async () => {
		if (!editor || !onSave) return;
		
		setIsSaving(true);
		try {
			await onSave(editor.getHTML());
			setHasChanges(false);
		} finally {
			setIsSaving(false);
		}
	};

	if (!editor) {
		return (
			<div className={cn("animate-pulse bg-serene-neutral-100 rounded-2xl h-48", className)} />
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
				"h-8 w-8 p-0 rounded-lg transition-colors",
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
			"rounded-2xl border border-serene-neutral-200 bg-white overflow-hidden",
			"transition-all duration-300 focus-within:border-sauti-teal/50 focus-within:ring-2 focus-within:ring-sauti-teal/10",
			className
		)}>
			{/* Toolbar */}
			{!readOnly && (
				<div className="flex items-center gap-1 px-3 py-2 border-b border-serene-neutral-100 bg-serene-neutral-50">
					<ToolbarButton
						active={editor.isActive("bold")}
						onClick={() => editor.chain().focus().toggleBold().run()}
					>
						<Bold className="h-4 w-4" />
					</ToolbarButton>
					
					<ToolbarButton
						active={editor.isActive("italic")}
						onClick={() => editor.chain().focus().toggleItalic().run()}
					>
						<Italic className="h-4 w-4" />
					</ToolbarButton>
					
					<ToolbarButton
						active={editor.isActive("underline")}
						onClick={() => editor.chain().focus().toggleUnderline().run()}
					>
						<UnderlineIcon className="h-4 w-4" />
					</ToolbarButton>

					<div className="w-px h-5 bg-serene-neutral-200 mx-1" />

					<ToolbarButton
						active={editor.isActive("bulletList")}
						onClick={() => editor.chain().focus().toggleBulletList().run()}
					>
						<List className="h-4 w-4" />
					</ToolbarButton>
					
					<ToolbarButton
						active={editor.isActive("orderedList")}
						onClick={() => editor.chain().focus().toggleOrderedList().run()}
					>
						<ListOrdered className="h-4 w-4" />
					</ToolbarButton>

					{onSave && (
						<>
							<div className="flex-1" />
							<Button
								size="sm"
								onClick={handleSave}
								disabled={isSaving || !hasChanges}
								className={cn(
									"h-8 px-3 rounded-lg font-semibold text-xs transition-all",
									hasChanges 
										? "bg-sauti-teal hover:bg-sauti-teal/90 text-white" 
										: "bg-serene-neutral-100 text-serene-neutral-400"
								)}
							>
								{isSaving ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
								) : (
									<Save className="h-3.5 w-3.5 mr-1" />
								)}
								{isSaving ? "Saving..." : "Save"}
							</Button>
						</>
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
