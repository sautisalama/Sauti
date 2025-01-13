"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Toast } from "./ui/toast";

export type PWAInstallHandlers = {
  showInstallPrompt: boolean;
  handleInstallClick: () => Promise<void>;
};

export function PWAInstallPrompt({ onHandlersReady }: { onHandlersReady?: (handlers: PWAInstallHandlers) => void } = {}) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    // Expose handlers to parent components
    if (onHandlersReady) {
      onHandlersReady({
        showInstallPrompt,
        handleInstallClick
      });
    }
  }, [showInstallPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-4 rounded-lg bg-white p-4 shadow-lg">
      <div className="flex flex-col">
        <h3 className="text-lg font-semibold">Install Sauti Salama</h3>
        <p className="text-sm text-gray-600">Install our app for a better experience</p>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => setShowInstallPrompt(false)}
          variant="outline"
        >
          Not now
        </Button>
        <Button
          onClick={handleInstallClick}
          variant="default"
        >
          Install
        </Button>
      </div>
    </div>
  );
} 