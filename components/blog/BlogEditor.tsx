'use client';

import { useState, useCallback, useMemo } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Link as LinkIcon, 
  Image as ImageIcon,
  Eye,
  Save,
  Send,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import NextLink from 'next/link';

interface BlogEditorProps {
  authorId: string;
  existingBlog?: {
    id: string;
    title: string;
    content: string;
    excerpt?: string;
    cover_image_url?: string;
    status: 'draft' | 'pending' | 'published' | 'rejected';
  };
  onSaved?: (blog: any) => void;
  onPublished?: (blog: any) => void;
}

export function BlogEditor({
  authorId,
  existingBlog,
  onSaved,
  onPublished
}: BlogEditorProps) {
  const [title, setTitle] = useState(existingBlog?.title || '');
  const [excerpt, setExcerpt] = useState(existingBlog?.excerpt || '');
  const [coverImageUrl, setCoverImageUrl] = useState(existingBlog?.cover_image_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [blogId, setBlogId] = useState<string | null>(existingBlog?.id || null);
  
  const supabase = createClient();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4]
        }
      }),
      Placeholder.configure({
        placeholder: 'Start writing your blog post...',
      }),
      Link.configure({
        openOnClick: false,
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full',
        },
      }),
    ],
    content: existingBlog?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
  });

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleSave = async (status: 'draft' | 'pending' = 'draft') => {
    if (!title.trim() || !editor) return;
    
    const saving = status === 'draft';
    if (saving) setIsSaving(true);
    else setIsPublishing(true);

    try {
      const content = editor.getHTML();
      const slug = generateSlug(title);
      
      const blogData = {
        author_id: authorId,
        title: title.trim(),
        slug,
        content,
        excerpt: excerpt.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        status,
        updated_at: new Date().toISOString()
      };

      let result;
      if (blogId) {
        const { data, error } = await supabase
          .from('blogs')
          .update(blogData)
          .eq('id', blogId)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('blogs')
          .insert({ ...blogData, created_at: new Date().toISOString() })
          .select()
          .single();
        if (error) throw error;
        result = data;
        setBlogId(result.id);
      }

      setLastSaved(new Date());
      
      if (status === 'pending') {
        onPublished?.(result);
      } else {
        onSaved?.(result);
      }
    } catch (error) {
      console.error('Error saving blog:', error);
    } finally {
      setIsSaving(false);
      setIsPublishing(false);
    }
  };

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(async () => {
    if (!editor) return;
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-serene-neutral-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <NextLink href="/dashboard/blogs" className="flex items-center gap-2 text-serene-neutral-500 hover:text-serene-neutral-700">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to blogs</span>
          </NextLink>
          
          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="text-xs text-serene-neutral-400">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-1.5" />
              {showPreview ? 'Edit' : 'Preview'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave('draft')}
              disabled={isSaving || !title.trim()}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save Draft
            </Button>
            
            <Button
              size="sm"
              className="bg-serene-blue-500 hover:bg-serene-blue-600"
              onClick={() => handleSave('pending')}
              disabled={isPublishing || !title.trim() || !editor.getText().trim()}
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Submit for Review
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        {showPreview ? (
          <div className="space-y-6">
            {coverImageUrl && (
              <img 
                src={coverImageUrl} 
                alt="Cover" 
                className="w-full h-64 object-cover rounded-2xl"
              />
            )}
            <h1 className="text-4xl font-bold text-serene-neutral-900">{title || 'Untitled'}</h1>
            {excerpt && (
              <p className="text-lg text-serene-neutral-600">{excerpt}</p>
            )}
            <div 
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cover Image URL */}
            <div className="space-y-2">
              <Label>Cover Image URL (optional)</Label>
              <Input
                placeholder="https://..."
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className="text-sm"
              />
              {coverImageUrl && (
                <img 
                  src={coverImageUrl} 
                  alt="Cover preview" 
                  className="w-full h-32 object-cover rounded-xl mt-2"
                />
              )}
            </div>

            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Blog title..."
              className="w-full text-4xl font-bold text-serene-neutral-900 placeholder-serene-neutral-300 border-none focus:outline-none focus:ring-0"
            />

            {/* Excerpt */}
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Write a short excerpt or summary..."
              className="w-full text-lg text-serene-neutral-600 placeholder-serene-neutral-300 border-none focus:outline-none focus:ring-0 resize-none"
              rows={2}
            />

            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 bg-serene-neutral-50 rounded-xl border border-serene-neutral-200">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded-lg hover:bg-white ${editor.isActive('bold') ? 'bg-white text-serene-blue-600' : ''}`}
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-lg hover:bg-white ${editor.isActive('italic') ? 'bg-white text-serene-blue-600' : ''}`}
              >
                <Italic className="h-4 w-4" />
              </button>
              <div className="w-px h-6 bg-serene-neutral-200 mx-1" />
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded-lg hover:bg-white text-sm font-bold ${editor.isActive('heading', { level: 2 }) ? 'bg-white text-serene-blue-600' : ''}`}
              >
                H2
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-2 rounded-lg hover:bg-white text-sm font-bold ${editor.isActive('heading', { level: 3 }) ? 'bg-white text-serene-blue-600' : ''}`}
              >
                H3
              </button>
              <div className="w-px h-6 bg-serene-neutral-200 mx-1" />
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded-lg hover:bg-white ${editor.isActive('bulletList') ? 'bg-white text-serene-blue-600' : ''}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded-lg hover:bg-white ${editor.isActive('orderedList') ? 'bg-white text-serene-blue-600' : ''}`}
              >
                <ListOrdered className="h-4 w-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-2 rounded-lg hover:bg-white ${editor.isActive('blockquote') ? 'bg-white text-serene-blue-600' : ''}`}
              >
                <Quote className="h-4 w-4" />
              </button>
              <div className="w-px h-6 bg-serene-neutral-200 mx-1" />
              <button
                onClick={addLink}
                className={`p-2 rounded-lg hover:bg-white ${editor.isActive('link') ? 'bg-white text-serene-blue-600' : ''}`}
              >
                <LinkIcon className="h-4 w-4" />
              </button>
              <button
                onClick={addImage}
                className="p-2 rounded-lg hover:bg-white"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Editor */}
            <div className="border border-serene-neutral-200 rounded-xl overflow-hidden bg-white min-h-[400px]">
              <EditorContent editor={editor} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
