"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Captions, Check, Copy, Loader2, Mail, Mic, MicOff, Minimize2, MonitorUp, PictureInPicture2, PhoneOff, Share2, SmartphoneNfc, Users, Video, VideoOff, Volume2, VolumeX, ExternalLink } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { unwrap } from "@/lib/action-result";
import { saveTranscript, type TranscriptLine } from "@/app/actions/mjengo-meet";
import { cn } from "@/lib/utils";

type SignalKind = "offer" | "answer" | "ice";
interface Peer { id: string; name: string; companion?: boolean }
interface Remote extends Peer { stream: MediaStream | null; muted: boolean }
interface Device { id: string; label: string }

const ICE: RTCIceServer[] = [
	{ urls: "stun:stun.l.google.com:19302" },
	...(process.env.NEXT_PUBLIC_TURN_URL
		? [{ urls: process.env.NEXT_PUBLIC_TURN_URL, username: process.env.NEXT_PUBLIC_TURN_USER, credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL } as RTCIceServer]
		: []),
];

const LANGS = [["en-KE", "English (Kenya)"], ["en-US", "English (US)"], ["en-GB", "English (UK)"], ["sw-KE", "Kiswahili"]] as const;

/** A small peer-to-peer call room: preview and device choice, video or voice, companion mode, sharing, captions. */
export function MeetRoom({ code, mode, title, defaultName, canSave, embedded }: { code: string; mode: "video" | "voice"; title: string | null; defaultName: string; canSave: boolean; embedded?: boolean }) {
	const [name, setName] = useState(defaultName);
	const [joined, setJoined] = useState(false);
	const [micOn, setMicOn] = useState(true);
	const [camOn, setCamOn] = useState(mode === "video");
	const [sharing, setSharing] = useState(false);
	const [remotes, setRemotes] = useState<Remote[]>([]);
	const [captionsOn, setCaptionsOn] = useState(true);
	const [panel, setPanel] = useState<"none" | "transcript" | "people">("none");
	const [lines, setLines] = useState<TranscriptLine[]>([]);
	const [lang, setLang] = useState<string>("en-KE");
	const [copied, setCopied] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const [speechOk, setSpeechOk] = useState(true);

	// Lobby
	const [cams, setCams] = useState<Device[]>([]);
	const [mics, setMics] = useState<Device[]>([]);
	const [speakers, setSpeakers] = useState<Device[]>([]);
	const [camId, setCamId] = useState("");
	const [micId, setMicId] = useState("");
	const [speakerId, setSpeakerId] = useState("");
	const [level, setLevel] = useState(0);
	const [permission, setPermission] = useState<"asking" | "granted" | "denied">("asking");
	const [companion, setCompanion] = useState(false);
	const [speakerOn, setSpeakerOn] = useState(true);

	const camOnRef = useRef(mode === "video");
	const micOnRef = useRef(true);
	const myId = useRef(`${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`);
	const local = useRef<MediaStream | null>(null);
	const preview = useRef<MediaStream | null>(null);
	const previewVideo = useRef<HTMLVideoElement>(null);
	const localVideo = useRef<HTMLVideoElement>(null);
	const pcs = useRef(new Map<string, RTCPeerConnection>());
	const channel = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
	const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
	const savedUpTo = useRef(0);
	const linesRef = useRef<TranscriptLine[]>([]);
	linesRef.current = lines;

	const link = typeof window === "undefined" ? "" : `${window.location.origin}/meet/${code}`;
	const shownName = companion ? `${name} (phone)` : name;

	const addLine = useCallback((l: TranscriptLine) => setLines((cur) => (cur.some((x) => x.id === l.id) ? cur : [...cur, l])), []);
	const send = useCallback((event: string, payload: Record<string, unknown>) => { channel.current?.send({ type: "broadcast", event, payload }).catch(() => undefined); }, []);
	const setRemote = useCallback((id: string, patch: Partial<Remote>) => {
		setRemotes((cur) => {
			if (cur.some((r) => r.id === id)) return cur.map((r) => (r.id === id ? { ...r, ...patch } : r));
			return [...cur, { id, name: patch.name ?? "Guest", stream: patch.stream ?? null, muted: false, companion: patch.companion }];
		});
	}, []);

	/* ------------------------------------------------------------ lobby preview */

	const stopPreview = () => { preview.current?.getTracks().forEach((t) => t.stop()); preview.current = null; };
	useEffect(() => {
		if (joined) return;
		let cancelled = false;
		let ctx: AudioContext | null = null;
		let raf = 0;
		(async () => {
			stopPreview();
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: micId ? { deviceId: { exact: micId } } : true,
					video: mode === "video" ? (camId ? { deviceId: { exact: camId } } : true) : false,
				});
				if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
				preview.current = stream;
				setPermission("granted");
				if (previewVideo.current && previewVideo.current.srcObject !== stream) previewVideo.current.srcObject = stream;
				stream.getVideoTracks().forEach((t) => (t.enabled = camOnRef.current));
				stream.getAudioTracks().forEach((t) => (t.enabled = micOnRef.current));

				const all = await navigator.mediaDevices.enumerateDevices();
				const pick = (kind: MediaDeviceKind) => all.filter((d) => d.kind === kind && d.deviceId).map((d, i) => ({ id: d.deviceId, label: d.label || `${kind === "videoinput" ? "Camera" : kind === "audioinput" ? "Microphone" : "Speaker"} ${i + 1}` }));
				setCams(pick("videoinput")); setMics(pick("audioinput")); setSpeakers(pick("audiooutput"));

				// Microphone level meter, so people can tell the right mic is picked.
				ctx = new AudioContext();
				const src = ctx.createMediaStreamSource(stream);
				const an = ctx.createAnalyser();
				an.fftSize = 256;
				src.connect(an);
				const buf = new Uint8Array(an.frequencyBinCount);
				// The meter updates a few times a second, not every frame, so the preview is not redrawn constantly.
				let last = 0;
				const tick = (t: number) => {
					if (t - last > 120) {
						last = t;
						an.getByteFrequencyData(buf);
						const v = Math.round(Math.min(1, buf.reduce((a, b) => a + b, 0) / buf.length / 90) * 20) / 20;
						setLevel((cur) => (cur === v ? cur : v));
					}
					raf = requestAnimationFrame(tick);
				};
				raf = requestAnimationFrame(tick);
			} catch {
				if (!cancelled) setPermission("denied");
			}
		})();
		return () => { cancelled = true; cancelAnimationFrame(raf); ctx?.close().catch(() => undefined); };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [joined, camId, micId, mode]);

	// Turning the camera or microphone on and off only flips the track: the stream is not fetched again.
	useEffect(() => {
		camOnRef.current = camOn;
		micOnRef.current = micOn;
		preview.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
		preview.current?.getAudioTracks().forEach((t) => (t.enabled = micOn));
	}, [camOn, micOn]);

	/* ------------------------------------------------------------ connections */

	const connect = useCallback(async (peer: Peer, initiator: boolean) => {
		if (pcs.current.has(peer.id)) return;
		const pc = new RTCPeerConnection({ iceServers: ICE });
		pcs.current.set(peer.id, pc);
		setRemote(peer.id, { name: peer.name, companion: peer.companion });
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
			send("signal", { from: myId.current, to: peer.id, kind: "offer" as SignalKind, data: offer, name: shownName, companion });
		}
	}, [shownName, companion, send, setRemote]);

	const onSignal = useCallback(async (m: { from: string; to: string; kind: SignalKind; data: unknown; name?: string; companion?: boolean }) => {
		if (m.to !== myId.current) return;
		if (m.kind === "offer") {
			await connect({ id: m.from, name: m.name ?? "Guest", companion: m.companion }, false);
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
		stopPreview();
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: micId ? { deviceId: { exact: micId } } : true,
				video: mode === "video" ? (camId ? { deviceId: { exact: camId }, width: 1280, height: 720 } : { width: 1280, height: 720 }) : false,
			});
			local.current = stream;
			stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
			stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
		} catch {
			local.current = new MediaStream();
			setMicOn(false);
			setCamOn(false);
		}

		const ch = createClient().channel(`meet:${code}`, { config: { broadcast: { self: false }, presence: { key: myId.current } } });
		channel.current = ch;
		ch.on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload))
			.on("broadcast", { event: "caption" }, ({ payload }) => addLine(payload as TranscriptLine))
			.on("broadcast", { event: "state" }, ({ payload }) => setRemote(payload.id, { muted: !!payload.muted }))
			.on("presence", { event: "join" }, ({ key, newPresences }) => {
				if (key === myId.current) return;
				const p = newPresences[0] as unknown as { name?: string; companion?: boolean };
				connect({ id: key, name: p?.name ?? "Guest", companion: p?.companion }, true);
			})
			.on("presence", { event: "leave" }, ({ key }) => {
				pcs.current.get(key)?.close();
				pcs.current.delete(key);
				setRemotes((cur) => cur.filter((r) => r.id !== key));
			})
			.subscribe(async (status) => { if (status === "SUBSCRIBED") await ch.track({ name: shownName, companion }); });
		setJoined(true);
	};

	useEffect(() => { if (joined && localVideo.current && local.current) localVideo.current.srcObject = local.current; }, [joined, camOn, sharing]);

	/* ------------------------------------------------------------ captions */

	useEffect(() => {
		if (!joined || !captionsOn || !micOn || companion) return;
		type SR = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number } }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
		const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
		const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
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
		return () => { stopped = true; try { r.stop(); } catch { /* ignore */ } };
	}, [joined, captionsOn, micOn, companion, lang, name, addLine, send]);

	/* ------------------------------------------------------------ controls */

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

	const replaceVideo = async (track: MediaStreamTrack | null) => {
		for (const pc of pcs.current.values()) {
			const s = pc.getSenders().find((x) => x.track?.kind === "video") ?? pc.getTransceivers().find((t) => t.receiver.track.kind === "video")?.sender;
			if (s) await s.replaceTrack(track).catch(() => undefined);
		}
	};
	const stopShare = async () => {
		await replaceVideo(local.current?.getVideoTracks()[0] ?? null);
		if (localVideo.current && local.current) localVideo.current.srcObject = local.current;
		setSharing(false);
	};
	const toggleShare = async () => {
		if (sharing) return stopShare();
		try {
			const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
			const track = screen.getVideoTracks()[0];
			await replaceVideo(track);
			if (localVideo.current) localVideo.current.srcObject = screen;
			track.onended = () => { void stopShare(); };
			setSharing(true);
		} catch { /* cancelled */ }
	};

	/** Picture in picture: the browser's own floating video of whoever is on screen. */
	const pip = async () => {
		const el = (document.querySelector("video[data-remote='1']") as HTMLVideoElement | null) ?? localVideo.current;
		try {
			if (document.pictureInPictureElement) await document.exitPictureInPicture();
			else await el?.requestPictureInPicture();
		} catch { /* not supported or no video yet */ }
	};

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
		await persist(true);
		pcs.current.forEach((pc) => pc.close());
		pcs.current.clear();
		local.current?.getTracks().forEach((t) => t.stop());
		channel.current?.unsubscribe();
		setJoined(false);
		setRemotes([]);
		if (embedded) window.parent.postMessage({ type: "meet:left" }, window.location.origin);
	}, [persist, embedded]);

	useEffect(() => () => {
		stopPreview();
		pcs.current.forEach((pc) => pc.close());
		local.current?.getTracks().forEach((t) => t.stop());
		channel.current?.unsubscribe();
	}, []);

	const tiles = remotes.length + 1;
	const cols = tiles <= 1 ? "grid-cols-1" : tiles <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3";
	const mailto = `mailto:?subject=${encodeURIComponent(title || "Join the call")}&body=${encodeURIComponent(`Join the call: ${link}`)}`;

	/* ------------------------------------------------------------ lobby */

	if (!joined) {
		const sel = "h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-sauti-teal";
		return (
			<main className={cn("mx-auto grid max-w-4xl gap-6 px-5", embedded ? "min-h-full content-start py-4 md:grid-cols-1" : "min-h-dvh content-center py-8 md:grid-cols-[1.2fr_1fr]")}>
				<div>
					<div className="relative aspect-video overflow-hidden rounded-2xl bg-[#202020]">
						<video ref={previewVideo} autoPlay playsInline muted className={cn("h-full w-full -scale-x-100 object-cover", (!camOn || mode === "voice" || permission !== "granted") && "invisible absolute")} />
						{(!camOn || mode === "voice" || permission !== "granted") && (
							<div className="flex h-full items-center justify-center text-center text-sm text-white/70">
								{permission === "denied" ? "Allow the camera and microphone in your browser to be seen and heard. You can still listen." : mode === "voice" ? "Voice call" : "Camera is off"}
							</div>
						)}
						<div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
							<button onClick={() => setMicOn((v) => !v)} aria-label={micOn ? "Turn microphone off" : "Turn microphone on"} className={cn("flex h-11 w-11 items-center justify-center rounded-full text-white", micOn ? "bg-white/20 hover:bg-white/30" : "bg-red-600")}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
							{mode === "video" && <button onClick={() => setCamOn((v) => !v)} aria-label={camOn ? "Turn camera off" : "Turn camera on"} className={cn("flex h-11 w-11 items-center justify-center rounded-full text-white", camOn ? "bg-white/20 hover:bg-white/30" : "bg-red-600")}>{camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>}
						</div>
					</div>
					{micOn && permission === "granted" && (
						<div className="mt-3 flex items-center gap-2 text-xs text-[#787774]"><Mic className="h-3.5 w-3.5" /><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-sauti-teal transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} /></div></div>
					)}
				</div>

				<div className="space-y-4">
					<div>
						{canSave && <a href="/dashboard/mjengo/calendar" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#787774] hover:text-[#37352f]">&larr; Back to the suite</a>}
					<p className="text-sm font-medium text-[#787774]">Sauti Salama</p>
						<h1 className="mt-1 text-2xl font-semibold text-[#37352f]">{title || (mode === "voice" ? "Voice call" : "Video call")}</h1>
					</div>
					<label className="block"><span className="mb-1.5 block text-sm font-medium text-[#37352f]">Your name</span>
						<input value={name} onChange={(e) => setName(e.target.value)} placeholder="How should people see you?" className="h-11 w-full rounded-lg border border-black/10 px-3 text-[15px] outline-none focus:border-sauti-teal" />
					</label>

					{permission === "granted" && (
						<div className="space-y-2.5">
							{mode === "video" && cams.length > 0 && <label className="block text-xs font-medium text-[#787774]">Camera<select value={camId} onChange={(e) => setCamId(e.target.value)} className={sel}><option value="">Default</option>{cams.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>}
							{mics.length > 0 && <label className="block text-xs font-medium text-[#787774]">Microphone<select value={micId} onChange={(e) => setMicId(e.target.value)} className={sel}><option value="">Default</option>{mics.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>}
							{speakers.length > 0 && <label className="block text-xs font-medium text-[#787774]">Speaker<select value={speakerId} onChange={(e) => setSpeakerId(e.target.value)} className={sel}><option value="">Default</option>{speakers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>}
						</div>
					)}

					{canSave && (
						<div className="rounded-xl border border-black/10 p-3">
							<label className="flex cursor-pointer items-start gap-3">
								<input type="checkbox" checked={companion} onChange={(e) => { setCompanion(e.target.checked); if (e.target.checked) setSpeakerOn(false); }} className="mt-1 h-4 w-4 accent-[#068297]" />
								<span className="text-sm"><span className="flex items-center gap-1.5 font-medium text-[#37352f]"><SmartphoneNfc className="h-4 w-4" /> Companion mode</span><span className="block text-xs text-[#787774]">Join from this device as an extra camera and microphone for the call you are in on your computer. It is shown as your phone. Speaker stays off to avoid echo.</span></span>
							</label>
							{companion && (
								<label className="mt-2 flex items-center gap-2 pl-7 text-xs text-[#37352f]"><input type="checkbox" checked={speakerOn} onChange={(e) => setSpeakerOn(e.target.checked)} className="accent-[#068297]" /> Also play the call audio on this device</label>
							)}
						</div>
					)}

					<button onClick={join} disabled={!name.trim()} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sauti-teal text-[15px] font-semibold text-white hover:bg-sauti-dark disabled:opacity-40">
						{mode === "voice" ? <Mic className="h-5 w-5" /> : <Video className="h-5 w-5" />} {companion ? "Join as companion" : "Join now"}
					</button>
					<p className="text-xs text-[#9b9a97]">Calls go directly between people in the call. Captions are made in your browser and added to the call transcript.</p>
				</div>
			</main>
		);
	}

	/* ------------------------------------------------------------ room */

	return (
		<div className="relative flex h-dvh flex-col bg-[#191919] text-white">
			<div className="flex min-h-0 flex-1">
				<div className={cn("grid min-h-0 flex-1 auto-rows-fr gap-2 p-2 sm:p-3", cols)}>
					<div className="relative flex min-h-[120px] items-center justify-center overflow-hidden rounded-2xl bg-[#2a2a2a]">
						<video ref={localVideo} autoPlay playsInline muted className={cn("h-full w-full object-cover", !sharing && "-scale-x-100", !(camOn || sharing) && "hidden")} />
						{!(camOn || sharing) && <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sauti-teal text-xl font-semibold">{initials(shownName)}</span>}
						<span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs">{!micOn && <MicOff className="h-3 w-3" />}{shownName} (you)</span>
					</div>
					{remotes.map((r) => <RemoteTile key={r.id} r={r} sinkId={speakerId} audioOn={speakerOn} />)}
				</div>

				{panel !== "none" && !embedded && (
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
								<li>{shownName} (you)</li>
								{remotes.map((r) => <li key={r.id}>{r.name}</li>)}
							</ul>
						)}
					</aside>
				)}
			</div>

			{captionsOn && lines.length > 0 && panel !== "transcript" && (
				<p className="pointer-events-none absolute inset-x-0 bottom-20 mx-auto w-fit max-w-[92%] rounded-lg bg-black/70 px-3 py-1.5 text-center text-sm sm:text-[15px]">
					<span className="font-semibold">{lines[lines.length - 1].name}:</span> {lines[lines.length - 1].text}
				</p>
			)}

			<div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-t border-white/10 bg-[#202020] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:gap-2 sm:p-3">
				<Ctl onClick={toggleMic} label={micOn ? "Mute" : "Unmute"} icon={micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />} danger={!micOn} />
				{mode === "video" && <Ctl onClick={toggleCam} label={camOn ? "Camera off" : "Camera on"} icon={camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />} danger={!camOn} />}
				<Ctl onClick={() => setSpeakerOn((v) => !v)} label={speakerOn ? "Mute speaker" : "Unmute speaker"} icon={speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />} danger={!speakerOn} className="hidden sm:flex" />
				<Ctl onClick={toggleShare} label="Share screen" icon={<MonitorUp className="h-5 w-5" />} active={sharing} className="hidden sm:flex" />
				<Ctl onClick={() => setCaptionsOn((v) => !v)} label="Captions" icon={<Captions className="h-5 w-5" />} active={captionsOn} />
				{!embedded && <Ctl onClick={() => setPanel((p) => (p === "transcript" ? "none" : "transcript"))} label="Transcript" icon={<span className="text-xs font-bold">TXT</span>} active={panel === "transcript"} className="hidden md:flex" />}
				{!embedded && <Ctl onClick={() => setPanel((p) => (p === "people" ? "none" : "people"))} label="People" icon={<Users className="h-5 w-5" />} active={panel === "people"} className="hidden md:flex" />}
				<Ctl onClick={pip} label="Picture in picture" icon={<PictureInPicture2 className="h-5 w-5" />} className="hidden sm:flex" />
				<div className="relative">
					<Ctl onClick={() => setShareOpen((v) => !v)} label="Share the link" icon={<Share2 className="h-5 w-5" />} active={shareOpen} />
					{shareOpen && (
						<div className="absolute bottom-14 right-0 z-10 w-64 rounded-xl border border-white/10 bg-[#2a2a2a] p-2 text-sm shadow-xl">
							<p className="truncate px-2 pb-1 text-xs text-white/60">{link}</p>
							<button onClick={() => { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}</button>
							<a href={mailto} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"><Mail className="h-4 w-4" /> Send by email</a>
							<a href={`https://wa.me/?text=${encodeURIComponent(`Join the call: ${link}`)}`} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"><ExternalLink className="h-4 w-4" /> WhatsApp</a>
							{typeof navigator !== "undefined" && "share" in navigator && <button onClick={() => navigator.share({ title: title || "Call", url: link }).catch(() => undefined)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"><Share2 className="h-4 w-4" /> More options</button>}
						</div>
					)}
				</div>
				{embedded && <Ctl onClick={() => window.parent.postMessage({ type: "meet:minimize" }, window.location.origin)} label="Minimise" icon={<Minimize2 className="h-5 w-5" />} />}
				{embedded && <Ctl onClick={() => window.parent.postMessage({ type: "meet:popout" }, window.location.origin)} label="Open in its own window" icon={<ExternalLink className="h-5 w-5" />} />}
				<button onClick={leave} aria-label="Leave" title="Leave" className="flex h-11 items-center gap-2 rounded-full bg-red-600 px-4 text-sm font-semibold hover:bg-red-700"><PhoneOff className="h-5 w-5" /><span className="hidden sm:inline">Leave</span></button>
			</div>
		</div>
	);
}

function Ctl({ icon, label, onClick, active, danger, className }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; danger?: boolean; className?: string }) {
	return (
		<button onClick={onClick} aria-label={label} title={label} aria-pressed={active} className={cn("flex h-11 w-11 items-center justify-center rounded-full transition", danger ? "bg-red-600/90 hover:bg-red-600" : active ? "bg-sauti-teal" : "bg-white/10 hover:bg-white/20", className)}>
			{icon}
		</button>
	);
}

function initials(n: string) { return n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?"; }

function RemoteTile({ r, sinkId, audioOn }: { r: Remote; sinkId: string; audioOn: boolean }) {
	const ref = useRef<HTMLVideoElement>(null);
	const hasVideo = !!r.stream?.getVideoTracks().some((t) => t.readyState === "live" && !t.muted);
	useEffect(() => { if (ref.current && r.stream) ref.current.srcObject = r.stream; }, [r.stream]);
	useEffect(() => {
		const el = ref.current as (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }) | null;
		if (el?.setSinkId && sinkId) el.setSinkId(sinkId).catch(() => undefined);
	}, [sinkId]);
	return (
		<div className="relative flex min-h-[120px] items-center justify-center overflow-hidden rounded-2xl bg-[#2a2a2a]">
			<video ref={ref} data-remote="1" autoPlay playsInline muted={!audioOn} className={cn("h-full w-full object-cover", !hasVideo && "invisible absolute")} />
			{!hasVideo && <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4b5563] text-xl font-semibold">{initials(r.name)}</span>}
			{!r.stream && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-white/60" />}
			<span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs">{r.muted && <MicOff className="h-3 w-3" />}{r.name}</span>
		</div>
	);
}
