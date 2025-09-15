"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, RotateCcw, Check, X } from "lucide-react";

interface VoiceRecorderInlineProps {
	onRecorded: (blob: Blob) => void;
	onClose?: () => void;
}

// Compact inline voice recorder with improved UX
export function VoiceRecorderInline({
	onRecorded,
	onClose,
}: VoiceRecorderInlineProps) {
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
		Array.from({ length: 12 }, () => 2)
	);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
	const [unsupported, setUnsupported] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!(navigator.mediaDevices && window.MediaRecorder)) {
			setUnsupported(true);
		}
		return () => cleanupAll();
	}, [cleanupAll]);

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

	const reset = () => {
		stopTimer();
		setRecording(false);
		setPaused(false);
		setElapsed(0);
		setLevels(Array.from({ length: 12 }, () => 2));
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
			// Request microphone permission - this can be done at any time
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
			analyser.fftSize = 256;
			analyserRef.current = analyser;
			const source = ctx.createMediaStreamSource(stream);
			sourceRef.current = source;
			source.connect(analyser);

			const dataArray = new Uint8Array(analyser.frequencyBinCount);
			const update = () => {
				analyser.getByteTimeDomainData(dataArray);
				const step = Math.floor(dataArray.length / 12);
				const next: number[] = [];
				for (let i = 0; i < 12; i++) {
					const slice = dataArray.slice(i * step, (i + 1) * step);
					const avg =
						slice.reduce((a, b) => a + Math.abs(b - 128), 0) / (slice.length || 1);
					next.push(2 + Math.min(8, Math.round((avg / 128) * 8)));
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
			<div className="p-3 border border-red-200 bg-red-50 rounded-lg">
				<p className="text-sm text-red-600">
					Your browser does not support audio recording.
				</p>
			</div>
		);
	}

	if (permissionError) {
		return (
			<div className="p-3 border border-red-200 bg-red-50 rounded-lg">
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
		<div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
			{!previewUrl ? (
				<div className="space-y-3">
					{/* Recording State */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div
								className={`w-3 h-3 rounded-full ${
									recording ? "bg-red-500 animate-pulse" : "bg-gray-400"
								}`}
							/>
							<span className="text-sm font-medium">
								{recording ? (paused ? "Paused" : "Recording") : "Ready to record"}
							</span>
						</div>
						<span className="text-sm text-gray-500 font-mono">
							{formatTime(elapsed)}
						</span>
					</div>

					{/* Audio Level Meter */}
					{recording && (
						<div className="flex items-center justify-center gap-1 h-6">
							{levels.map((height, i) => (
								<div
									key={i}
									className="w-1 bg-red-400 rounded-full transition-all duration-100"
									style={{ height: `${height * 2}px` }}
								/>
							))}
						</div>
					)}

					{/* Controls */}
					<div className="flex items-center justify-center gap-2">
						{!recording ? (
							<Button
								onClick={startRecording}
								size="sm"
								className="bg-red-600 hover:bg-red-700 text-white"
							>
								<Mic className="w-4 h-4 mr-1" />
								Start Recording
							</Button>
						) : paused ? (
							<>
								<Button variant="outline" size="sm" onClick={resumeRecording}>
									<Play className="w-4 h-4 mr-1" />
									Resume
								</Button>
								<Button variant="destructive" size="sm" onClick={stopRecording}>
									<Square className="w-4 h-4 mr-1" />
									Stop
								</Button>
							</>
						) : (
							<>
								<Button variant="outline" size="sm" onClick={pauseRecording}>
									<Pause className="w-4 h-4 mr-1" />
									Pause
								</Button>
								<Button variant="destructive" size="sm" onClick={stopRecording}>
									<Square className="w-4 h-4 mr-1" />
									Stop
								</Button>
							</>
						)}
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								reset();
								onClose?.();
							}}
						>
							<X className="w-4 h-4" />
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-3">
					{/* Playback Controls */}
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium text-green-600">
							Recording Complete
						</span>
						<span className="text-sm text-gray-500 font-mono">
							{formatTime(elapsed)}
						</span>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={togglePlayback}
							className="flex-1"
						>
							{isPlaying ? (
								<Pause className="w-4 h-4 mr-1" />
							) : (
								<Play className="w-4 h-4 mr-1" />
							)}
							{isPlaying ? "Pause" : "Play"} Recording
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								reset();
							}}
						>
							<RotateCcw className="w-4 h-4 mr-1" />
							Re-record
						</Button>
					</div>

					{/* Hidden audio element for playback */}
					<audio
						ref={audioRef}
						src={previewUrl}
						onEnded={handleAudioEnded}
						className="hidden"
					/>

					{/* Action Buttons */}
					<div className="flex gap-2">
						<Button
							onClick={() => {
								if (previewBlob) onRecorded(previewBlob);
								onClose?.();
							}}
							size="sm"
							className="flex-1 bg-green-600 hover:bg-green-700 text-white"
						>
							<Check className="w-4 h-4 mr-1" />
							Attach to Report
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								reset();
								onClose?.();
							}}
						>
							<X className="w-4 h-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
