'use client';

import { useState } from 'react';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  FileSpreadsheet, 
  FileImage, 
  FileArchive,
  FileAudio,
  FileVideo,
  File,
  X,
  Eye,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DocumentPreviewProps {
  url: string;
  name: string;
  size?: number;
  type?: string;
  isOwn?: boolean;
}

// Map file extensions to icons and colors
const getFileInfo = (name: string, type?: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  
  const fileTypes: Record<string, { icon: typeof FileText; color: string; bgColor: string; label: string }> = {
    // Documents
    pdf: { icon: FileText, color: 'text-red-600', bgColor: 'bg-red-50', label: 'PDF' },
    doc: { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'DOC' },
    docx: { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'DOCX' },
    txt: { icon: FileText, color: 'text-gray-600', bgColor: 'bg-gray-50', label: 'TXT' },
    
    // Spreadsheets
    xls: { icon: FileSpreadsheet, color: 'text-green-600', bgColor: 'bg-green-50', label: 'XLS' },
    xlsx: { icon: FileSpreadsheet, color: 'text-green-600', bgColor: 'bg-green-50', label: 'XLSX' },
    csv: { icon: FileSpreadsheet, color: 'text-green-600', bgColor: 'bg-green-50', label: 'CSV' },
    
    // Images
    png: { icon: FileImage, color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'PNG' },
    jpg: { icon: FileImage, color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'JPG' },
    jpeg: { icon: FileImage, color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'JPEG' },
    gif: { icon: FileImage, color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'GIF' },
    webp: { icon: FileImage, color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'WEBP' },
    svg: { icon: FileImage, color: 'text-orange-600', bgColor: 'bg-orange-50', label: 'SVG' },
    
    // Archives
    zip: { icon: FileArchive, color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'ZIP' },
    rar: { icon: FileArchive, color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'RAR' },
    '7z': { icon: FileArchive, color: 'text-amber-600', bgColor: 'bg-amber-50', label: '7Z' },
    
    // Audio
    mp3: { icon: FileAudio, color: 'text-pink-600', bgColor: 'bg-pink-50', label: 'MP3' },
    wav: { icon: FileAudio, color: 'text-pink-600', bgColor: 'bg-pink-50', label: 'WAV' },
    ogg: { icon: FileAudio, color: 'text-pink-600', bgColor: 'bg-pink-50', label: 'OGG' },
    
    // Video
    mp4: { icon: FileVideo, color: 'text-indigo-600', bgColor: 'bg-indigo-50', label: 'MP4' },
    webm: { icon: FileVideo, color: 'text-indigo-600', bgColor: 'bg-indigo-50', label: 'WEBM' },
    mov: { icon: FileVideo, color: 'text-indigo-600', bgColor: 'bg-indigo-50', label: 'MOV' },
  };
  
  return fileTypes[ext] || { icon: File, color: 'text-serene-neutral-600', bgColor: 'bg-serene-neutral-50', label: ext.toUpperCase() || 'FILE' };
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export function DocumentPreview({ url, name, size, type, isOwn = false }: DocumentPreviewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const fileInfo = getFileInfo(name, type);
  const IconComponent = fileInfo.icon;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  
  // Check if file can be previewed in browser
  const canPreview = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mp3', 'wav', 'txt'].includes(ext);
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);
  const isPdf = ext === 'pdf';
  
  const handlePreview = () => {
    if (canPreview) {
      setIsPreviewOpen(true);
    } else {
      // Download for non-previewable files
      window.open(url, '_blank');
    }
  };
  
  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div 
        className={`
          flex items-center gap-3 p-3 rounded-xl border cursor-pointer 
          transition-all duration-200 hover:shadow-md group max-w-sm
          ${isOwn 
            ? 'bg-white/10 border-white/20 hover:bg-white/15' 
            : 'bg-white border-serene-neutral-100 hover:border-serene-blue-200 hover:bg-serene-blue-50/30'
          }
        `}
        onClick={handlePreview}
      >
        {/* File Icon */}
        <div className={`${fileInfo.bgColor} ${fileInfo.color} p-2.5 rounded-xl shadow-sm transition-transform group-hover:scale-105`}>
          <IconComponent className="h-6 w-6" />
        </div>
        
        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate ${isOwn ? 'text-white' : 'text-serene-neutral-900'}`}>
            {name}
          </p>
          <div className={`flex items-center gap-2 text-xs ${isOwn ? 'text-blue-200' : 'text-serene-neutral-500'}`}>
            <span className={`px-1.5 py-0.5 rounded font-medium ${fileInfo.bgColor} ${fileInfo.color}`}>
              {fileInfo.label}
            </span>
            {size && <span>{formatFileSize(size)}</span>}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canPreview && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full ${isOwn ? 'text-white hover:bg-white/20' : 'text-serene-neutral-600 hover:bg-serene-neutral-100'}`}
              onClick={(e) => { e.stopPropagation(); handlePreview(); }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-full ${isOwn ? 'text-white hover:bg-white/20' : 'text-serene-neutral-600 hover:bg-serene-neutral-100'}`}
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-white rounded-2xl">
          <DialogHeader className="px-6 py-4 border-b border-serene-neutral-100 bg-serene-neutral-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`${fileInfo.bgColor} ${fileInfo.color} p-2 rounded-lg`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-serene-neutral-900">{name}</DialogTitle>
                  {size && <p className="text-xs text-serene-neutral-500">{formatFileSize(size)}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isLoading}
                  className="rounded-lg"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(url, '_blank')}
                  className="rounded-lg"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto bg-serene-neutral-100 max-h-[70vh]">
            {isImage && (
              <div className="flex items-center justify-center p-6 min-h-[300px]">
                <img 
                  src={url} 
                  alt={name} 
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                />
              </div>
            )}
            
            {isVideo && (
              <div className="flex items-center justify-center p-6">
                <video 
                  src={url} 
                  controls 
                  className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
                  autoPlay
                />
              </div>
            )}
            
            {isAudio && (
              <div className="flex flex-col items-center justify-center p-12 min-h-[200px]">
                <div className={`${fileInfo.bgColor} ${fileInfo.color} p-6 rounded-full mb-6`}>
                  <IconComponent className="h-12 w-12" />
                </div>
                <audio src={url} controls className="w-full max-w-md" autoPlay />
              </div>
            )}
            
            {isPdf && (
              <iframe
                src={url}
                className="w-full h-[60vh]"
                title={name}
              />
            )}
            
            {!isImage && !isVideo && !isAudio && !isPdf && (
              <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
                <div className={`${fileInfo.bgColor} ${fileInfo.color} p-6 rounded-full mb-4`}>
                  <IconComponent className="h-12 w-12" />
                </div>
                <p className="text-serene-neutral-600 text-center">
                  Preview not available for this file type.
                  <br />
                  <span className="text-sm text-serene-neutral-400">Click download or open to view the file.</span>
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
