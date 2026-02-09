'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, Eye, MessageCircle, Heart } from 'lucide-react';

interface BlogCardProps {
  blog: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    cover_image_url?: string | null;
    created_at: string;
    status: 'draft' | 'pending' | 'published' | 'rejected';
    view_count?: number;
    author?: {
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      professional_title?: string | null;
    };
  };
  variant?: 'default' | 'compact' | 'featured';
  showStatus?: boolean;
  onEdit?: () => void;
}

export function BlogCard({ 
  blog, 
  variant = 'default',
  showStatus = false,
  onEdit 
}: BlogCardProps) {
  const readingTime = Math.ceil((blog.excerpt?.length || 0) / 200) || 1;
  
  const statusColors = {
    draft: 'bg-gray-100 text-gray-600',
    pending: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700'
  };

  if (variant === 'compact') {
    return (
      <Link 
        href={blog.status === 'published' ? `/blogs/${blog.slug}` : '#'}
        onClick={(e) => {
          if (blog.status !== 'published' && onEdit) {
            e.preventDefault();
            onEdit();
          }
        }}
        className="group flex gap-4 p-3 rounded-xl hover:bg-serene-neutral-50 transition-colors"
      >
        {blog.cover_image_url && (
          <img 
            src={blog.cover_image_url} 
            alt={blog.title}
            className="w-20 h-20 object-cover rounded-lg shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-serene-neutral-900 group-hover:text-serene-blue-600 transition-colors line-clamp-2">
            {blog.title}
          </h3>
          <p className="text-xs text-serene-neutral-500 mt-1">
            {format(new Date(blog.created_at), 'MMM d, yyyy')} · {readingTime} min read
          </p>
          {showStatus && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-2 ${statusColors[blog.status]}`}>
              {blog.status}
            </span>
          )}
        </div>
      </Link>
    );
  }

  if (variant === 'featured') {
    return (
      <Link 
        href={`/blogs/${blog.slug}`}
        className="group relative block rounded-2xl overflow-hidden"
      >
        <div className="aspect-[16/9] relative">
          {blog.cover_image_url ? (
            <img 
              src={blog.cover_image_url} 
              alt={blog.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-serene-blue-400 to-serene-blue-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          {blog.author && (
            <div className="flex items-center gap-2 mb-3">
              <Avatar className="h-8 w-8 ring-2 ring-white/30">
                <AvatarImage src={blog.author.avatar_url || undefined} />
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {blog.author.first_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">
                {blog.author.first_name} {blog.author.last_name}
              </span>
            </div>
          )}
          <h2 className="text-2xl font-bold group-hover:text-serene-blue-200 transition-colors line-clamp-2">
            {blog.title}
          </h2>
          {blog.excerpt && (
            <p className="text-white/80 mt-2 line-clamp-2 text-sm">
              {blog.excerpt}
            </p>
          )}
          <div className="flex items-center gap-4 mt-4 text-xs text-white/60">
            <span>{format(new Date(blog.created_at), 'MMM d, yyyy')}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {readingTime} min
            </span>
            {blog.view_count !== undefined && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {blog.view_count}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Default variant
  return (
    <Link 
      href={blog.status === 'published' ? `/blogs/${blog.slug}` : '#'}
      onClick={(e) => {
        if (blog.status !== 'published' && onEdit) {
          e.preventDefault();
          onEdit();
        }
      }}
      className="group block bg-white rounded-2xl border border-serene-neutral-100 overflow-hidden hover:shadow-lg hover:border-serene-blue-200 transition-all"
    >
      {blog.cover_image_url && (
        <div className="aspect-[16/9] overflow-hidden">
          <img 
            src={blog.cover_image_url} 
            alt={blog.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-5">
        {showStatus && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mb-3 ${statusColors[blog.status]}`}>
            {blog.status}
          </span>
        )}
        <h3 className="text-lg font-bold text-serene-neutral-900 group-hover:text-serene-blue-600 transition-colors line-clamp-2">
          {blog.title}
        </h3>
        {blog.excerpt && (
          <p className="text-serene-neutral-600 text-sm mt-2 line-clamp-3">
            {blog.excerpt}
          </p>
        )}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-serene-neutral-100">
          {blog.author && (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={blog.author.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-serene-blue-100 text-serene-blue-700">
                  {blog.author.first_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-serene-neutral-700">
                {blog.author.first_name} {blog.author.last_name}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-serene-neutral-400">
            <span>{format(new Date(blog.created_at), 'MMM d')}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {readingTime}m
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
