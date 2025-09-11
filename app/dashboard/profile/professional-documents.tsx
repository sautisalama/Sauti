"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";

export function ProfessionalDocumentsForm({ onSave }: { onSave?: () => void }) {
  const [docs, setDocs] = useState<Array<{ title: string; note?: string; file?: File | null }>>([
    { title: "", note: "", file: undefined },
  ]);

  const addDoc = () => setDocs((d) => [...d, { title: "", note: "", file: undefined }]);
  const removeDoc = (idx: number) => setDocs((d) => d.filter((_, i) => i !== idx));

  const updateDoc = (idx: number, patch: Partial<{ title: string; note?: string; file?: File | null }>) => {
    setDocs((d) => d.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {docs.map((doc, idx) => (
          <Card key={idx} className="border rounded-lg">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
              <div className="md:col-span-1">
                <Input
                  placeholder="Document title (e.g., License, Certificate)"
                  value={doc.title}
                  onChange={(e) => updateDoc(idx, { title: e.target.value })}
                />
              </div>
              <div className="md:col-span-1">
                <Input
                  type="file"
                  onChange={(e) => updateDoc(idx, { file: e.target.files?.[0] || null })}
                />
              </div>
              <div className="md:col-span-1 flex items-center justify-between gap-2">
                <Textarea
                  placeholder="Notes (optional)"
                  value={doc.note || ""}
                  onChange={(e) => updateDoc(idx, { note: e.target.value })}
                  className="min-h-[42px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 text-destructive"
                  onClick={() => removeDoc(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={addDoc} className="gap-2">
          <Plus className="h-4 w-4" /> Add Document
        </Button>
        <Button type="button" onClick={onSave}>Save Documents</Button>
      </div>
    </div>
  );
}

