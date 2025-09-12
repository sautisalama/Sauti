"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface VoiceRecorderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: (blob: Blob) => void;
}

export function VoiceRecorderModal({ open, onOpenChange, onRecorded }: VoiceRecorderModalProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

  const startTimer = () => {
    if (timerRef.current) return;
    const started = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = () => {
    stopTimer();
    setRecording(false);
    setPaused(false);
    setElapsed(0);
    setChunks([]);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    setPermissionError(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const localChunks: Blob[] = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) localChunks.push(e.data);
      };
      mr.onstop = () => {
        setChunks(localChunks);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setPaused(false);
      setElapsed(0);
      startTimer();
    } catch (err: any) {
      console.error(err);
      setPermissionError(err?.message || "Microphone permission denied");
    }
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    try {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
        setPaused(true);
        stopTimer();
      }
    } catch {}
  };

  const resumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    try {
      if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
        setPaused(false);
        startTimer();
      }
    } catch {}
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    try {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setRecording(false);
      setPaused(false);
      stopTimer();
      setTimeout(() => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size > 0) onRecorded(blob);
        onOpenChange(false);
      }, 50);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Voice note</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {permissionError && (
            <div className="text-sm text-red-600">{permissionError}</div>
          )}

          <div className="flex items-center justify-center">
            <div className="w-40 h-40 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center relative overflow-hidden">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${recording ? 'recording-pulse' : ''}`}>
                <div className="w-20 h-20 rounded-full bg-red-500/90 flex items-center justify-center text-white">
                  {recording ? (paused ? 'Paused' : 'REC') : 'Idle'}
                </div>
              </div>
              {/* Simple waveform animation */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1">
                {[...Array(16)].map((_, i) => (
                  <span key={i} className="block w-1 bg-red-400/70" style={{ height: `${Math.max(4, (recording ? (Math.sin((Date.now()/200)+(i*0.6)) * 12 + 14) : 6))}px` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-neutral-600 dark:text-neutral-300">{Math.floor(elapsed/60).toString().padStart(2,'0')}:{(elapsed%60).toString().padStart(2,'0')}</div>

          <div className="flex items-center justify-center gap-2">
            {!recording ? (
              <Button onClick={startRecording} className="bg-red-600 hover:bg-red-700">Start</Button>
            ) : paused ? (
              <>
                <Button variant="outline" onClick={resumeRecording}>Resume</Button>
                <Button variant="destructive" onClick={stopRecording}>Stop</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={pauseRecording}>Pause</Button>
                <Button variant="destructive" onClick={stopRecording}>Stop</Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

