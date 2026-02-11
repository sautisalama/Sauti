'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { format } from 'date-fns';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Eye, Share2, Heart, MessageCircle } from 'lucide-react';
import { BlogCard } from './BlogCard';

interface Blog {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  created_at: string;
  view_count?: number;
  author?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    professional_title?: string | null;
    bio?: string | null;
  };
}

interface BlogPageProps {
  slug: string;
}

export function BlogPage({ slug }: BlogPageProps) {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [relatedBlogs, setRelatedBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLiked, setHasLiked] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    const loadBlog = async () => {
      setIsLoading(true);
      try {
        const { data: blogData, error } = await supabase
          .from('blogs')
          .select(`
            *,
            author:profiles(id, first_name, last_name, avatar_url, professional_title, bio)
          `)
          .eq('slug', slug)
          .eq('status', 'published')
          .single();

        if (!error && blogData) {
          setBlog(blogData);
          
          // Increment view count
          await supabase
            .from('blogs')
            .update({ view_count: (blogData.view_count || 0) + 1 })
            .eq('id', blogData.id);

          // Load related blogs by same author
          const { data: related } = await supabase
            .from('blogs')
            .select(`
              id, title, slug, excerpt, cover_image_url, created_at, status,
              author:profiles(first_name, last_name, avatar_url)
            `)
            .eq('status', 'published')
            .eq('author_id', blogData.author?.id)
            .neq('id', blogData.id)
            .order('created_at', { ascending: false })
            .limit(3);

          if (related) {
            setRelatedBlogs(related as any);
          }
        }
      } catch (error) {
        console.error('Error loading blog:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      loadBlog();
    }
  }, [slug]);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: blog?.title,
        text: blog?.excerpt || '',
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      // Could add toast notification here
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-serene-blue-500"></div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-2xl font-bold text-serene-neutral-900 mb-2">Blog not found</h1>
        <p className="text-serene-neutral-500 mb-6">The blog post you're looking for doesn't exist.</p>
        <Link href="/blogs">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to blogs
          </Button>
        </Link>
      </div>
    );
  }

  const readingTime = Math.ceil((blog.content?.length || 0) / 1000) || 1;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-serene-neutral-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/blogs" className="flex items-center gap-2 text-serene-neutral-500 hover:text-serene-neutral-700">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setHasLiked(!hasLiked)}
              className={hasLiked ? 'text-red-500' : ''}
            >
              <Heart className={`h-5 w-5 ${hasLiked ? 'fill-current' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Cover Image */}
      {blog.cover_image_url && (
        <div className="w-full h-64 md:h-96 relative">
          <img 
            src={blog.cover_image_url} 
            alt={blog.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      )}

      {/* Content */}
      <article className="max-w-3xl mx-auto px-4 py-8">
        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-serene-neutral-500 mb-4">
          <span>{format(new Date(blog.created_at), 'MMMM d, yyyy')}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {readingTime} min read
          </span>
          {blog.view_count !== undefined && (
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {blog.view_count} views
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-serene-neutral-900 mb-4">
          {blog.title}
        </h1>

        {/* Excerpt */}
        {blog.excerpt && (
          <p className="text-lg text-serene-neutral-600 mb-8 leading-relaxed">
            {blog.excerpt}
          </p>
        )}

        {/* Author */}
        {blog.author && (
          <div className="flex items-center gap-4 p-4 bg-serene-neutral-50 rounded-xl mb-8">
            <Avatar className="h-12 w-12">
              <AvatarImage src={blog.author.avatar_url || undefined} />
              <AvatarFallback className="bg-serene-blue-100 text-serene-blue-700">
                {blog.author.first_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-serene-neutral-900">
                {blog.author.first_name} {blog.author.last_name}
              </p>
              {blog.author.professional_title && (
                <p className="text-sm text-serene-neutral-500">
                  {blog.author.professional_title}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div 
          className="prose prose-lg max-w-none prose-headings:text-serene-neutral-900 prose-p:text-serene-neutral-700 prose-a:text-serene-blue-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: blog.content }}
        />
      </article>

      {/* Related Blogs */}
      {relatedBlogs.length > 0 && (
        <div className="bg-serene-neutral-50 py-12 mt-12">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-xl font-bold text-serene-neutral-900 mb-6">
              More from {blog.author?.first_name}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedBlogs.map(related => (
                <BlogCard 
                  key={related.id} 
                  blog={related as any}
                  variant="default"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
