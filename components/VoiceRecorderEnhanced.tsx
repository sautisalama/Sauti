"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Mic,
	Square,
	Play,
	Pause,
	RotateCcw,
	Check,
	X,
	Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderEnhancedProps {
	onRecorded: (blob: Blob) => void;
	onClose?: () => void;
}

export function VoiceRecorderEnhanced({
	onRecorded,
	onClose,
}: VoiceRecorderEnhancedProps) {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const rafRef = useRef<number | null>(null);
	const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const [permissionError, setPermissionError] = useState<string | null>(null);
	const [recording, setRecording] = useState(false);
	const [paused, setPaused] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [levels, setLevels] = useState<number[]>(
		Array.from({ length: 32 }, () => 2)
	);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
	const [unsupported, setUnsupported] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isHovering, setIsHovering] = useState(false);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!(navigator.mediaDevices && window.MediaRecorder)) {
			setUnsupported(true);
		}
		return () => cleanupAll();
	}, []);

	// Initialize audio element when previewUrl changes
	useEffect(() => {
		if (previewUrl && audioRef.current) {
			audioRef.current.load();
		}
	}, [previewUrl]);

	const startTimer = () => {
		if (timerRef.current) return;
		timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
	};

	const stopTimer = () => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	};

	const cleanupAudioGraph = () => {
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		rafRef.current = null;
		try {
			sourceRef.current?.disconnect();
		} catch {}
		try {
			analyserRef.current?.disconnect();
		} catch {}
		try {
			audioContextRef.current?.close();
		} catch {}
		sourceRef.current = null;
		analyserRef.current = null;
		audioContextRef.current = null;
	};

	const cleanupAll = () => {
		try {
			if (
				mediaRecorderRef.current &&
				mediaRecorderRef.current.state !== "inactive"
			) {
				mediaRecorderRef.current.stop();
			}
		} catch {}
		try {
			mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
		} catch {}
		mediaRecorderRef.current = null;
		stopTimer();
		cleanupAudioGraph();
	};

	const reset = () => {
		stopTimer();
		setRecording(false);
		setPaused(false);
		setElapsed(0);
		setLevels(Array.from({ length: 32 }, () => 2));
		setPreviewUrl(null);
		setPreviewBlob(null);
		setIsPlaying(false);
		chunksRef.current = [];
		setPermissionError(null);
	};

	const startRecording = async () => {
		try {
			setPermissionError(null);
			setUnsupported(false);
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mr = new MediaRecorder(stream);
			const localChunks: Blob[] = [];
			mr.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) localChunks.push(e.data);
			};
			mr.onstop = () => {
				try {
					const blob = new Blob(localChunks, { type: "audio/webm" });
					chunksRef.current = localChunks;
					if (blob.size > 0) {
						setPreviewBlob(blob);
						try {
							const url = URL.createObjectURL(blob);
							setPreviewUrl(url);
						} catch {}
					}
				} finally {
					cleanupAudioGraph();
				}
			};
			mr.start();
			mediaRecorderRef.current = mr;

			const Ctor: any =
				(window as any).AudioContext || (window as any).webkitAudioContext;
			const ctx = new Ctor();
			audioContextRef.current = ctx as AudioContext;
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 512;
			analyserRef.current = analyser;
			const source = ctx.createMediaStreamSource(stream);
			sourceRef.current = source;
			source.connect(analyser);

			const dataArray = new Uint8Array(analyser.frequencyBinCount);
			const update = () => {
				analyser.getByteTimeDomainData(dataArray);
				const step = Math.floor(dataArray.length / 32);
				const next: number[] = [];
				for (let i = 0; i < 32; i++) {
					const slice = dataArray.slice(i * step, (i + 1) * step);
					const avg =
						slice.reduce((a, b) => a + Math.abs(b - 128), 0) / (slice.length || 1);
					const normalized = Math.min(1, avg / 128);
					const height = 2 + Math.round(normalized * 28);
					next.push(height);
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
			if (err?.name === "NotAllowedError" || err?.name === "NotFoundError") {
				setPermissionError("Microphone permission denied or not found.");
			} else {
				setPermissionError(err?.message || "Could not start recording.");
			}
		}
	};

	const pauseRecording = () => {
		const mr = mediaRecorderRef.current;
		if (!mr) return;
		try {
			if (mr.state === "recording") {
				mr.pause();
				setPaused(true);
				stopTimer();
			}
		} catch {}
	};

	const resumeRecording = () => {
		const mr = mediaRecorderRef.current;
		if (!mr) return;
		try {
			if (mr.state === "paused") {
				mr.resume();
				setPaused(false);
				startTimer();
			}
		} catch {}
	};

	const stopRecording = () => {
		const mr = mediaRecorderRef.current;
		if (!mr) return;
		try {
			mr.stop();
			mr.stream.getTracks().forEach((t) => t.stop());
			setRecording(false);
			setPaused(false);
			stopTimer();
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		} catch {}
	};

	const togglePlayback = () => {
		if (!audioRef.current) return;

		if (isPlaying) {
			audioRef.current.pause();
			setIsPlaying(false);
		} else {
			audioRef.current.play();
			setIsPlaying(true);
		}
	};

	const handleAudioEnded = () => {
		setIsPlaying(false);
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	if (unsupported) {
		return (
			<div className="p-4 border border-red-200 bg-red-50 rounded-2xl">
				<p className="text-sm text-red-600">
					Your browser does not support audio recording.
				</p>
			</div>
		);
	}

	if (permissionError) {
		return (
			<div className="p-4 border border-red-200 bg-red-50 rounded-2xl">
				<p className="text-sm text-red-600">{permissionError}</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setPermissionError(null)}
					className="mt-2"
				>
					Try Again
				</Button>
			</div>
		);
	}

	return (
		<div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-6 shadow-sm">
			{!previewUrl ? (
				<div className="space-y-6">
					{/* Recording State Header */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div
								className={cn(
									"w-3 h-3 rounded-full transition-all duration-300",
									recording
										? "bg-red-500 animate-pulse shadow-lg shadow-red-200"
										: "bg-gray-400"
								)}
							/>
							<span className="text-sm font-medium text-gray-700">
								{recording ? (paused ? "Paused" : "Recording") : "Ready to record"}
							</span>
						</div>
						<div className="text-sm text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-lg">
							{formatTime(elapsed)}
						</div>
					</div>

					{/* Enhanced Waveform */}
					<div className="space-y-3">
						<div className="flex items-center justify-center h-16 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
							<div className="flex items-end justify-center gap-1 h-12 w-full">
								{levels.map((height, i) => (
									<div
										key={i}
										className={cn(
											"w-1 rounded-full transition-all duration-100 ease-out",
											recording
												? "bg-gradient-to-t from-red-400 to-red-600 shadow-sm"
												: "bg-gradient-to-t from-gray-300 to-gray-400",
											isHovering && "shadow-md"
										)}
										style={{
											height: `${height}px`,
											minHeight: "2px",
										}}
									/>
								))}
							</div>
						</div>
						{recording && (
							<div className="text-center">
								<p className="text-xs text-gray-500 flex items-center justify-center gap-1">
									<Volume2 className="h-3 w-3" />
									Speak clearly into your microphone
								</p>
							</div>
						)}
					</div>

					{/* Control Buttons */}
					<div className="flex items-center justify-center gap-3">
						{!recording ? (
							<Button
								type="button"
								onClick={startRecording}
								size="lg"
								className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
								onMouseEnter={() => setIsHovering(true)}
								onMouseLeave={() => setIsHovering(false)}
							>
								<Mic className="w-5 h-5 mr-2" />
								Start Recording
							</Button>
						) : paused ? (
							<>
								<Button
									type="button"
									variant="outline"
									size="lg"
									onClick={resumeRecording}
									className="px-6 py-3 rounded-xl"
								>
									<Play className="w-4 h-4 mr-2" />
									Resume
								</Button>
								<Button
									type="button"
									variant="destructive"
									size="lg"
									onClick={stopRecording}
									className="px-6 py-3 rounded-xl"
								>
									<Square className="w-4 h-4 mr-2" />
									Stop
								</Button>
							</>
						) : (
							<>
								<Button
									type="button"
									variant="outline"
									size="lg"
									onClick={pauseRecording}
									className="px-6 py-3 rounded-xl"
								>
									<Pause className="w-4 h-4 mr-2" />
									Pause
								</Button>
								<Button
									type="button"
									variant="destructive"
									size="lg"
									onClick={stopRecording}
									className="px-6 py-3 rounded-xl"
								>
									<Square className="w-4 h-4 mr-2" />
									Stop
								</Button>
							</>
						)}
						<Button
							type="button"
							variant="ghost"
							size="lg"
							onClick={() => {
								reset();
								onClose?.();
							}}
							className="px-4 py-3 rounded-xl"
						>
							<X className="w-4 h-4" />
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-6">
					{/* Playback Header */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full bg-green-500" />
							<span className="text-sm font-medium text-green-700">
								Recording Complete
							</span>
						</div>
						<div className="text-sm text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-lg">
							{formatTime(elapsed)}
						</div>
					</div>

					{/* Enhanced Audio Player */}
					<div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
						<div className="flex items-center gap-4">
							<Button
								type="button"
								onClick={togglePlayback}
								size="lg"
								className="bg-green-500 hover:bg-green-600 text-white rounded-full w-12 h-12 p-0 shadow-lg"
							>
								{isPlaying ? (
									<Pause className="w-5 h-5" />
								) : (
									<Play className="w-5 h-5 ml-0.5" />
								)}
							</Button>
							<div className="flex-1">
								<div className="flex items-center gap-2 mb-2">
									<Volume2 className="h-4 w-4 text-gray-500" />
									<span className="text-sm font-medium text-gray-700">
										Voice Recording
									</span>
								</div>
								<div className="w-full bg-white rounded-full h-2 overflow-hidden">
									<div className="h-full bg-gradient-to-r from-green-400 to-blue-400 rounded-full transition-all duration-300" />
								</div>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-3">
						<Button
							type="button"
							onClick={() => {
								if (previewBlob) onRecorded(previewBlob);
								onClose?.();
							}}
							size="lg"
							className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
						>
							<Check className="w-4 h-4 mr-2" />
							Attach to Report
						</Button>
						<Button
							type="button"
							variant="outline"
							size="lg"
							onClick={() => {
								reset();
							}}
							className="px-6 py-3 rounded-xl"
						>
							<RotateCcw className="w-4 h-4 mr-2" />
							Re-record
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="lg"
							onClick={() => {
								reset();
								onClose?.();
							}}
							className="px-4 py-3 rounded-xl"
						>
							<X className="w-4 h-4" />
						</Button>
					</div>

					{/* Hidden audio element for playback */}
					<audio
						ref={audioRef}
						src={previewUrl}
						onEnded={handleAudioEnded}
						className="hidden"
					/>
				</div>
			)}
		</div>
	);
}
