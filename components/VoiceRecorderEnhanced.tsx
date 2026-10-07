"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, RotateCcw, Check, X, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderEnhancedProps {
	onRecorded: (blob: Blob) => void;
	onClose?: () => void;
}

/** Hard stop so a forgotten recording can't produce a huge upload. */
const MAX_SECONDS = 10 * 60;
const BARS = 32;

/**
 * Pick a container the current browser can actually record AND play back.
 * Chrome/Firefox/Edge → webm/ogg; Safari (iOS/macOS) → mp4. Hard-coding webm
 * makes Safari recordings mislabeled and unplayable.
 */
function pickMimeType(): string | undefined {
	if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
	return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
}

const baseType = (t: string) => (t.split(";")[0] || "audio/webm").trim().toLowerCase();

function describeError(err: unknown): string {
	const e = err as { name?: string; message?: string };
	if (typeof window !== "undefined" && !window.isSecureContext) return "Recording needs a secure (https) connection.";
	switch (e?.name) {
		case "NotAllowedError":
		case "SecurityError":
			return "Microphone access is blocked. Allow it for this site in your browser settings, then try again.";
		case "NotFoundError":
		case "OverconstrainedError":
			return "No microphone was found on this device.";
		case "NotReadableError":
		case "AbortError":
			return "Your microphone is being used by another app. Close it and try again.";
		default:
			return e?.message || "Could not start recording.";
	}
}

