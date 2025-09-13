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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const chunksRef = useRef<Blob[]>([]);
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 24 }, () => 6));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) {
      reset();
    }
    // Reset elapsed timer values when closed to avoid lingering state growth
    // (does not cause loops since open is controlled by parent)
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

  const cleanupAudio = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { sourceRef.current?.disconnect(); } catch {}
    try { analyserRef.current?.disconnect(); } catch {}
    try { audioContextRef.current?.close(); } catch {}
    sourceRef.current = null;
    analyserRef.current = null;
    audioContextRef.current = null;
  };

  const reset = () => {
    stopTimer();
    setRecording(false);
    setPaused(false);
    setElapsed(0);
    chunksRef.current = [];
    setLevels(Array.from({ length: 24 }, () => 6));
    setPreviewUrl(null);
    setPreviewBlob(null);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    cleanupAudio();
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
        try {
          const blob = new Blob(localChunks, { type: 'audio/webm' });
          chunksRef.current = localChunks;
          if (blob.size > 0) {
            setPreviewBlob(blob);
            try {
              const url = URL.createObjectURL(blob);
              setPreviewUrl(url);
            } catch {}
          }
        } finally {
          cleanupAudio();
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;

      // Setup analyser for live waveform
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx as AudioContext;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        analyser.getByteTimeDomainData(dataArray);
        const step = Math.floor(dataArray.length / 24);
        const next: number[] = [];
        for (let i = 0; i < 24; i++) {
          const slice = dataArray.slice(i * step, (i + 1) * step);
          const avg = slice.reduce((a, b) => a + Math.abs(b - 128), 0) / slice.length;
          next.push(4 + Math.min(24, Math.round((avg / 128) * 24)));
        }
        setLevels(next);
        rafRef.current = requestAnimationFrame(update);
      };
      rafRef.current = requestAnimationFrame(update);

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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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

          {!previewUrl ? (
            <>
              <div className="flex items-center justify-center">
                <div className="w-40 h-40 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center relative overflow-hidden">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center ${recording ? 'recording-pulse' : ''}`}>
                    <div className="w-20 h-20 rounded-full bg-red-500/90 flex items-center justify-center text-white">
                      {recording ? (paused ? 'Paused' : 'REC') : 'Idle'}
                    </div>
                  </div>
                  {/* Live waveform */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1 items-end h-10">
                    {levels.map((h, i) => (
                      <span key={i} className="block w-1 bg-red-400/70" style={{ height: `${h}px` }} />
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
                    <Button variant="ghost" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={pauseRecording}>Pause</Button>
                    <Button variant="destructive" onClick={stopRecording}>Stop</Button>
                    <Button variant="ghost" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <audio controls src={previewUrl} className="w-full" />
                <div className="flex items-center justify-center gap-2">
                  <Button onClick={() => { if (previewBlob) onRecorded(previewBlob); onOpenChange(false); reset(); }}>
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => { onOpenChange(false); reset(); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

