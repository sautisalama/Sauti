"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	Bold,
	Italic,
	Underline,
	List,
	ListOrdered,
	Save,
	Undo2,
	Redo2,
	Type,
	Link,
	Image,
	AlignLeft,
	AlignCenter,
	AlignRight,
	Quote,
	Code,
	Strikethrough,
} from "lucide-react";
import { Tables } from "@/types/db-schema";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ReportNotesEditor({
	userId,
	report,
	onSaved,
}: {
	userId: string;
	report: Tables<"reports">; // using DB type, notes column will be used to store HTML content
	onSaved: (updated: Tables<"reports">) => void;
}) {
	const supabase = createClient();
	const { toast } = useToast();
	const [saving, setSaving] = useState(false);
	const editorRef = useRef<HTMLDivElement | null>(null);

	const initialHtml = useMemo(() => {
		return report.notes || "";
	}, [report.notes]);

	useEffect(() => {
		if (editorRef.current) {
			editorRef.current.innerHTML = initialHtml;
			// Set initial placeholder
			if (!initialHtml || initialHtml === "") {
				editorRef.current.setAttribute(
					"data-placeholder",
					"Start writing your notes here... You can format text, add links, images, and more!"
				);
			}
		}
	}, [initialHtml]);

	const cmd = (command: string, value?: string) => {
		document.execCommand(command, false, value);
		editorRef.current?.focus();
	};

	const insertLink = () => {
		const url = prompt("Enter URL:");
		if (url && editorRef.current) {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const link = document.createElement("a");
				link.href = url;
				link.textContent = selection.toString() || url;
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				range.deleteContents();
				range.insertNode(link);
				selection.removeAllRanges();
			}
		}
	};

	const insertImage = () => {
		const url = prompt("Enter image URL:");
		if (url && editorRef.current) {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const img = document.createElement("img");
				img.src = url;
				img.alt = "Inserted image";
				img.style.maxWidth = "100%";
				img.style.height = "auto";
				range.deleteContents();
				range.insertNode(img);
				selection.removeAllRanges();
			}
		}
	};

	const setFontSize = (size: string) => {
		if (editorRef.current) {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const span = document.createElement("span");
				span.style.fontSize = `${parseInt(size) * 4}px`;
				span.appendChild(range.extractContents());
				range.insertNode(span);
				selection.removeAllRanges();
			}
		}
	};

	const insertCode = () => {
		if (editorRef.current) {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const code = document.createElement("code");
				code.style.backgroundColor = "#f3f4f6";
				code.style.padding = "2px 4px";
				code.style.borderRadius = "4px";
				code.style.fontFamily = "monospace";
				code.appendChild(range.extractContents());
				range.insertNode(code);
				selection.removeAllRanges();
			}
		}
	};

	const insertHorizontalRule = () => {
		if (editorRef.current) {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const hr = document.createElement("hr");
				hr.style.margin = "8px 0";
				range.insertNode(hr);
				selection.removeAllRanges();
			}
		}
	};

	const save = async () => {
		try {
			setSaving(true);
			const html = editorRef.current?.innerHTML || "";

			const { data, error } = await supabase
				.from("reports")
				.update({ notes: html })
				.eq("report_id", report.report_id)
				.select()
				.single();

			if (error) throw error;
			onSaved(data as any);
			toast({
				title: "Notes saved",
				description: "Your notes for this report have been saved.",
			});
		} catch (e: any) {
			toast({
				title: "Failed to save",
				description: e?.message || "Please try again.",
				variant: "destructive",
			});
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex flex-col h-full">
			<style jsx>{`
				[contenteditable]:empty:before {
					content: attr(data-placeholder);
					color: #9ca3af;
					pointer-events: none;
				}
				[contenteditable]:focus:empty:before {
					content: attr(data-placeholder);
					color: #9ca3af;
				}
			`}</style>
			{/* Enhanced Toolbar */}
			<div className="flex flex-col gap-2 p-3 bg-gray-50 border-b border-gray-200">
				{/* First row - Basic formatting */}
				<div className="flex items-center gap-1 flex-wrap">
					<span className="text-sm font-medium text-gray-700 mr-2">Formatting:</span>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("undo")}
						title="Undo"
					>
						<Undo2 className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("redo")}
						title="Redo"
					>
						<Redo2 className="h-4 w-4" />
					</Button>
					<Separator orientation="vertical" className="h-4" />
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("bold")}
						title="Bold"
					>
						<Bold className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("italic")}
						title="Italic"
					>
						<Italic className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("underline")}
						title="Underline"
					>
						<Underline className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("strikeThrough")}
						title="Strikethrough"
					>
						<Strikethrough className="h-4 w-4" />
					</Button>
					<Separator orientation="vertical" className="h-4" />
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("insertUnorderedList")}
						title="Bullet List"
					>
						<List className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("insertOrderedList")}
						title="Numbered List"
					>
						<ListOrdered className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={insertHorizontalRule}
						title="Horizontal Line"
					>
						<Quote className="h-4 w-4" />
					</Button>
				</div>

				{/* Second row - Font size, alignment, and media */}
				<div className="flex items-center gap-1 flex-wrap">
					<span className="text-sm font-medium text-gray-700 mr-2">Font Size:</span>
					<select
						onChange={(e) => setFontSize(e.target.value)}
						className="h-8 px-2 text-xs border border-gray-300 rounded-md bg-white"
						defaultValue="3"
					>
						<option value="1">Small</option>
						<option value="2">Normal</option>
						<option value="3">Medium</option>
						<option value="4">Large</option>
						<option value="5">Extra Large</option>
						<option value="6">Huge</option>
					</select>

					<Separator orientation="vertical" className="h-4" />

					<span className="text-sm font-medium text-gray-700 mr-2">Align:</span>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("justifyLeft")}
						title="Align Left"
					>
						<AlignLeft className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("justifyCenter")}
						title="Align Center"
					>
						<AlignCenter className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => cmd("justifyRight")}
						title="Align Right"
					>
						<AlignRight className="h-4 w-4" />
					</Button>

					<Separator orientation="vertical" className="h-4" />

					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={insertLink}
						title="Insert Link"
					>
						<Link className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={insertImage}
						title="Insert Image"
					>
						<Image className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={insertCode}
						title="Code Block"
					>
						<Code className="h-4 w-4" />
					</Button>
				</div>

				{/* Third row - Save button */}
				<div className="flex justify-end">
					<Button
						type="button"
						size="sm"
						onClick={save}
						disabled={saving}
						className="h-8"
					>
						<Save className="h-4 w-4 mr-1" />
						{saving ? "Saving..." : "Save Notes"}
					</Button>
				</div>
			</div>

			{/* Enhanced Editor */}
			<div
				ref={editorRef}
				className="flex-1 p-4 text-sm focus:outline-none break-words whitespace-pre-wrap overflow-y-auto"
				contentEditable
				role="textbox"
				aria-multiline
				suppressContentEditableWarning
				style={{
					whiteSpace: "pre-wrap",
					minHeight: "300px",
					maxHeight: "500px",
				}}
				onInput={() => {
					// Handle placeholder visibility
					if (editorRef.current) {
						const isEmpty =
							editorRef.current.innerHTML === "" ||
							editorRef.current.innerHTML === "<br>";
						if (isEmpty) {
							editorRef.current.setAttribute(
								"data-placeholder",
								"Start writing your notes here... You can format text, add links, images, and more!"
							);
						} else {
							editorRef.current.removeAttribute("data-placeholder");
						}
					}
				}}
			/>
		</div>
	);
}
