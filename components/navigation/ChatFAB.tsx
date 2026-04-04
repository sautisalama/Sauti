"use client";

import { useState, useEffect } from "react";
import { MessageCircle, X, MessageSquare, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CaseChatPanel } from "@/components/chat/CaseChatPanel";

interface ChatFABProps {
  matchId: string;
  survivorId: string;
  professionalId: string;
  professionalName: string;
  survivorName: string;
  className?: string;
}

export function ChatFAB({
  matchId,
  survivorId,
  professionalId,
  professionalName,
  survivorName,
  className,
}: ChatFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Basic unread count logic if possible
    // For now, let's just show a dot if there's any activity
    // In a real app, we'd subscribe to new messages
  }, [matchId]);

  return (
    <>
      <div className={cn("fixed bottom-6 right-6 z-[8000] lg:hidden", className)}>
        <Button
          size="icon"
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-sauti-teal hover:bg-sauti-dark text-white shadow-2xl shadow-sauti-teal/30 flex items-center justify-center transition-all active:scale-95"
        >
          <div className="relative">
            <MessageSquare className="h-6 w-6" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-red-500 border-2 border-sauti-teal">
                {unreadCount}
              </Badge>
            )}
          </div>
        </Button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-serene-neutral-900/60 backdrop-blur-sm z-[8900] lg:hidden animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sliding Drawer */}
      <div 
        className={cn(
          "fixed inset-x-0 bottom-0 z-[9000] h-[85vh] bg-white rounded-t-[2.5rem] shadow-2xl transition-transform duration-300 ease-in-out lg:hidden flex flex-col",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="w-12 h-1.5 bg-serene-neutral-100 rounded-full mx-auto mt-3 mb-1 shrink-0" />
        
        {/* Chat Panel is always rendered to maintain background loading */}
        <div className="flex-1 overflow-hidden relative">
          <CaseChatPanel
            matchId={matchId}
            survivorId={survivorId}
            professionalId={professionalId}
            professionalName={professionalName}
            survivorName={survivorName}
            className="absolute inset-0 border-0 rounded-none shadow-none h-full"
            onClose={() => setIsOpen(false)}
          />
        </div>
      </div>
    </>
  );
}
