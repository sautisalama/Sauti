"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Bold, Italic, Underline, List, ListOrdered, Save, Undo2, Redo2 } from "lucide-react";
import { Tables } from "@/types/db-schema";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ReportNotesEditor({
  userId,
  report,
  onSaved,
}: {
  userId: string;
  report: Tables<"reports">; // using DB type, admin JSON will be used to store notes
  onSaved: (updated: Tables<"reports">) => void;
}) {
  const supabase = createClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const initialHtml = useMemo(() => {
    const admin: any = report.administrative || {};
    return admin.user_notes_html || "";
  }, [report.administrative]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  const cmd = (command: string) => {
    document.execCommand(command, false);
  };

  const save = async () => {
    try {
      setSaving(true);
      const html = editorRef.current?.innerHTML || "";
      const currentAdmin: any = report.administrative || {};
      const updatedAdmin = { ...currentAdmin, user_notes_html: html };

      const { data, error } = await supabase
        .from("reports")
        .update({ administrative: updatedAdmin })
        .eq("report_id", report.report_id)
        .select()
        .single();

      if (error) throw error;
      onSaved(data as any);
      toast({ title: "Notes saved", description: "Your notes for this report have been saved." });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-0 border">
      <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-neutral-50 border-b sticky top-0 z-10">
        <span className="text-sm font-medium text-neutral-700">My Notes</span>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-1 ml-auto flex-wrap sm:flex-nowrap">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => cmd("undo")}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => cmd("redo")}>
            <Redo2 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => cmd("bold")}>
            <Bold className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => cmd("italic")}>
            <Italic className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => cmd("underline")}>
            <Underline className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => cmd("insertUnorderedList")}>
            <List className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => cmd("insertOrderedList")}>
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button type="button" size="sm" onClick={save} disabled={saving} className="h-7">
            <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <div
        ref={editorRef}
        className="min-h-[200px] sm:min-h-[160px] p-3 text-sm focus:outline-none break-words whitespace-pre-wrap"
        contentEditable
        role="textbox"
        aria-multiline
        suppressContentEditableWarning
        style={{ whiteSpace: "pre-wrap" }}
      />
    </Card>
  );
}

