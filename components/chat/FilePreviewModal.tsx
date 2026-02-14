import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, FileText, Image as ImageIcon } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onSend: (file: File, caption: string) => void;
  isSending: boolean;
}

export function FilePreviewModal({ isOpen, onClose, file, onSend, isSending }: FilePreviewModalProps) {
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
        setPreviewUrl(null);
    }
  }, [file]);

  const handleSendTrigger = () => {
    if (file) {
      onSend(file, caption);
      setCaption("");
    }
  };

  if (!file) return null;

  const isImage = file.type.startsWith('image/');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSending && !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white border-serene-neutral-200 text-serene-neutral-900 [&>button]:hidden shadow-2xl">
        <DialogTitle className="sr-only">File Preview</DialogTitle>
        <div className="relative h-[60vh] w-full flex items-center justify-center bg-serene-neutral-50">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-2 right-2 z-10 text-serene-neutral-500 hover:text-serene-neutral-900 hover:bg-serene-neutral-200/50 rounded-full"
            onClick={onClose}
            disabled={isSending}
          >
            <X className="h-6 w-6" />
          </Button>

          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            {isImage && previewUrl ? (
                <div className="relative w-full h-full">
                     <Image 
                        src={previewUrl} 
                        alt="Preview" 
                        fill 
                        className="object-contain" 
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="h-20 w-20 rounded-2xl bg-white shadow-sm border border-serene-neutral-100 flex items-center justify-center">
                        <FileText className="h-10 w-10 text-serene-blue-500" />
                    </div>
                    <div>
                        <p className="font-medium text-lg text-serene-neutral-900">{file.name}</p>
                        <p className="text-sm text-serene-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                </div>
            )}
          </div>
        </div>

        <div className="p-3 bg-white border-t border-serene-neutral-100 flex items-center gap-2">
           <Input 
              className="flex-1 bg-serene-neutral-50 border-serene-neutral-200 text-serene-neutral-900 placeholder:text-serene-neutral-400 rounded-full h-10 px-4 focus-visible:ring-1 focus-visible:ring-serene-blue-200"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e: any) => setCaption(e.target.value)}
              disabled={isSending}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendTrigger();
                }
              }}
           />
           <Button 
              size="icon" 
              className="h-10 w-10 rounded-full bg-serene-blue-600 hover:bg-serene-blue-700 text-white flex-shrink-0 shadow-sm"
              onClick={handleSendTrigger}
              disabled={isSending}
           >
              {isSending ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                  <Send className="h-4 w-4 ml-0.5" />
              )}
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
