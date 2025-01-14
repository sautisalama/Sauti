"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface AvatarUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string | null;
  userId: string;
  onAvatarUpdate: (newUrl: string) => void;
}

export function AvatarUpdateDialog({
  isOpen,
  onClose,
  currentAvatarUrl,
  userId,
  onAvatarUpdate,
}: AvatarUpdateDialogProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const handleUpdateAvatar = async () => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", userId);

      if (error) throw error;

      onAvatarUpdate(avatarUrl);
      toast({
        title: "Success",
        description: "Avatar updated successfully",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update avatar",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Update Profile Picture</AlertDialogTitle>
          <AlertDialogDescription>
            Enter a URL for your new profile picture.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-6 flex flex-col items-center gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarUrl || currentAvatarUrl || ""} />
            <AvatarFallback>
              {userId.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <Input
            placeholder="Enter image URL"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="w-full"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button 
            onClick={handleUpdateAvatar} 
            disabled={isLoading}
          >
            {isLoading ? "Updating..." : "Update"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 