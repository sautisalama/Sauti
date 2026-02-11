'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Send, Eye, EyeOff, Loader2, Plus, Trash2, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Recommendation {
  id: string;
  content: string;
  is_shared_with_survivor: boolean;
  shared_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CaseRecommendationsProps {
  matchId: string;
  professionalId: string;
  survivorName?: string;
  onRecommendationShared?: () => void;
}

export function CaseRecommendations({
  matchId,
  professionalId,
  survivorName = 'the survivor',
  onRecommendationShared
}: CaseRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [newContent, setNewContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  
  const supabase = createClient();

  // Load recommendations
  useEffect(() => {
    loadRecommendations();
  }, [matchId]);

  const loadRecommendations = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('case_recommendations')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false });

      if (data) {
        setRecommendations(data);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newContent.trim() || isSaving) return;
    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('case_recommendations')
        .insert({
          match_id: matchId,
          professional_id: professionalId,
          content: newContent.trim(),
          is_shared_with_survivor: false
        })
        .select()
        .single();

      if (!error && data) {
        setRecommendations(prev => [data, ...prev]);
        setNewContent('');
      }
    } catch (error) {
      console.error('Error adding recommendation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingContent.trim()) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('case_recommendations')
        .update({ content: editingContent.trim() })
        .eq('id', id);

      if (!error) {
        setRecommendations(prev => 
          prev.map(r => r.id === id ? { ...r, content: editingContent.trim() } : r)
        );
        setEditingId(null);
        setEditingContent('');
      }
    } catch (error) {
      console.error('Error updating recommendation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('case_recommendations')
        .delete()
        .eq('id', id);

      if (!error) {
        setRecommendations(prev => prev.filter(r => r.id !== id));
      }
    } catch (error) {
      console.error('Error deleting recommendation:', error);
    }
  };

  const handleShare = async (id: string) => {
    try {
      const { error } = await supabase
        .from('case_recommendations')
        .update({ 
          is_shared_with_survivor: true,
          shared_at: new Date().toISOString()
        })
        .eq('id', id);

      if (!error) {
        setRecommendations(prev => 
          prev.map(r => r.id === id ? { 
            ...r, 
            is_shared_with_survivor: true,
            shared_at: new Date().toISOString()
          } : r)
        );
        onRecommendationShared?.();
      }
    } catch (error) {
      console.error('Error sharing recommendation:', error);
    }
  };

  const handleUnshare = async (id: string) => {
    try {
      const { error } = await supabase
        .from('case_recommendations')
        .update({ 
          is_shared_with_survivor: false,
          shared_at: null
        })
        .eq('id', id);

      if (!error) {
        setRecommendations(prev => 
          prev.map(r => r.id === id ? { 
            ...r, 
            is_shared_with_survivor: false,
            shared_at: null
          } : r)
        );
      }
    } catch (error) {
      console.error('Error unsharing recommendation:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add New Recommendation */}
      <div className="bg-serene-neutral-50 rounded-xl p-4">
        <label className="block text-sm font-medium text-serene-neutral-700 mb-2">
          Add Recommendation
        </label>
        <Textarea
          placeholder="Enter your recommendation for this case..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={3}
          className="mb-3 resize-none"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-serene-neutral-400">
            This recommendation will be private until you share it
          </span>
          <Button
            onClick={handleAdd}
            disabled={!newContent.trim() || isSaving}
            size="sm"
            className="bg-serene-blue-500 hover:bg-serene-blue-600"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add
          </Button>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 text-serene-neutral-400 text-sm">
            No recommendations yet. Add your first recommendation above.
          </div>
        ) : (
          recommendations.map(rec => (
            <div 
              key={rec.id}
              className={`
                p-4 rounded-xl border transition-all
                ${rec.is_shared_with_survivor 
                  ? 'bg-emerald-50 border-emerald-200' 
                  : 'bg-white border-serene-neutral-200'
                }
              `}
            >
              {editingId === rec.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    rows={3}
                    className="resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(rec.id)}
                      disabled={isSaving}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setEditingContent('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-serene-neutral-800 whitespace-pre-wrap">
                    {rec.content}
                  </p>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-serene-neutral-100">
                    <div className="flex items-center gap-2 text-xs text-serene-neutral-400">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(rec.created_at), 'MMM d, yyyy HH:mm')}
                      {rec.is_shared_with_survivor && rec.shared_at && (
                        <span className="text-emerald-600 font-medium">
                          • Shared {format(new Date(rec.shared_at), 'MMM d')}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingId(rec.id);
                          setEditingContent(rec.content);
                        }}
                        title="Edit"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                      
                      {rec.is_shared_with_survivor ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => handleUnshare(rec.id)}
                          title="Hide from survivor"
                        >
                          <EyeOff className="h-3.5 w-3.5 mr-1" />
                          Hide
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => handleShare(rec.id)}
                          title={`Share with ${survivorName}`}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Share
                        </Button>
                      )}
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(rec.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
