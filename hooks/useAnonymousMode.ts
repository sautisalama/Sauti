"use client";

import { useState, useEffect, useCallback } from 'react';
import { getCurrentAnonymousId } from '@/utils/chat/preload';

export function useAnonymousMode() {
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [anonymousId, setAnonymousId] = useState<string | null>(null);

  // Check current state
  useEffect(() => {
    const checkState = () => {
      if (typeof window === "undefined") return;
      
      const currentMode = window.localStorage.getItem("ss_anon_mode") === "1";
      const currentAnonId = getCurrentAnonymousId();
      
      setIsAnonymous(currentMode);
      setAnonymousId(currentAnonId);
    };

    checkState();

    // Listen for storage changes (across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "ss_anon_mode" || e.key === "ss_anon_id") {
        checkState();
      }
    };

    // Listen for custom anonymous mode change events
    const handleAnonymousModeChange = () => {
      checkState();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('anonymousModeChanged', handleAnonymousModeChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('anonymousModeChanged', handleAnonymousModeChange);
    };
  }, []);

  const toggleAnonymousMode = useCallback((userId: string) => {
    if (typeof window === "undefined") return;

    const newMode = !isAnonymous;
    
    if (newMode) {
      // Enable anonymous mode
      window.localStorage.setItem("ss_anon_mode", "1");
      
      // Generate or retrieve anonymous ID
      let anonId = getCurrentAnonymousId();
      if (!anonId) {
        const base = userId.slice(0, 12);
        const rand = Math.random().toString(36).slice(2, 8);
        anonId = `anon-${base}-${rand}`;
        window.localStorage.setItem("ss_anon_id", anonId);
      }
      setAnonymousId(anonId);
    } else {
      // Disable anonymous mode (keep anonymous ID for future use)
      window.localStorage.setItem("ss_anon_mode", "0");
    }
    
    setIsAnonymous(newMode);
    
    // Notify other components
    window.dispatchEvent(new CustomEvent('anonymousModeChanged', { 
      detail: { isAnonymous: newMode, userId, anonymousId: anonymousId } 
    }));
    
    return newMode;
  }, [isAnonymous, anonymousId]);

  const enableAnonymousMode = useCallback((userId: string) => {
    if (!isAnonymous) {
      return toggleAnonymousMode(userId);
    }
    return true;
  }, [isAnonymous, toggleAnonymousMode]);

  const disableAnonymousMode = useCallback((userId: string) => {
    if (isAnonymous) {
      return toggleAnonymousMode(userId);
    }
    return false;
  }, [isAnonymous, toggleAnonymousMode]);

  return {
    isAnonymous,
    anonymousId,
    toggleAnonymousMode,
    enableAnonymousMode,
    disableAnonymousMode
  };
}
