"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";

export type PWAInstallHandlers = {
  showInstallPrompt: boolean;
  handleInstallClick: () => Promise<void>;
};

export function PWAInstallPrompt({ onHandlersReady }: { onHandlersReady?: (handlers: PWAInstallHandlers) => void } = {}) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // Default to true to prevent flash on load

  useEffect(() => {
    // Check if the app is already installed/running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        ('standalone' in navigator && (navigator as any).standalone) || 
        document.referrer.includes('android-app://');
      
      setIsStandalone(!!isStandaloneMode);
    };

    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

    return () => {
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkStandalone);
    };
  }, []);

  useEffect(() => {
    // Don't listen or show prompt if already installed or previously dismissed
    if (isStandalone || localStorage.getItem('ss_pwa_dismissed') === 'true') {
      return;
    }

    const handler = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show install prompt
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      localStorage.setItem('ss_pwa_dismissed', 'true'); // Hide completely after installation
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowInstallPrompt(false);
    localStorage.setItem('ss_pwa_dismissed', 'true');
  }, []);

  useEffect(() => {
    // Expose handlers to parent components
    if (onHandlersReady) {
      onHandlersReady({
        showInstallPrompt,
        handleInstallClick
      });
    }
  }, [showInstallPrompt, onHandlersReady, handleInstallClick]);

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:right-auto md:w-96 z-50 flex flex-col md:flex-row items-center gap-4 rounded-lg bg-white p-4 shadow-xl border border-gray-100">
      <div className="flex flex-col flex-1">
        <h3 className="text-sm font-semibold text-gray-900">Install Sauti Salama</h3>
        <p className="text-xs text-gray-600">Install our app for a faster, offline experience.</p>
      </div>
      <div className="flex gap-2 w-full md:w-auto shrink-0 mt-3 md:mt-0">
        <Button
          onClick={handleDismiss}
          variant="outline"
          size="sm"
          className="flex-1 md:flex-none"
        >
          Not now
        </Button>
        <Button
          onClick={handleInstallClick}
          variant="default"
          size="sm"
          className="flex-1 md:flex-none bg-[#FC8E00] hover:bg-[#e07d00] text-white"
        >
          Install App
        </Button>
      </div>
    </div>
  );
} 