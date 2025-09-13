"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioMiniPlayerProps {
  src: string;
  className?: string;
}

export function AudioMiniPlayer({ src, className }: AudioMiniPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Reset on src change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [src]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      void el.play();
      setIsPlaying(true);
    }
  };

  const onTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime || 0);
  };

  const onLoadedMetadata = () => {
    const el = audioRef.current;
    if (!el) return;
    setDuration(el.duration || 0);
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const pct = useMemo(() => {
    if (!duration) return 0;
    return Math.max(0, Math.min(100, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const format = (t: number) => {
    if (!isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const seek = (clientX: number, target: HTMLDivElement) => {
    if (!audioRef.current || !duration) return;
    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(audioRef.current.currentTime);
  };

  const onBarClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    seek(e.clientX, e.currentTarget);
  };

  const onKeyDownBar: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (!audioRef.current || !duration) return;
    if (e.key === "ArrowLeft") {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
      setCurrentTime(audioRef.current.currentTime);
    } else if (e.key === "ArrowRight") {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5);
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  return (
    <div className={cn("w-full rounded-lg bg-white border border-gray-200 p-3", className)}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className={cn(
            "inline-flex items-center justify-center h-9 w-9 rounded-full",
            isPlaying
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-900 text-white hover:bg-gray-800"
          )}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div
            role="slider"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration) || 0}
            aria-valuenow={Math.round(currentTime) || 0}
            tabIndex={0}
            onClick={onBarClick}
            onKeyDown={onKeyDownBar}
            className="relative h-1.5 w-full bg-gray-200 rounded-full cursor-pointer select-none"
          >
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
            <span>{format(currentTime)}</span>
            <span>{format(duration || 0)}</span>
          </div>
        </div>
      </div>

      {/* Hidden native element for playback core */}
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        className="hidden"
      />
    </div>
  );
}

