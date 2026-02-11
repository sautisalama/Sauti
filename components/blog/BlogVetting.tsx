'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check, X, Eye, AlertCircle, Clock, ChevronDown, ChevronUp, Loader2, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface Blog {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  created_at: string;
  status: 'pending' | 'published' | 'rejected';
  author: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    professional_title?: string | null;
  };
}

interface BlogVettingProps {
  reviewerId: string;
}

export function BlogVetting({ reviewerId }: BlogVettingProps) {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    loadBlogs();
  }, [filterStatus]);

  const loadBlogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('blogs')
        .select(`
          *,
          author:profiles(id, first_name, last_name, avatar_url, professional_title)
        `)
        .order('created_at', { ascending: false });

      if (filterStatus === 'pending') {
        query = query.eq('status', 'pending');
      }

      const { data, error } = await query;
      if (!error && data) {
        setBlogs(data as any);
      }
    } catch (error) {
      console.error('Error loading blogs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (blogId: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('blogs')
        .update({ 
          status: 'published',
          published_at: new Date().toISOString(),
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', blogId);

      if (!error) {
        setBlogs(prev => prev.map(b => 
          b.id === blogId ? { ...b, status: 'published' as const } : b
        ));
        setSelectedBlog(null);
      }
    } catch (error) {
      console.error('Error approving blog:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedBlog) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('blogs')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectReason.trim() || null,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedBlog.id);

      if (!error) {
        setBlogs(prev => prev.map(b => 
          b.id === selectedBlog.id ? { ...b, status: 'rejected' as const } : b
        ));
        setSelectedBlog(null);
        setShowRejectDialog(false);
        setRejectReason('');
      }
    } catch (error) {
      console.error('Error rejecting blog:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    published: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200'
  };

  const pendingCount = blogs.filter(b => b.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-serene-neutral-900">Blog Review Queue</h2>
          <p className="text-sm text-serene-neutral-500">
            Review and approve blog posts before they go live
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
              <Clock className="h-4 w-4" />
              {pendingCount} pending
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            {filterStatus === 'pending' ? 'Pending Only' : 'All Posts'}
          </Button>
        </div>
      </div>

      {/* Blog List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" />
        </div>
      ) : blogs.length === 0 ? (
        <div className="text-center py-12 bg-serene-neutral-50 rounded-2xl">
          <Check className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-serene-neutral-600 font-medium">No pending posts to review</p>
          <p className="text-serene-neutral-400 text-sm">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {blogs.map(blog => (
            <div 
              key={blog.id}
              className="bg-white rounded-xl border border-serene-neutral-200 overflow-hidden"
            >
              {/* Summary Row */}
              <div className="p-4 flex items-start gap-4">
                {blog.cover_image_url && (
                  <img 
                    src={blog.cover_image_url} 
                    alt={blog.title}
                    className="w-20 h-20 object-cover rounded-lg shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-serene-neutral-900 line-clamp-1">
                        {blog.title}
                      </h3>
                      {blog.excerpt && (
                        <p className="text-sm text-serene-neutral-500 line-clamp-2 mt-1">
                          {blog.excerpt}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[blog.status]}`}>
                      {blog.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={blog.author?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {blog.author?.first_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-serene-neutral-600">
                        {blog.author?.first_name} {blog.author?.last_name}
                      </span>
                    </div>
                    <span className="text-xs text-serene-neutral-400">
                      {format(new Date(blog.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {blog.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setSelectedBlog(blog);
                          setShowRejectDialog(true);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600"
                        onClick={() => handleApprove(blog.id)}
                        disabled={isSubmitting}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setExpandedId(expandedId === blog.id ? null : blog.id)}
                  >
                    {expandedId === blog.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Expanded Content Preview */}
              {expandedId === blog.id && (
                <div className="border-t border-serene-neutral-100 p-4 bg-serene-neutral-50">
                  <div 
                    className="prose prose-sm max-w-none max-h-96 overflow-y-auto bg-white rounded-lg p-4 border border-serene-neutral-200"
                    dangerouslySetInnerHTML={{ __html: blog.content }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Reject Blog Post
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this post. This will be shared with the author.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-serene-neutral-50 rounded-lg">
              <p className="font-medium text-serene-neutral-900">{selectedBlog?.title}</p>
              <p className="text-sm text-serene-neutral-500">
                by {selectedBlog?.author?.first_name} {selectedBlog?.author?.last_name}
              </p>
            </div>
            <Textarea
              placeholder="Reason for rejection (optional but recommended)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isSubmitting}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Reject Post
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
