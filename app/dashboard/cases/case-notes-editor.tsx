"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import TextStyle from "@tiptap/extension-text-style";

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
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
      Placeholder.configure({ placeholder: "Add case notes..." }),
    ],
    content: initialContent,
    editable: true,
    onUpdate: ({ editor }) => {
      setDirty(true);
    },
    editorProps: {
      handlePaste: (view: any, e: ClipboardEvent) => {
        const items = (e.clipboardData?.items || []) as unknown as DataTransferItem[];
        const imageItems = Array.from(items).filter((it) => it.kind === "file" && it.type.startsWith("image/"));
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
        class: "tiptap prose-sm max-w-none focus:outline-none break-words whitespace-pre-wrap min-h-[200px] p-3",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (initialContent !== editor.getHTML()) editor.commands.setContent(initialContent, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);


  const save = useCallback(
    async (html?: string, opts?: { autosave?: boolean }) => {
      if (!editor) return;
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
        if (!autosave) toast({ title: "Notes saved", description: "Your case notes have been saved." });
      } catch (e: any) {
        if (!autosave) toast({ title: "Failed to save", description: e?.message || "Please try again.", variant: "destructive" });
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
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = prompt("Enter URL:", prev ?? "https://");
    if (url === null) return;
    if (url === "") return void editor.chain().focus().unsetLink().run();
    const href = /^(https?:)?\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }, [editor]);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!file) return;
      const path = `matched_services/${matchId}/${Date.now()}-${file.name}`;
      try {
        const { error } = await supabase.storage
          .from("report-media")
          .upload(path, file, { contentType: file.type, upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("report-media").getPublicUrl(path);
        const src = urlData?.publicUrl;
        if (src) {
          editor?.chain().focus().setImage({ src, alt: file.name }).run();
          toast({ title: "Image inserted", description: "Uploaded to storage and inserted." });
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
          toast({ title: "Inserted inline image", description: "Upload failed; inserted as inline image instead." });
        } catch (e) {
          toast({ title: "Failed to insert image", description: String(e), variant: "destructive" });
        }
      }
    },
    [editor, matchId, supabase, toast]
  );

  const onPickImage = useCallback(() => fileInputRef.current?.click(), []);

  // Prevent editor losing selection when toolbar is clicked
  const prevent = useCallback((e: any) => e.preventDefault(), []);

  if (!editor) return (
    <Card className="p-0 border"><div className="p-3 text-sm text-neutral-500">Loading editor…</div></Card>
  );

  return (
    <Card className="p-0 border">
      <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-neutral-50 border-b sticky top-0 z-10">
        <span className="text-sm font-medium text-neutral-700">Case Notes</span>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-1 ml-auto flex-wrap sm:flex-nowrap" onMouseDown={prevent}>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button type="button" variant={editor.isActive("bold") ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
            <Bold className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive("italic") ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
            <Italic className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive("underline") ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
            <Underline className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive("strike") ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button type="button" variant={editor.isActive("heading", { level: 1 }) ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive("heading", { level: 3 }) ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
            <Heading3 className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive("heading", { level: 4 }) ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="Heading 4">
            <Heading4 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button type="button" variant={editor.isActive("bulletList") ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
            <List className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive("orderedList") ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive("blockquote") ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
            <Quote className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive("codeBlock") ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block">
            <Code className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button type="button" variant={editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align Left">
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align Center">
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align Right">
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant={editor.isActive({ textAlign: "justify" }) ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justify">
            <AlignJustify className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button type="button" variant={editor.isActive("link") ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={insertOrEditLink} title="Insert/Edit Link">
            <LinkIcon className="h-4 w-4" />
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadImage(file);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }} />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onPickImage} title="Insert Image">
            <ImageIcon className="h-4 w-4" />
          </Button>
          <div className="ml-2 flex items-center gap-3 text-xs text-neutral-500">
            {saving ? <span>Saving…</span> : dirty ? <span>Unsaved changes</span> : lastSavedAt ? <span>Saved {lastSavedAt}</span> : null}
            <Button type="button" size="sm" onClick={() => save()} disabled={saving} className="h-7">
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <style jsx>{`
        .tiptap :global(.ProseMirror) { outline: none; }
        .tiptap :global(img) { max-width: 100%; height: auto; }
        .tiptap :global(blockquote) { border-left: 3px solid #e5e7eb; margin: 0.75rem 0; padding-left: 0.75rem; color: #374151; }
        .tiptap :global(pre) { background: #f3f4f6; border-radius: 6px; padding: 0.5rem 0.75rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.85rem; }
        .tiptap :global(h1) { font-size: 1.25rem; line-height: 1.75rem; font-weight: 700; margin: 0.5rem 0; }
        .tiptap :global(h2) { font-size: 1.125rem; line-height: 1.75rem; font-weight: 700; margin: 0.5rem 0; }
        .tiptap :global(h3) { font-size: 1rem; line-height: 1.5rem; font-weight: 600; margin: 0.5rem 0; }
        .tiptap :global(h4) { font-size: 0.95rem; line-height: 1.4rem; font-weight: 600; margin: 0.5rem 0; }
        .tiptap :global(ul) { list-style: disc; padding-left: 1.25rem; margin: 0.5rem 0; }
        .tiptap :global(ol) { list-style: decimal; padding-left: 1.25rem; margin: 0.5rem 0; }
        .tiptap :global(li) { margin: 0.25rem 0; }
        .tiptap :global(ul ul) { list-style: circle; }
        .tiptap :global(ol ol) { list-style: lower-alpha; }
      `}</style>
      <EditorContent editor={editor} className="min-h-[200px] sm:min-h-[160px]" />
    </Card>
  );
}

