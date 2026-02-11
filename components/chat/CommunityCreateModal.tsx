'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Upload, Users, Globe, Lock, Loader2, Camera } from 'lucide-react';

interface CommunityCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommunityCreated?: (community: any) => void;
  currentUserId: string;
}

export function CommunityCreateModal({
  isOpen,
  onClose,
  onCommunityCreated,
  currentUserId
}: CommunityCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Community name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      let avatarUrl = null;

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `community-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('community-avatars')
          .upload(fileName, avatarFile);

        if (!uploadError) {
          const { data: urlData } = supabase
            .storage
            .from('community-avatars')
            .getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
        }
      }

      const { data: community, error: createError } = await supabase
        .from('communities')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          creator_id: currentUserId,
          avatar_url: avatarUrl,
          is_public: isPublic,
          member_count: 1
        })
        .select()
        .single();

      if (createError) throw createError;

      await supabase
        .from('community_members')
        .insert({
          community_id: community.id,
          user_id: currentUserId,
          role: 'admin'
        });

      setName('');
      setDescription('');
      setIsPublic(true);
      setAvatarFile(null);
      setAvatarPreview(null);

      onCommunityCreated?.(community);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create community');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName('');
      setDescription('');
      setIsPublic(true);
      setAvatarFile(null);
      setAvatarPreview(null);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden bg-serene-neutral-50">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-serene-green-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-serene-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-serene-neutral-900">Create Community</DialogTitle>
              <DialogDescription className="text-sm text-serene-neutral-500">
                Build a space for connection and support
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-5">
          {/* Avatar Upload */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              <Avatar className="h-20 w-20 border-2 border-dashed border-serene-neutral-300 group-hover:border-serene-blue-400 transition-colors">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} />
                ) : (
                  <AvatarFallback className="bg-serene-neutral-100 text-serene-neutral-400 group-hover:bg-serene-blue-50 group-hover:text-serene-blue-500 transition-colors">
                    <Camera className="h-7 w-7" />
                  </AvatarFallback>
                )}
              </Avatar>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <div className="absolute bottom-0 right-0 bg-serene-blue-500 text-white rounded-full p-1.5 shadow-lg group-hover:bg-serene-blue-600 transition-colors">
                <Plus className="h-3 w-3" />
              </div>
            </label>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-serene-neutral-700 font-medium">Community Name *</Label>
            <Input
              id="name"
              placeholder="Give your community a name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="h-12 bg-white border-serene-neutral-200 rounded-xl focus-visible:ring-serene-blue-200"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-serene-neutral-700 font-medium">Description</Label>
            <Textarea
              id="description"
              placeholder="What's this community about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              className="resize-none bg-white border-serene-neutral-200 rounded-xl focus-visible:ring-serene-blue-200"
            />
            <p className="text-xs text-serene-neutral-400 text-right">
              {description.length}/200
            </p>
          </div>

          {/* Privacy Toggle */}
          <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-serene-neutral-100">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isPublic ? 'bg-serene-green-50 text-serene-green-600' : 'bg-serene-neutral-100 text-serene-neutral-500'
              }`}>
                {isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-serene-neutral-900">
                  {isPublic ? 'Public Community' : 'Private Community'}
                </p>
                <p className="text-xs text-serene-neutral-500">
                  {isPublic ? 'Anyone can find and join' : 'Invite-only membership'}
                </p>
              </div>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              className="data-[state=checked]:bg-serene-green-500"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-xl border-serene-neutral-200 text-serene-neutral-700 hover:bg-serene-neutral-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 h-11 rounded-xl bg-serene-blue-500 hover:bg-serene-blue-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
