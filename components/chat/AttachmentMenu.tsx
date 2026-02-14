import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Paperclip, Image as ImageIcon, FileText, Camera } from "lucide-react";
import { useRef } from "react";

interface AttachmentMenuProps {
  onFileSelect: (file: File, type: 'image' | 'video' | 'document') => void;
}

export function AttachmentMenu({ onFileSelect }: AttachmentMenuProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file, type);
    }
    // Reset value to allow selecting same file again
    e.target.value = '';
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-serene-neutral-400 hover:text-serene-blue-500 hover:bg-serene-blue-50 rounded-full transition-colors">
            <Paperclip className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 mb-2 p-2 rounded-xl shadow-xl border-serene-neutral-200">
          <DropdownMenuItem 
            className="flex items-center gap-3 p-3 cursor-pointer rounded-lg hover:bg-serene-neutral-50 focus:bg-serene-neutral-50"
            onClick={() => imageInputRef.current?.click()}
          >
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <ImageIcon className="h-5 w-5" />
            </div>
            <span className="font-medium text-serene-neutral-700">Photos & Videos</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            className="flex items-center gap-3 p-3 cursor-pointer rounded-lg hover:bg-serene-neutral-50 focus:bg-serene-neutral-50"
            onClick={() => cameraInputRef.current?.click()}
          >
            <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
              <Camera className="h-5 w-5" />
            </div>
            <span className="font-medium text-serene-neutral-700">Camera</span>
          </DropdownMenuItem>

          <DropdownMenuItem 
            className="flex items-center gap-3 p-3 cursor-pointer rounded-lg hover:bg-serene-neutral-50 focus:bg-serene-neutral-50"
            onClick={() => docInputRef.current?.click()}
          >
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <span className="font-medium text-serene-neutral-700">Document</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden Inputs */}
      <input 
        type="file" 
        ref={imageInputRef} 
        className="hidden" 
        accept="image/*,video/*" 
        onChange={(e) => handleFileChange(e, 'image')} // Type check? if video selected? naive check for now
      />
      <input 
        type="file" 
        ref={docInputRef} 
        className="hidden" 
        accept=".pdf,.doc,.docx,.txt" 
        onChange={(e) => handleFileChange(e, 'document')} 
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        className="hidden" 
        accept="image/*,video/*" 
        capture="environment"
        onChange={(e) => handleFileChange(e, 'image')}  // We treat 'image' type as generic media for now or logic adjusts later 
      />
    </>
  );
}