export function VoiceRecorderEnhanced({ onRecorded, onClose }: VoiceRecorderEnhancedProps) {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const rafRef = useRef<number | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const recordingRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const previewUrlRef = useRef<string | null>(null);

	const [error, setError] = useState<string | null>(null);
	const [starting, setStarting] = useState(false);
	const [recording, setRecording] = useState(false);
	const [paused, setPaused] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [levels, setLevels] = useState<number[]>(() => Array.from({ length: BARS }, () => 2));
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playPos, setPlayPos] = useState(0);
	const [unsupported] = useState(() => typeof window !== "undefined" && !(!!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== "undefined"));

	const stopTimer = useCallback(() => {
		if (timerRef.current) clearInterval(timerRef.current);
		timerRef.current = null;
	}, []);

	const releaseAudioGraph = useCallback(() => {
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		rafRef.current = null;
		audioContextRef.current?.close().catch(() => undefined);
		audioContextRef.current = null;
	}, []);

	const releaseStream = useCallback(() => {
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
	}, []);

	/** Stop everything and free the microphone. Safe to call repeatedly. */
	const teardown = useCallback(() => {
		recordingRef.current = false;
		stopTimer();
		releaseAudioGraph();
		const mr = mediaRecorderRef.current;
		if (mr) {
			mr.ondataavailable = null;
			mr.onstop = null;
			try {
				if (mr.state !== "inactive") mr.stop();
			} catch {
				/* already stopped */
			}
		}
		mediaRecorderRef.current = null;
		releaseStream();
	}, [releaseAudioGraph, releaseStream, stopTimer]);

	// Release the mic only when the recorder goes away. (Depending on an unstable
	// cleanup function here used to re-run teardown on every re-render — i.e. every
	// timer tick — which stopped the recording after about a second.)
	useEffect(() => {
		return () => {
			teardown();
			if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
		};
	}, [teardown]);

	const setPreview = (blob: Blob | null) => {
		if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
		previewUrlRef.current = blob ? URL.createObjectURL(blob) : null;
		setPreviewBlob(blob);
		setPreviewUrl(previewUrlRef.current);
	};

	const reset = () => {
		teardown();
		setRecording(false);
		setPaused(false);
		setStarting(false);
		setElapsed(0);
		setLevels(Array.from({ length: BARS }, () => 2));
		setPreview(null);
		setIsPlaying(false);
		setPlayPos(0);
		setError(null);
	};

	const buzz = (ms: number) => {
		try {
			navigator.vibrate?.(ms);
		} catch {
			/* not supported */
		}
	};

	const startRecording = async () => {
		if (starting || recording) return;
		setError(null);
		setStarting(true);
		let stream: MediaStream | null = null;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
			});
			streamRef.current = stream;

			const mimeType = pickMimeType();
			const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			const chunks: Blob[] = [];
			mr.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) chunks.push(e.data);
			};
			mr.onerror = () => {
				setError("Recording stopped unexpectedly. Please try again.");
				teardown();
				setRecording(false);
			};
			mr.onstop = () => {
				const type = baseType(mr.mimeType || mimeType || "audio/webm");
				const blob = new Blob(chunks, { type });
				releaseStream();
				releaseAudioGraph();
				if (blob.size === 0) {
					setError("Nothing was recorded. Check your microphone and try again.");
					return;
				}
				setPreview(blob);
			};
			mr.start(250);
			mediaRecorderRef.current = mr;
			recordingRef.current = true;
			setRecording(true);
			setPaused(false);
			setElapsed(0);
			buzz(15);

			stopTimer();
			timerRef.current = setInterval(() => {
				setElapsed((s) => {
					if (s + 1 >= MAX_SECONDS) stopRecording();
					return s + 1;
				});
			}, 1000);

			// Level meter — purely visual, so any failure here must not break recording.
			try {
				const Ctor: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
				const ctx = new Ctor();
				audioContextRef.current = ctx;
				if (ctx.state === "suspended") await ctx.resume();
				const analyser = ctx.createAnalyser();
				analyser.fftSize = 512;
				ctx.createMediaStreamSource(stream).connect(analyser);
				const data = new Uint8Array(analyser.frequencyBinCount);
				const step = Math.max(1, Math.floor(data.length / BARS));
				const tick = () => {
					if (!recordingRef.current) return;
					analyser.getByteTimeDomainData(data);
					const next: number[] = [];
					for (let i = 0; i < BARS; i++) {
						let sum = 0;
						for (let j = i * step; j < (i + 1) * step; j++) sum += Math.abs(data[j] - 128);
						next.push(2 + Math.round(Math.min(1, sum / step / 64) * 28));
					}
					setLevels(next);
					rafRef.current = requestAnimationFrame(tick);
				};
				rafRef.current = requestAnimationFrame(tick);
			} catch {
				/* meter unavailable */
			}
		} catch (err) {
			stream?.getTracks().forEach((t) => t.stop());
			teardown();
			setRecording(false);
			setError(describeError(err));
		} finally {
			setStarting(false);
		}
	};

	const pauseRecording = () => {
		const mr = mediaRecorderRef.current;
		if (mr?.state !== "recording") return;
		mr.pause();
		stopTimer();
		setPaused(true);
	};

	const resumeRecording = () => {
		const mr = mediaRecorderRef.current;
		if (mr?.state !== "paused") return;
		mr.resume();
		setPaused(false);
		stopTimer();
		timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
	};

	function stopRecording() {
		const mr = mediaRecorderRef.current;
		recordingRef.current = false;
		stopTimer();
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		rafRef.current = null;
		setRecording(false);
		setPaused(false);
		buzz(10);
		try {
			if (mr && mr.state !== "inactive") mr.stop(); // onstop assembles the blob
		} catch {
			releaseStream();
		}
	}

	const togglePlayback = async () => {
		const a = audioRef.current;
		if (!a) return;
		if (isPlaying) {
			a.pause();
			setIsPlaying(false);
			return;
		}
		try {
			await a.play();
			setIsPlaying(true);
		} catch {
			setError("Could not play this recording on your device. You can still attach it.");
		}
	};

	const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

	if (unsupported) {
		return (
			<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">
				<p className="text-sm text-red-700">Your browser can&apos;t record audio. You can type your report instead, or try a recent version of Chrome, Firefox or Safari.</p>
				<Button type="button" variant="outline" size="sm" onClick={onClose} className="mt-3">Close</Button>
			</div>
		);
	}

	const stateLabel = starting ? "Starting microphone…" : recording ? (paused ? "Paused" : "Recording") : "Ready to record";

	return (
		<div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm sm:p-6">
			{error && (
				<div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
					{error}
				</div>
			)}

			{!previewUrl ? (
				<div className="space-y-5">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className={cn("h-3 w-3 rounded-full transition-colors duration-200", recording && !paused ? "animate-pulse bg-red-500 shadow-lg shadow-red-200" : "bg-gray-400")} />
							<span className="text-sm font-medium text-gray-700" aria-live="polite">{stateLabel}</span>
						</div>
						<div className="rounded-lg bg-gray-100 px-3 py-1 font-mono text-sm text-gray-600" aria-label="Recording time">{fmt(elapsed)}</div>
					</div>

					<div className="flex h-16 items-center justify-center rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 p-3" aria-hidden>
						<div className="flex h-12 w-full items-end justify-center gap-[3px]">
							{levels.map((h, i) => (
								<div key={i} className={cn("w-1 rounded-full", recording && !paused ? "bg-gradient-to-t from-red-400 to-red-600" : "bg-gray-300")} style={{ height: `${h}px`, transition: "height 90ms linear" }} />
							))}
						</div>
					</div>
					{recording && !paused && (
						<p className="flex items-center justify-center gap-1 text-center text-xs text-gray-500">
							<Volume2 className="h-3 w-3" aria-hidden /> Speak clearly. You can pause at any time.
						</p>
					)}

					<div className="flex flex-wrap items-center justify-center gap-3">
						{!recording ? (
							<Button type="button" onClick={startRecording} disabled={starting} size="lg" className="h-12 min-w-44 rounded-xl bg-red-500 px-8 text-white shadow-lg hover:bg-red-600">
								<Mic className="mr-2 h-5 w-5" aria-hidden /> {starting ? "Starting…" : "Start Recording"}
							</Button>
						) : (
							<>
								{paused ? (
									<Button type="button" variant="outline" size="lg" onClick={resumeRecording} className="h-12 rounded-xl px-6"><Play className="mr-2 h-4 w-4" aria-hidden /> Resume</Button>
								) : (
									<Button type="button" variant="outline" size="lg" onClick={pauseRecording} className="h-12 rounded-xl px-6"><Pause className="mr-2 h-4 w-4" aria-hidden /> Pause</Button>
								)}
								<Button type="button" variant="destructive" size="lg" onClick={stopRecording} className="h-12 rounded-xl px-6"><Square className="mr-2 h-4 w-4" aria-hidden /> Stop</Button>
							</>
						)}
						<Button type="button" variant="ghost" size="lg" aria-label="Cancel and close" onClick={() => { reset(); onClose?.(); }} className="h-12 rounded-xl px-4">
							<X className="h-4 w-4" aria-hidden />
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-5">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full bg-green-500" />
							<span className="text-sm font-medium text-green-700">Recording complete</span>
						</div>
						<div className="rounded-lg bg-gray-100 px-3 py-1 font-mono text-sm text-gray-600">{fmt(elapsed)}</div>
					</div>

					<div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-blue-50 p-4">
						<div className="flex items-center gap-4">
							<Button type="button" onClick={togglePlayback} aria-label={isPlaying ? "Pause playback" : "Play recording"} className="h-12 w-12 shrink-0 rounded-full bg-green-500 p-0 text-white shadow-lg hover:bg-green-600">
								{isPlaying ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="ml-0.5 h-5 w-5" aria-hidden />}
							</Button>
							<div className="min-w-0 flex-1">
								<p className="mb-2 text-sm font-medium text-gray-700">Listen back before you attach it</p>
								<div className="h-2 w-full overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(playPos * 100)} aria-label="Playback position">
									<div className="h-full rounded-full bg-gradient-to-r from-green-400 to-blue-400" style={{ width: `${playPos * 100}%`, transition: "width 200ms linear" }} />
								</div>
							</div>
						</div>
					</div>

					<div className="flex flex-wrap gap-3">
						<Button type="button" onClick={() => { if (previewBlob) onRecorded(previewBlob); onClose?.(); }} size="lg" className="h-12 flex-1 rounded-xl bg-green-500 text-white shadow-lg hover:bg-green-600">
							<Check className="mr-2 h-4 w-4" aria-hidden /> Attach to Report
						</Button>
						<Button type="button" variant="outline" size="lg" onClick={reset} className="h-12 rounded-xl px-5"><RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Re-record</Button>
						<Button type="button" variant="ghost" size="lg" aria-label="Discard and close" onClick={() => { reset(); onClose?.(); }} className="h-12 rounded-xl px-4"><X className="h-4 w-4" aria-hidden /></Button>
					</div>

					<audio
						ref={audioRef}
						src={previewUrl}
						preload="metadata"
						onEnded={() => { setIsPlaying(false); setPlayPos(0); }}
						onTimeUpdate={(e) => { const a = e.currentTarget; setPlayPos(a.duration && isFinite(a.duration) ? a.currentTime / a.duration : 0); }}
						className="hidden"
					/>
				</div>
			)}
		</div>
	);
}
