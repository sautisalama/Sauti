"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Captions, Check, Copy, Loader2, Mic, MicOff, MonitorUp, PhoneOff, Users, Video, VideoOff } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { unwrap } from "@/lib/action-result";
import { saveTranscript, type TranscriptLine } from "@/app/actions/mjengo-meet";
import { cn } from "@/lib/utils";

type SignalKind = "offer" | "answer" | "ice";
interface Peer { id: string; name: string }
interface Remote extends Peer { stream: MediaStream | null; muted: boolean }

const ICE: RTCIceServer[] = [
	{ urls: "stun:stun.l.google.com:19302" },
	...(process.env.NEXT_PUBLIC_TURN_URL
		? [{ urls: process.env.NEXT_PUBLIC_TURN_URL, username: process.env.NEXT_PUBLIC_TURN_USER, credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL } as RTCIceServer]
		: []),
];

const LANGS = [["en-KE", "English (Kenya)"], ["en-US", "English (US)"], ["en-GB", "English (UK)"], ["sw-KE", "Kiswahili"]] as const;

/** A small peer-to-peer call room: video or voice, screen sharing, live captions kept as a transcript. */
export function MeetRoom({ code, mode, title, defaultName, canSave }: { code: string; mode: "video" | "voice"; title: string | null; defaultName: string; canSave: boolean }) {
	const [name, setName] = useState(defaultName);
	const [joined, setJoined] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [micOn, setMicOn] = useState(true);
	const [camOn, setCamOn] = useState(mode === "video");
	const [sharing, setSharing] = useState(false);
	const [remotes, setRemotes] = useState<Remote[]>([]);
	const [captionsOn, setCaptionsOn] = useState(true);
	const [panel, setPanel] = useState<"none" | "transcript" | "people">("none");
	const [lines, setLines] = useState<TranscriptLine[]>([]);
	const [lang, setLang] = useState<string>("en-KE");
	const [copied, setCopied] = useState(false);
	const [speechOk, setSpeechOk] = useState(true);

	const myId = useRef(`${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`);
	const local = useRef<MediaStream | null>(null);
	const localVideo = useRef<HTMLVideoElement>(null);
	const pcs = useRef(new Map<string, RTCPeerConnection>());
	const channel = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
	const recog = useRef<{ stop: () => void } | null>(null);
	const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
	const savedUpTo = useRef(0);
	const linesRef = useRef<TranscriptLine[]>([]);
	linesRef.current = lines;

	const link = typeof window === "undefined" ? "" : `${window.location.origin}/meet/${code}`;

	const addLine = useCallback((l: TranscriptLine) => {
		setLines((cur) => (cur.some((x) => x.id === l.id) ? cur : [...cur, l]));
	}, []);

	const send = useCallback((event: string, payload: Record<string, unknown>) => {
		channel.current?.send({ type: "broadcast", event, payload }).catch(() => undefined);
	}, []);

	const setRemote = useCallback((id: string, patch: Partial<Remote> & { name?: string }) => {
		setRemotes((cur) => {
			const have = cur.find((r) => r.id === id);
			if (have) return cur.map((r) => (r.id === id ? { ...r, ...patch } : r));
			return [...cur, { id, name: patch.name ?? "Guest", stream: patch.stream ?? null, muted: false }];
		});
	}, []);

	const connect = useCallback(async (peer: Peer, initiator: boolean) => {
		if (pcs.current.has(peer.id)) return;
		const pc = new RTCPeerConnection({ iceServers: ICE });
		pcs.current.set(peer.id, pc);
		setRemote(peer.id, { name: peer.name });
		local.current?.getTracks().forEach((t) => pc.addTrack(t, local.current!));
		if (!local.current?.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });
		pc.ontrack = (e) => setRemote(peer.id, { stream: e.streams[0] });
		pc.onicecandidate = (e) => { if (e.candidate) send("signal", { from: myId.current, to: peer.id, kind: "ice" as SignalKind, data: e.candidate.toJSON() }); };
		pc.onconnectionstatechange = () => {
			if (pc.connectionState === "failed" || pc.connectionState === "closed") {
				pcs.current.delete(peer.id);
				setRemotes((cur) => cur.filter((r) => r.id !== peer.id));
			}
		};
		if (initiator) {
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			send("signal", { from: myId.current, to: peer.id, kind: "offer" as SignalKind, data: offer, name });
		}
	}, [name, send, setRemote]);

	const onSignal = useCallback(async (m: { from: string; to: string; kind: SignalKind; data: unknown; name?: string }) => {
		if (m.to !== myId.current) return;
		if (m.kind === "offer") {
			await connect({ id: m.from, name: m.name ?? "Guest" }, false);
			const pc = pcs.current.get(m.from)!;
			await pc.setRemoteDescription(m.data as RTCSessionDescriptionInit);
			for (const c of pendingIce.current.get(m.from) ?? []) await pc.addIceCandidate(c).catch(() => undefined);
			pendingIce.current.delete(m.from);
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			send("signal", { from: myId.current, to: m.from, kind: "answer" as SignalKind, data: answer });
		} else if (m.kind === "answer") {
			await pcs.current.get(m.from)?.setRemoteDescription(m.data as RTCSessionDescriptionInit);
		} else if (m.kind === "ice") {
			const pc = pcs.current.get(m.from);
			if (pc?.remoteDescription) await pc.addIceCandidate(m.data as RTCIceCandidateInit).catch(() => undefined);
			else pendingIce.current.set(m.from, [...(pendingIce.current.get(m.from) ?? []), m.data as RTCIceCandidateInit]);
		}
	}, [connect, send]);

	const join = async () => {
		setError(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === "video" ? { width: 1280, height: 720 } : false });
			local.current = stream;
			stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
			stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
		} catch {
			// No camera or microphone permission: still allow listening.
			local.current = new MediaStream();
			setMicOn(false);
			setCamOn(false);
		}

		const supabase = createClient();
		const ch = supabase.channel(`meet:${code}`, { config: { broadcast: { self: false }, presence: { key: myId.current } } });
		channel.current = ch;
		ch.on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload))
			.on("broadcast", { event: "caption" }, ({ payload }) => addLine(payload as TranscriptLine))
			.on("broadcast", { event: "state" }, ({ payload }) => setRemote(payload.id, { muted: !!payload.muted }))
			.on("presence", { event: "join" }, ({ key, newPresences }) => {
				if (key === myId.current) return;
				const p = newPresences[0] as unknown as { name?: string };
				// The newer arrival is offered a connection by the one who was already here.
				connect({ id: key, name: p?.name ?? "Guest" }, true);
			})
			.on("presence", { event: "leave" }, ({ key }) => {
				pcs.current.get(key)?.close();
				pcs.current.delete(key);
				setRemotes((cur) => cur.filter((r) => r.id !== key));
			})
			.subscribe(async (status) => {
				if (status === "SUBSCRIBED") await ch.track({ name });
			});
		setJoined(true);
	};

	// Show my own camera.
	useEffect(() => {
		if (joined && localVideo.current && local.current) localVideo.current.srcObject = local.current;
	}, [joined, camOn, sharing]);

	// Live captions with the browser's speech recognition; every final phrase is shared and kept.
	useEffect(() => {
		if (!joined || !captionsOn || !micOn) { recog.current?.stop(); recog.current = null; return; }
		type SR = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number } }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
		const Ctor = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
		if (!Ctor) { setSpeechOk(false); return; }
		const r = new Ctor();
		r.lang = lang;
		r.continuous = true;
		r.interimResults = false;
		let stopped = false;
		r.onresult = (e) => {
			for (let i = e.resultIndex; i < e.results.length; i++) {
				if (!e.results[i].isFinal) continue;
				const text = e.results[i][0].transcript.trim();
				if (!text) continue;
				const line: TranscriptLine = { id: `${myId.current}-${Date.now()}-${i}`, name: name || "Guest", text, at: new Date().toISOString() };
				addLine(line);
				send("caption", line as unknown as Record<string, unknown>);
			}
		};
		r.onend = () => { if (!stopped) { try { r.start(); } catch { /* already running */ } } };
		r.onerror = () => undefined;
		try { r.start(); } catch { /* ignore */ }
		recog.current = { stop: () => { stopped = true; try { r.stop(); } catch { /* ignore */ } } };
		return () => { stopped = true; try { r.stop(); } catch { /* ignore */ } };
	}, [joined, captionsOn, micOn, lang, name, addLine, send]);

	const toggleMic = () => {
		const next = !micOn;
		setMicOn(next);
		local.current?.getAudioTracks().forEach((t) => (t.enabled = next));
		send("state", { id: myId.current, muted: !next });
	};
	const toggleCam = () => {
		const next = !camOn;
		setCamOn(next);
		local.current?.getVideoTracks().forEach((t) => (t.enabled = next));
	};

	const toggleShare = async () => {
		const swap = async (track: MediaStreamTrack | null) => {
			for (const pc of pcs.current.values()) {
				const s = pc.getSenders().find((x) => x.track?.kind === "video") ?? pc.getTransceivers().find((t) => t.receiver.track.kind === "video")?.sender;
				if (s) await s.replaceTrack(track).catch(() => undefined);
			}
		};
		if (sharing) {
			const cam = local.current?.getVideoTracks()[0] ?? null;
			await swap(cam);
			if (localVideo.current && local.current) localVideo.current.srcObject = local.current;
			setSharing(false);
			return;
		}
		try {
			const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
			const track = screen.getVideoTracks()[0];
			await swap(track);
			if (localVideo.current) localVideo.current.srcObject = screen;
			track.onended = () => { void toggleShareOff(); };
			setSharing(true);
		} catch { /* cancelled */ }
	};
	const toggleShareOff = async () => {
		const cam = local.current?.getVideoTracks()[0] ?? null;
		for (const pc of pcs.current.values()) {
			const s = pc.getSenders().find((x) => x.track?.kind === "video");
			if (s) await s.replaceTrack(cam).catch(() => undefined);
		}
		if (localVideo.current && local.current) localVideo.current.srcObject = local.current;
		setSharing(false);
	};

	// Keep what was said (signed-in team members only, so guests cannot write to the record).
	const persist = useCallback(async (end: boolean) => {
		if (!canSave) return;
		const fresh = linesRef.current.slice(savedUpTo.current);
		if (!fresh.length && !end) return;
		try {
			await unwrap(saveTranscript(code, fresh, end));
			savedUpTo.current = linesRef.current.length;
		} catch { /* retried at the next save */ }
	}, [canSave, code]);
	useEffect(() => {
		if (!joined || !canSave) return;
		const t = setInterval(() => persist(false), 30_000);
		return () => clearInterval(t);
	}, [joined, canSave, persist]);

	const leave = useCallback(async () => {
		recog.current?.stop();
		await persist(true);
		pcs.current.forEach((pc) => pc.close());
		pcs.current.clear();
		local.current?.getTracks().forEach((t) => t.stop());
		channel.current?.unsubscribe();
		setJoined(false);
		setRemotes([]);
	}, [persist]);

	useEffect(() => () => {
		pcs.current.forEach((pc) => pc.close());
		local.current?.getTracks().forEach((t) => t.stop());
		channel.current?.unsubscribe();
	}, []);

	const tiles = useMemo(() => remotes.length + 1, [remotes.length]);
	const cols = tiles <= 1 ? "grid-cols-1" : tiles <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3";

	if (!joined) {
		return (
			<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
				<div>
					<p className="text-sm font-medium text-[#787774]">Sauti Salama</p>
					<h1 className="mt-1 text-2xl font-semibold text-[#37352f]">{title || (mode === "voice" ? "Voice call" : "Video call")}</h1>
					<p className="mt-1 text-sm text-[#787774]">{mode === "voice" ? "Audio only. Your camera stays off." : "You can turn your camera and microphone off once you are in."}</p>
				</div>
				<label className="block">
					<span className="mb-1.5 block text-sm font-medium text-[#37352f]">Your name</span>
					<input value={name} onChange={(e) => setName(e.target.value)} placeholder="How should people see you?" className="h-11 w-full rounded-lg border border-black/10 px-3 text-[15px] outline-none focus:border-sauti-teal" />
				</label>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<button onClick={join} disabled={!name.trim()} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-sauti-teal text-[15px] font-semibold text-white hover:bg-sauti-dark disabled:opacity-40">
					{mode === "voice" ? <Mic className="h-5 w-5" /> : <Video className="h-5 w-5" />} Join now
				</button>
				<p className="text-xs text-[#9b9a97]">Calls go directly between people in the call. Captions are made in your browser and added to the call transcript.</p>
			</main>
		);
	}

	return (
		<div className="flex h-dvh flex-col bg-[#191919] text-white">
			<div className="flex min-h-0 flex-1">
				<div className={cn("grid min-h-0 flex-1 auto-rows-fr gap-2 p-3", cols)}>
					<Tile name={`${name} (you)`} muted={!micOn} videoRef={localVideo} self showVideo={camOn || sharing} />
					{remotes.map((r) => <RemoteTile key={r.id} r={r} />)}
				</div>

				{panel !== "none" && (
					<aside className="hidden w-80 shrink-0 flex-col border-l border-white/10 bg-[#202020] md:flex">
						<div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm font-semibold">
							{panel === "transcript" ? "Transcript" : "People"}
							<select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded bg-white/10 px-2 py-1 text-xs" aria-label="Caption language">
								{LANGS.map(([v, l]) => <option key={v} value={v} className="text-black">{l}</option>)}
							</select>
						</div>
						{panel === "transcript" ? (
							<div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
								{!speechOk && <p className="text-amber-300">Live captions need Chrome, Edge or Safari. Others in the call may still see your words.</p>}
								{lines.length === 0 && <p className="text-white/50">What people say appears here as they speak.</p>}
								{lines.map((l) => (<p key={l.id}><span className="font-semibold text-sauti-teal-light">{l.name}</span> <span className="text-white/90">{l.text}</span></p>))}
							</div>
						) : (
							<ul className="space-y-2 p-4 text-sm">
								<li>{name} (you)</li>
								{remotes.map((r) => <li key={r.id}>{r.name}</li>)}
							</ul>
						)}
					</aside>
				)}
			</div>

			{captionsOn && lines.length > 0 && panel !== "transcript" && (
				<p className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto w-fit max-w-[90%] rounded-lg bg-black/70 px-4 py-2 text-center text-[15px]">
					<span className="font-semibold">{lines[lines.length - 1].name}:</span> {lines[lines.length - 1].text}
				</p>
			)}

			<div className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-[#202020] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
				<Ctl on={micOn} onClick={toggleMic} label={micOn ? "Mute" : "Unmute"} icon={micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />} danger={!micOn} />
				{mode === "video" && <Ctl on={camOn} onClick={toggleCam} label={camOn ? "Camera off" : "Camera on"} icon={camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />} danger={!camOn} />}
				<Ctl on={sharing} onClick={toggleShare} label="Share screen" icon={<MonitorUp className="h-5 w-5" />} active={sharing} className="hidden sm:flex" />
				<Ctl on={captionsOn} onClick={() => setCaptionsOn((v) => !v)} label="Captions" icon={<Captions className="h-5 w-5" />} active={captionsOn} />
				<Ctl on onClick={() => setPanel((p) => (p === "transcript" ? "none" : "transcript"))} label="Transcript" icon={<span className="text-xs font-bold">TXT</span>} active={panel === "transcript"} className="hidden md:flex" />
				<Ctl on onClick={() => setPanel((p) => (p === "people" ? "none" : "people"))} label="People" icon={<Users className="h-5 w-5" />} active={panel === "people"} className="hidden md:flex" />
				<Ctl on onClick={() => { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} label="Copy link" icon={copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} />
				<button onClick={leave} aria-label="Leave" title="Leave" className="flex h-11 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold hover:bg-red-700"><PhoneOff className="h-5 w-5" /> Leave</button>
			</div>
		</div>
	);
}

function Ctl({ icon, label, onClick, on, active, danger, className }: { icon: React.ReactNode; label: string; onClick: () => void; on?: boolean; active?: boolean; danger?: boolean; className?: string }) {
	void on;
	return (
		<button onClick={onClick} aria-label={label} title={label} aria-pressed={active} className={cn("flex h-11 w-11 items-center justify-center rounded-full transition", danger ? "bg-red-600/90 hover:bg-red-600" : active ? "bg-sauti-teal" : "bg-white/10 hover:bg-white/20", className)}>
			{icon}
		</button>
	);
}

function initials(n: string) { return n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?"; }

function Tile({ name, muted, videoRef, self, showVideo }: { name: string; muted: boolean; videoRef?: React.RefObject<HTMLVideoElement | null>; self?: boolean; showVideo: boolean }) {
	return (
		<div className="relative flex min-h-[160px] items-center justify-center overflow-hidden rounded-2xl bg-[#2a2a2a]">
			<video ref={videoRef} autoPlay playsInline muted={self} className={cn("h-full w-full object-cover", self && "-scale-x-100", !showVideo && "hidden")} />
			{!showVideo && <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sauti-teal text-2xl font-semibold">{initials(name)}</span>}
			<span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs">{muted && <MicOff className="h-3 w-3" />}{name}</span>
		</div>
	);
}

function RemoteTile({ r }: { r: Remote }) {
	const ref = useRef<HTMLVideoElement>(null);
	const hasVideo = !!r.stream?.getVideoTracks().some((t) => t.readyState === "live" && !t.muted);
	useEffect(() => { if (ref.current && r.stream) ref.current.srcObject = r.stream; }, [r.stream]);
	return (
		<div className="relative flex min-h-[160px] items-center justify-center overflow-hidden rounded-2xl bg-[#2a2a2a]">
			<video ref={ref} autoPlay playsInline className={cn("h-full w-full object-cover", !hasVideo && "invisible absolute")} />
			{!hasVideo && <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#4b5563] text-2xl font-semibold">{initials(r.name)}</span>}
			{!r.stream && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-white/60" />}
			<span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs">{r.muted && <MicOff className="h-3 w-3" />}{r.name}</span>
		</div>
	);
}
