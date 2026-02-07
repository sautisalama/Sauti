"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
	src: string;
	title?: string;
	className?: string;
}

/**
 * Calming audio player for voice notes
 * Uses deep teal color scheme from Sauti Salama theme
 */
export function AudioPlayer({ src, title = "Voice Recording", className }: AudioPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [isMuted, setIsMuted] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const handleLoadedMetadata = () => {
			setDuration(audio.duration);
			setIsLoaded(true);
		};

		const handleTimeUpdate = () => {
			setCurrentTime(audio.currentTime);
			setProgress((audio.currentTime / audio.duration) * 100);
		};

		const handleEnded = () => {
			setIsPlaying(false);
			setProgress(0);
			setCurrentTime(0);
		};

		const handleError = () => {
			setError("Unable to load audio");
			setIsLoaded(false);
		};

		audio.addEventListener("loadedmetadata", handleLoadedMetadata);
		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("ended", handleEnded);
		audio.addEventListener("error", handleError);

		return () => {
			audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("ended", handleEnded);
			audio.removeEventListener("error", handleError);
		};
	}, []);

	const togglePlayPause = () => {
		const audio = audioRef.current;
		if (!audio) return;

		if (isPlaying) {
			audio.pause();
		} else {
			audio.play();
		}
		setIsPlaying(!isPlaying);
	};

	const handleSeek = (value: number[]) => {
		const audio = audioRef.current;
		if (!audio) return;

		const newTime = (value[0] / 100) * duration;
		audio.currentTime = newTime;
		setProgress(value[0]);
		setCurrentTime(newTime);
	};

	const toggleMute = () => {
		const audio = audioRef.current;
		if (!audio) return;

		audio.muted = !isMuted;
		setIsMuted(!isMuted);
	};

	const formatTime = (time: number) => {
		if (isNaN(time)) return "0:00";
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

	if (error) {
		return (
			<div className={cn(
				"p-4 rounded-2xl bg-serene-neutral-50 border border-serene-neutral-200 text-center",
				className
			)}>
				<p className="text-sm text-serene-neutral-500">{error}</p>
			</div>
		);
	}

	return (
		<div className={cn(
			"p-4 rounded-2xl bg-gradient-to-br from-sauti-teal/5 to-sauti-teal/10 border border-sauti-teal/20",
			"transition-all duration-300 hover:shadow-md",
			className
		)}>
			<audio ref={audioRef} src={src} preload="metadata" />

			{/* Title */}
			<div className="flex items-center gap-3 mb-4">
				<div className="w-10 h-10 rounded-xl bg-sauti-teal/10 flex items-center justify-center">
					<Volume2 className="h-5 w-5 text-sauti-teal" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-semibold text-sauti-dark truncate">{title}</p>
					<p className="text-xs text-serene-neutral-500">
						{isLoaded ? formatTime(duration) : "Loading..."}
					</p>
				</div>
			</div>

			{/* Progress Bar */}
			<div className="mb-4">
				<Slider
					value={[progress]}
					onValueChange={handleSeek}
					max={100}
					step={0.1}
					disabled={!isLoaded}
					className="cursor-pointer [&_[role=slider]]:bg-sauti-teal [&_[role=slider]]:border-sauti-teal [&_.bg-primary]:bg-sauti-teal"
				/>
				<div className="flex justify-between mt-1">
					<span className="text-xs text-serene-neutral-500 font-medium tabular-nums">
						{formatTime(currentTime)}
					</span>
					<span className="text-xs text-serene-neutral-500 font-medium tabular-nums">
						{formatTime(duration)}
					</span>
				</div>
			</div>

			{/* Controls */}
			<div className="flex items-center justify-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={toggleMute}
					disabled={!isLoaded}
					className="h-10 w-10 rounded-full text-sauti-teal hover:bg-sauti-teal/10"
				>
					{isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
				</Button>

				<Button
					onClick={togglePlayPause}
					disabled={!isLoaded}
					className={cn(
						"h-14 w-14 rounded-full shadow-md transition-all duration-300",
						"bg-sauti-teal hover:bg-sauti-teal/90 text-white",
						"flex items-center justify-center"
					)}
				>
					{isPlaying ? (
						<Pause className="h-6 w-6" />
					) : (
						<Play className="h-6 w-6 ml-0.5" />
					)}
				</Button>

				<div className="h-10 w-10" /> {/* Spacer for visual balance */}
			</div>
		</div>
	);
}
