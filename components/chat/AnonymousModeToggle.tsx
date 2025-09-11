"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Shield, User, Loader2, CheckCircle } from "lucide-react";
import { warmupBothModes, getPreloadedChat, isChatReady, getCurrentAnonymousId } from "@/utils/chat/preload";

interface AnonymousModeToggleProps {
  userId: string;
  username: string;
  className?: string;
  onToggle?: (isAnonymous: boolean) => void;
}

export function AnonymousModeToggle({ userId, username, className = "", onToggle }: AnonymousModeToggleProps) {
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preloadStatus, setPreloadStatus] = useState({
    regular: false,
    anonymous: false
  });
  const { toast } = useToast();

  // Check current state and preload status
  useEffect(() => {
    const checkState = () => {
      if (typeof window === "undefined") return;
      
      const currentMode = window.localStorage.getItem("ss_anon_mode") === "1";
      setIsAnonymous(currentMode);
      
      // Check preload status for both modes
      setPreloadStatus({
        regular: isChatReady(userId, false),
        anonymous: isChatReady(userId, true)
      });
    };

    checkState();
    
    // Check preload status periodically
    const interval = setInterval(checkState, 2000);
    return () => clearInterval(interval);
  }, [userId]);

  // Preload both modes on component mount
  useEffect(() => {
    if (userId && username) {
      console.log('🚀 Starting dual-mode preloading...');
      warmupBothModes(userId, username);
      
      // Check preload progress
      const checkProgress = setInterval(() => {
        setPreloadStatus({
          regular: isChatReady(userId, false),
          anonymous: isChatReady(userId, true)
        });
      }, 1000);

      // Clear interval after 30 seconds
      setTimeout(() => clearInterval(checkProgress), 30000);
      
      return () => clearInterval(checkProgress);
    }
  }, [userId, username]);

  const handleToggle = useCallback(async (newMode: boolean) => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      if (typeof window === "undefined") return;
      
      if (newMode) {
        // Switching to anonymous mode
        window.localStorage.setItem("ss_anon_mode", "1");
        
        // Ensure we have anonymous ID
        let anonId = getCurrentAnonymousId();
        if (!anonId) {
          const base = userId.slice(0, 12);
          const rand = Math.random().toString(36).slice(2, 8);
          anonId = `anon-${base}-${rand}`;
          window.localStorage.setItem("ss_anon_id", anonId);
        }
        
        // Check if anonymous mode is preloaded
        if (!isChatReady(userId, true)) {
          toast({
            title: "Preparing anonymous mode...",
            description: "Please wait while we set up your anonymous identity.",
          });
          
          // Give a small delay for preloading to catch up
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        setIsAnonymous(true);
        toast({
          title: "Anonymous mode enabled",
          description: "You will appear as Anonymous in chat. Your regular chats remain private.",
          duration: 3000,
        });
      } else {
        // Switching to regular mode
        window.localStorage.setItem("ss_anon_mode", "0");
        // Keep anonymous ID for potential future use
        
        setIsAnonymous(false);
        toast({
          title: "Regular mode enabled",
          description: "You are now using your profile identity in chat.",
          duration: 3000,
        });
      }
      
      // Notify parent component
      onToggle?.(newMode);
      
      // Trigger a page refresh for chat components to pick up the change
      // This ensures all chat components immediately reflect the mode change
      window.dispatchEvent(new CustomEvent('anonymousModeChanged', { 
        detail: { isAnonymous: newMode, userId, username } 
      }));
      
    } catch (error) {
      console.error('Failed to toggle anonymous mode:', error);
      toast({
        title: "Error",
        description: "Failed to change anonymous mode. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, userId, username, onToggle, toast]);

  const getStatusIcon = (ready: boolean) => {
    if (ready) return <CheckCircle className="h-3 w-3 text-green-500" />;
    return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
  };

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isAnonymous ? (
              <EyeOff className="h-4 w-4 text-orange-500" />
            ) : (
              <Eye className="h-4 w-4 text-blue-500" />
            )}
            <div>
              <p className="font-medium text-sm">Anonymous Chat Mode</p>
              <p className="text-xs text-muted-foreground">
                {isAnonymous ? "You appear as Anonymous" : "Using your profile identity"}
              </p>
            </div>
          </div>
          
          <Switch
            checked={isAnonymous}
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
        </div>

        {/* Current Status */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            {isAnonymous ? (
              <Shield className="h-3 w-3 text-orange-500" />
            ) : (
              <User className="h-3 w-3 text-blue-500" />
            )}
            <span className="text-muted-foreground">
              Current mode: {isAnonymous ? "Anonymous" : "Regular"}
            </span>
          </div>
          
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>

        {/* Preload Status */}
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground font-medium">Chat Readiness:</p>
          <div className="flex justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon(preloadStatus.regular)}
              <span className={preloadStatus.regular ? "text-green-600" : "text-muted-foreground"}>
                Regular Mode
              </span>
              {preloadStatus.regular && <Badge variant="secondary" className="text-xs">Ready</Badge>}
            </div>
            
            <div className="flex items-center space-x-2">
              {getStatusIcon(preloadStatus.anonymous)}
              <span className={preloadStatus.anonymous ? "text-green-600" : "text-muted-foreground"}>
                Anonymous Mode
              </span>
              {preloadStatus.anonymous && <Badge variant="secondary" className="text-xs">Ready</Badge>}
            </div>
          </div>
        </div>

        {/* Quick Access */}
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant={!isAnonymous ? "default" : "outline"}
            className="flex-1 text-xs"
            onClick={() => handleToggle(false)}
            disabled={isLoading || !isAnonymous}
          >
            <User className="h-3 w-3 mr-1" />
            Regular
          </Button>
          
          <Button
            size="sm" 
            variant={isAnonymous ? "default" : "outline"}
            className="flex-1 text-xs"
            onClick={() => handleToggle(true)}
            disabled={isLoading || isAnonymous}
          >
            <Shield className="h-3 w-3 mr-1" />
            Anonymous
          </Button>
        </div>
        
        {/* Info */}
        <p className="text-xs text-muted-foreground">
          💡 Both modes are preloaded for instant switching. Your chats remain separate and private.
        </p>
      </CardContent>
    </Card>
  );
}
