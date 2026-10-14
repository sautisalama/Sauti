"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MeetRecorder } from "@/lib/client/meet-recorder";
import { sendRecording } from "@/lib/client/remote-recording";
import { beginRemoteRecording, finishRemoteRecording } from "@/app/actions/meet-recording";
import { putToSignedUrl } from "@/lib/client/upload";
import { prepareUpload, registerUpload } from "@/app/dashboard/mjengo/vault/api";
import { attachRecording } from "@/app/actions/mjengo-meet";
import { Accessibility, Captions, Circle, ExternalLink, MoreVertical, Maximize2, ShieldCheck, UserPlus, Check, Copy, Hand, Info, Loader2, Mail, BarChart3, MessageCircle, MessageSquareText, Settings2, Mic, MicOff, Minimize2, MonitorUp, Pin, PinOff, PictureInPicture2, PhoneOff, Smile, SmartphoneNfc, UserMinus, Users, Video, VideoOff, Volume2, X } from "lucide-react";
import { makeCohost, verifyHostToken, lockMeeting, enterMeeting, checkMeetingEntry, listKnocks, decideKnock, decideAllKnocks, saveMeetingChat, type Knock } from "@/app/actions/meet-room";
import { ChatPanel, PollPanel, ReactionLayer, ReactionPicker, type ChatMsg, type FloatingReaction, type Poll } from "./meet-parts";
import { callStore } from "@/lib/client/call-store";
import { createClient } from "@/utils/supabase/client";
import { unwrap } from "@/lib/action-result";
import { saveTranscript, type TranscriptLine } from "@/app/actions/mjengo-meet";
import { cn } from "@/lib/utils";

type SignalKind = "offer" | "answer" | "ice";
interface Peer { id: string; name: string; companion?: boolean; uid?: string | null }
interface Remote extends Peer { stream: MediaStream | null; muted: boolean; sharing?: boolean; hand?: boolean; cam?: boolean; host?: boolean; handAt?: number }
interface Device { id: string; label: string }

const ICE: RTCIceServer[] = [
	{ urls: "stun:stun.l.google.com:19302" },
	...(process.env.NEXT_PUBLIC_TURN_URL
		? [{ urls: process.env.NEXT_PUBLIC_TURN_URL, username: process.env.NEXT_PUBLIC_TURN_USER, credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL } as RTCIceServer]
		: []),
];

const LANGS = [["en-KE", "English (Kenya)"], ["en-US", "English (US)"], ["en-GB", "English (UK)"], ["sw-KE", "Kiswahili"]] as const;

/** A small peer-to-peer call room: preview and device choice, video or voice, companion mode, sharing, captions. */
export function MeetRoom({ code, mode, title, defaultName, canSave, embedded, description = "", resources = [], autoJoin = false, startMic = true, startCam = true, userId = null, endsAt = null, inSuite = false }: { code: string; mode: "video" | "voice"; title: string | null; defaultName: string; canSave: boolean; embedded?: boolean; description?: string; resources?: { label: string; url: string }[]; autoJoin?: boolean; startMic?: boolean; startCam?: boolean; /** The signed-in account, which is what lets a second device join as a companion. */ userId?: string | null; /** When the scheduled meeting was due to end; only given to people who were invited. */ endsAt?: string | null; /** Hosted by the app shell: minimising keeps the call running while people use the rest of the suite. */ inSuite?: boolean }) {
	const router = useRouter();
	const [name, setName] = useState(defaultName);
	const [joined, setJoined] = useState(false);
	const [micOn, setMicOn] = useState(startMic);
	const [camOn, setCamOn] = useState(mode === "video" && startCam);
	const [sharing, setSharing] = useState(false);
	const [remotes, setRemotes] = useState<Remote[]>([]);
	const [captionsOn, setCaptionsOn] = useState(false);
	const [panel, setPanel] = useState<"none" | "transcript" | "people" | "info" | "chat" | "polls" | "settings">("none");
	const [handUp, setHandUp] = useState(false);
	const [a11yOpen, setA11yOpen] = useState(false);
	const [moreOpen, setMoreOpen] = useState(false);
	const [left, setLeft] = useState(false);
	const [recording, setRecording] = useState(false);
	const [recBy, setRecBy] = useState<string | null>(null);
	const [recSecs, setRecSecs] = useState(0);
	const [saving, setSaving] = useState(false);
	const [savePct, setSavePct] = useState<number | null>(null);
	const recorder = useRef<MeetRecorder | null>(null);
	const remotesRef = useRef<Remote[]>([]);
	const [readyOpen, setReadyOpen] = useState(false);
	const [secs, setSecs] = useState(60);
	const [a11y, setA11yState] = useState<{ size: "md" | "lg" | "xl"; contrast: boolean; reduceMotion: boolean }>({ size: "md", contrast: false, reduceMotion: false });
	const setA11y = (v: typeof a11y) => { setA11yState(v); try { localStorage.setItem("ss_meet_a11y", JSON.stringify(v)); } catch { /* ignore */ } };
	const screenStream = useRef<MediaStream | null>(null);
	const [lines, setLines] = useState<TranscriptLine[]>([]);
	const [lang, setLang] = useState<string>("en-KE");
	const [copied, setCopied] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const [speechOk, setSpeechOk] = useState(true);
	// Admission, host controls, chat, reactions and pinning.
	const [entry, setEntry] = useState<"idle" | "checking" | "waiting" | "denied">("idle");
	const [entryError, setEntryError] = useState("");
	const [isHost, setIsHost] = useState(false);
	// Ending as the host asks whether the call goes on without you.
	const [endAsk, setEndAsk] = useState(false);
	// A quiet note, only for invited people and hosts, once the scheduled time has passed.
	const [nowTick, setNowTick] = useState(() => Date.now());
	useEffect(() => { if (!endsAt) return; const t = setInterval(() => setNowTick(Date.now()), 30000); return () => clearInterval(t); }, [endsAt]);
	const [cohostToken, setCohostToken] = useState<string | null>(null);
	const canModerate = isHost || !!cohostToken;
	const [locked, setLocked] = useState(false);
	const [polls, setPolls] = useState<Poll[]>([]);
	const [noise, setNoise] = useState(true);
	const [echo, setEcho] = useState(true);
	const [knocks, setKnocks] = useState<Knock[]>([]);
	const [chat, setChat] = useState<ChatMsg[]>([]);
	const [unreadChat, setUnreadChat] = useState(0);
	const [reactOpen, setReactOpen] = useState(false);
	const [floating, setFloating] = useState<FloatingReaction[]>([]);
	const [tileReact, setTileReact] = useState<Record<string, string>>({});
	const [pinned, setPinned] = useState<string | null>(null);
	const presentAfter = useRef(false);
	const hostIds = useRef(new Set<string>());
	const chatRef = useRef<ChatMsg[]>([]);
	const chatSaved = useRef(0);
	const recent = useRef<{ emoji: string; at: number }[]>([]);
	const stateRef = useRef({ muted: !startMic, cam: mode === "video" && startCam, sharing: false, hand: false });
	chatRef.current = chat;
	const leaveRef = useRef<() => Promise<void>>(async () => undefined);
	const toggleMicRef = useRef<() => void>(() => undefined);
	const toggleCamRef = useRef<() => void>(() => undefined);
	const toggleHandRef = useRef<() => void>(() => undefined);
	const beginRef = useRef<(k: string, h: boolean, p?: boolean, t?: string) => Promise<void>>(async () => undefined);

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

	// Accessibility choices are remembered; captions themselves always start off.
	useEffect(() => { try { const v = localStorage.getItem("ss_meet_a11y"); if (v) setA11yState(JSON.parse(v)); } catch { /* defaults */ } }, []);
	const camOnRef = useRef(mode === "video");
	const micOnRef = useRef(true);
	const toggleShareRef = useRef<() => Promise<void>>(async () => undefined);
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

	remotesRef.current = remotes;

	const link = typeof window === "undefined" ? "" : `${window.location.origin}/meet/${code}`;
	const shownName = companion ? `${name} (phone)` : name;

	const addLine = useCallback((l: TranscriptLine) => setLines((cur) => (cur.some((x) => x.id === l.id) ? cur : [...cur, l])), []);
	const send = useCallback((event: string, payload: Record<string, unknown>) => { channel.current?.send({ type: "broadcast", event, payload }).catch(() => undefined); }, []);
	const setRemote = useCallback((id: string, patch: Partial<Remote>) => {
		setRemotes((cur) => {
			if (cur.some((r) => r.id === id)) return cur.map((r) => (r.id === id ? { ...r, ...patch } : r));
			return [...cur, { id, name: patch.name ?? "Guest", stream: patch.stream ?? null, muted: false, cam: true, companion: patch.companion, uid: patch.uid, host: patch.host }];
		});
	}, []);

	/** Tell everyone how this device is now (microphone, camera, presenting, hand). Late joiners get it again. */
		const pushState = useCallback((patch: Partial<typeof stateRef.current>) => {
			stateRef.current = { ...stateRef.current, ...patch };
			send("state", { id: myId.current, ...stateRef.current });
		}, [send]);

		const showReaction = useCallback((id: string, emoji: string, name: string) => {
			const now = Date.now();
			recent.current = [...recent.current.filter((r) => now - r.at < 2500), { emoji, at: now }];
			const combo = recent.current.filter((r) => r.emoji === emoji).length;
			// Every extra tap sends more, and bigger: a streak of taps fills the screen like Google Meet.
			const n = Math.min(18, 1 + (combo - 1) * 2);
			const base = Math.min(96, 34 + (combo - 1) * 7);
			const made: FloatingReaction[] = Array.from({ length: n }, (_, i) => ({
				id: `${id}-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
				emoji, name: i === 0 ? name : "", x: 8 + Math.random() * 78, size: Math.round(base * (0.8 + Math.random() * 0.5)), delay: i * 60,
			}));
			setFloating((cur) => [...cur.slice(-90), ...made]);
			setTimeout(() => setFloating((cur) => cur.filter((f) => !made.some((m) => m.id === f.id))), 3600 + n * 90);
			setTileReact((cur) => ({ ...cur, [id]: emoji }));
			setTimeout(() => setTileReact((cur) => { if (cur[id] !== emoji) return cur; const { [id]: _drop, ...rest } = cur; return rest; }), 4000);
		}, []);

	/* ------------------------------------------------------------ lobby preview */

	const stopPreview = () => { preview.current?.getTracks().forEach((t) => t.stop()); preview.current = null; };
	useEffect(() => {
		if (joined || left) return;
		let cancelled = false;
		let ctx: AudioContext | null = null;
		let raf = 0;
		(async () => {
			stopPreview();
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: micId ? { deviceId: { exact: micId }, noiseSuppression: true, echoCancellation: true, autoGainControl: true } : { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
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
	}, [joined, left, camId, micId, mode]);

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
		setRemote(peer.id, { name: peer.name, companion: peer.companion, uid: peer.uid });
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
			send("signal", { from: myId.current, to: peer.id, kind: "offer" as SignalKind, data: offer, name: shownName, companion, uid: userId });
		}
	}, [shownName, companion, userId, send, setRemote]);

	const onSignal = useCallback(async (m: { from: string; to: string; kind: SignalKind; data: unknown; name?: string; companion?: boolean; uid?: string | null }) => {
		if (m.to !== myId.current) return;
		if (m.kind === "offer") {
			await connect({ id: m.from, name: m.name ?? "Guest", companion: m.companion, uid: m.uid }, false);
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

	/** Ask the server whether this person may come in (invited people do at once; others wait to be admitted). */
	const join = async (present = false) => {
		presentAfter.current = present;
		setEntry("checking");
		setEntryError("");
		try {
			const r = await unwrap(enterMeeting(code, myId.current, name));
			if (r.status === "in") { setEntry("idle"); await begin(r.key, r.host, present, r.hostToken); }
			else if (r.status === "denied") setEntry("denied");
			else setEntry("waiting");
		} catch (e) {
			setEntry("idle");
			setEntryError(e instanceof Error ? e.message : "Could not join the call.");
		}
	};

	const begin = async (roomKeyValue: string, host: boolean, present = false, hostToken?: string) => {
		setIsHost(host);
		if (host) hostIds.current.add(myId.current);
		stopPreview();
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: micId ? { deviceId: { exact: micId }, noiseSuppression: true, echoCancellation: true, autoGainControl: true } : { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
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

		const ch = createClient().channel(`meet:${code}:${roomKeyValue}`, { config: { broadcast: { self: false }, presence: { key: myId.current } } });
		channel.current = ch;
		ch.on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload))
			.on("broadcast", { event: "caption" }, ({ payload }) => addLine(payload as TranscriptLine))
			.on("broadcast", { event: "rec" }, ({ payload }) => setRecBy(payload.on ? String(payload.by ?? "Someone") : null))
			.on("broadcast", { event: "state" }, ({ payload }) => setRemote(payload.id, { muted: !!payload.muted, sharing: !!payload.sharing, hand: !!payload.hand, cam: payload.cam !== false, handAt: payload.hand ? Date.now() : undefined }))
			.on("broadcast", { event: "pin" }, ({ payload }) => setChat((cur) => cur.map((x) => (x.id === payload.id ? { ...x, pinned: !!payload.pinned } : x))))
			.on("broadcast", { event: "chat" }, ({ payload }) => {
				const l = payload as ChatMsg;
				setChat((cur) => (cur.some((x) => x.id === l.id) ? cur : [...cur, { ...l, mine: false }]));
				setUnreadChat((n) => n + 1);
			})
			.on("broadcast", { event: "poll" }, ({ payload }) => {
				const pl = payload as { id: string; question: string; options: string[]; by: string };
				setPolls((cur) => (cur.some((x) => x.id === pl.id) ? cur : [...cur, { id: pl.id, question: String(pl.question).slice(0, 200), options: (pl.options ?? []).slice(0, 6).map((o) => String(o).slice(0, 80)), by: String(pl.by).slice(0, 60), votes: {}, open: true }]));
				setPanel("polls");
			})
			.on("broadcast", { event: "vote" }, ({ payload }) => {
				const v = payload as { id: string; voter: string; option: number };
				setPolls((cur) => cur.map((x) => (x.id === v.id && x.open ? { ...x, votes: { ...x.votes, [v.voter]: v.option } } : x)));
			})
			.on("broadcast", { event: "pollend" }, ({ payload }) => setPolls((cur) => cur.map((x) => (x.id === (payload as { id: string }).id ? { ...x, open: false } : x))))
			.on("broadcast", { event: "cohost" }, ({ payload }) => {
					const c = payload as { id: string; ht: string };
					if (String(c.ht).split(".")[1] !== String(c.id)) return;
					void unwrap(verifyHostToken(code, c.ht)).then((ok) => { if (ok) { hostIds.current.add(String(c.id)); setRemote(String(c.id), { host: true }); } }).catch(() => undefined);
				})
				.on("broadcast", { event: "react" }, ({ payload }) => showReaction(String(payload.id), String(payload.emoji).slice(0, 8), String(payload.name ?? "Someone")))
			.on("broadcast", { event: "ctl" }, ({ payload }) => {
				// Only the host's instructions are followed.
				if (!hostIds.current.has(String(payload.from))) return;
				const mine = payload.to === myId.current || payload.to === "all";
				if (!mine) return;
				if (payload.action === "mute") { micOnRef.current = false; setMicOn(false); local.current?.getAudioTracks().forEach((t) => (t.enabled = false)); pushState({ muted: true }); }
				if (payload.action === "remove" || payload.action === "end") void leaveRef.current();
					if (payload.action === "cohost" && typeof payload.token === "string" && payload.to === myId.current) { setCohostToken(payload.token); send("cohost", { id: myId.current, ht: payload.token }); }
			})
			.on("presence", { event: "join" }, ({ key, newPresences }) => {
				if (key === myId.current) return;
				const p = newPresences[0] as unknown as { name?: string; companion?: boolean; uid?: string | null; host?: boolean; ht?: string };
				// Someone who says they are the host is believed only after the server confirms it.
				if (p?.ht) void unwrap(verifyHostToken(code, p.ht)).then((ok) => { if (ok) { hostIds.current.add(key); setRemote(key, { host: true }); } }).catch(() => undefined);
				connect({ id: key, name: p?.name ?? "Guest", companion: p?.companion, uid: p?.uid }, true);
				
				// The newcomer is told how this device is now once it is listening.
				setTimeout(() => pushState({}), 900);
			})
			.on("presence", { event: "leave" }, ({ key }) => {
				hostIds.current.delete(key);
				pcs.current.get(key)?.close();
				pcs.current.delete(key);
				setRemotes((cur) => cur.filter((r) => r.id !== key));
			})
			.subscribe(async (status) => { if (status === "SUBSCRIBED") { await ch.track({ name: shownName, companion, uid: userId, host, ht: hostToken }); pushState({ muted: !micOnRef.current, cam: camOnRef.current && !!local.current?.getVideoTracks().length }); } });
		setJoined(true);
		setReadyOpen(true);
		if (present) setTimeout(() => { void toggleShareRef.current(); }, 600);
	};

	beginRef.current = begin;
	// Your own picture is never played back to you: the muted flag is set on the element itself, since React only sets it when the element is first made.
	useEffect(() => { if (joined && localVideo.current && local.current) { localVideo.current.muted = true; localVideo.current.srcObject = local.current; } }, [joined, camOn, sharing]);

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
		pushState({ muted: !next });
	};
	const toggleCam = () => {
		const next = !camOn;
		setCamOn(next);
		local.current?.getVideoTracks().forEach((t) => (t.enabled = next));
		camOnRef.current = next;
		pushState({ cam: next && !!local.current?.getVideoTracks().length });
	};

	const replaceVideo = async (track: MediaStreamTrack | null) => {
		for (const pc of pcs.current.values()) {
			const s = pc.getSenders().find((x) => x.track?.kind === "video") ?? pc.getTransceivers().find((t) => t.receiver.track.kind === "video")?.sender;
			if (s) await s.replaceTrack(track).catch(() => undefined);
		}
	};
	const stopShare = async () => {
		await replaceVideo(local.current?.getVideoTracks()[0] ?? null);
		screenStream.current?.getTracks().forEach((t) => t.stop());
		screenStream.current = null;
		if (localVideo.current && local.current) localVideo.current.srcObject = local.current;
		setSharing(false);
		pushState({ sharing: false });
	};
	const toggleHand = () => {
		const next = !handUp;
		setHandUp(next);
		pushState({ hand: next });
	};
	const toggleShare = async () => {
		toggleShareRef.current = toggleShare;
		if (sharing) return stopShare();
		try {
			const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
			const track = screen.getVideoTracks()[0];
			await replaceVideo(track);
			screenStream.current = screen;
			track.onended = () => { void stopShare(); };
			setSharing(true);
			pushState({ sharing: true });
		} catch { /* cancelled */ }
	};

	/**
	 * The call in the browser's floating window: a real window that can be dragged anywhere, even to another
	 * screen, and stays on top while people work elsewhere. The tiles move into it (they are only ever drawn in one
	 * place, so no one is heard twice) with the mic, camera and leave controls under them.
	 */
	const [pipWin, setPipWin] = useState<Window | null>(null);
	const openFloating = async (): Promise<boolean> => {
		const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow: (o: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
		if (!dpip) return false;
		try {
			const w = await dpip.requestWindow({ width: 420, height: 330 });
			for (const sheet of Array.from(document.styleSheets)) {
				try {
					const st = w.document.createElement("style");
					st.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join(String.fromCharCode(10));
					w.document.head.appendChild(st);
				} catch {
					if (sheet.href) { const l = w.document.createElement("link"); l.rel = "stylesheet"; l.href = sheet.href; w.document.head.appendChild(l); }
				}
			}
			w.document.body.style.margin = "0";
			w.document.body.className = document.body.className;
			w.addEventListener("pagehide", () => setPipWin(null));
			setPipWin(w);
			return true;
		} catch {
			return false;
		}
	};
	useEffect(() => () => { try { pipWin?.close(); } catch { /* already closed */ } }, [pipWin]);
	// The corner window shrinks to a small bar while the call is in its own window.
	useEffect(() => { if (inSuite) callStore.setPip(!!pipWin); }, [inSuite, pipWin]);

	/** The browser's own floating video of whoever is on screen (a small extra, from the more menu). */
	const popOutVideo = async () => {
		const el = (document.querySelector("video[data-remote='1']") as HTMLVideoElement | null) ?? localVideo.current;
		try {
			if (document.pictureInPictureElement) await document.exitPictureInPicture();
			else await el?.requestPictureInPicture();
		} catch { /* not supported or no video yet */ }
	};

	/**
	 * Picture in picture for the whole suite: the call becomes a small window that stays on every page, so
	 * people keep working in the other suites. Guests (no suite) get the browser's own floating video.
	 */
	const dockCall = async () => {
		if (pipWin) { pipWin.close(); return; }
		if (!inSuite) { void floatWindow(); return; }
		// The browser needs the click to open the window, so it is asked for first. The call then shrinks out of
		// the way and the page moves on: the person keeps working in the suite (and can share it) while the call
		// sits in its own window that can be dragged anywhere, even off the browser.
		const opening = openFloating();
		callStore.minimize(true);
		if (window.location.pathname.startsWith("/meet")) router.push(callStore.consumeReturn(canSave ? "/dashboard/mjengo" : "/dashboard"));
		await opening;
	};
	/** The call in its own window that can be dragged to any screen, even outside the browser. */
	const floatWindow = async () => {
		if (pipWin) { pipWin.close(); return; }
		if (!(await openFloating())) void popOutVideo();
	};

	// The shell knows the call is live (so it keeps it alive across pages) and can ask it to leave from the corner.
	useEffect(() => { if (inSuite && joined) callStore.setLive(true); }, [inSuite, joined]);
	const leaveGen = useSyncExternalStore(callStore.subscribe, callStore.leaveGeneration, () => 0);
	const firstGen = useRef(leaveGen);
	useEffect(() => {
		if (!inSuite || leaveGen === firstGen.current) return;
		firstGen.current = leaveGen;
		void leaveRef.current();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [leaveGen]);

	// Join straight away when the call was handed over from the full page or opened from the small window.
	const autoRan = useRef(false);
	useEffect(() => {
		if (!autoJoin || autoRan.current || !name.trim()) return;
		autoRan.current = true;
		void join(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoJoin]);

	// Keyboard shortcuts, as in other call apps: M microphone, V camera, H hand, C captions, R reactions, T chat.
	useEffect(() => {
		if (!joined) return;
		const onKey = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement | null;
			if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			const k = e.key.toLowerCase();
			if (k === "m") toggleMicRef.current();
			else if (k === "v") toggleCamRef.current();
			else if (k === "h") toggleHandRef.current();
			else if (k === "c") setCaptionsOn((v) => !v);
			else if (k === "r") setReactOpen((v) => !v);
			else if (k === "t") setPanel((p) => (p === "chat" ? "none" : "chat"));
			else if (k === "escape") { setReactOpen(false); setMoreOpen(false); }
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [joined]);

	/** Pin a message to the top of the chat for everyone, or take it down again; it is kept with the meeting. */
	const pinChat = (id: string, pinned: boolean) => {
		setChat((cur) => cur.map((x) => (x.id === id ? { ...x, pinned } : x)));
		send("pin", { id, pinned });
		const l = chatRef.current.find((x) => x.id === id);
		if (l) void unwrap(saveMeetingChat(code, [{ id: l.id, name: l.name, text: l.text, at: l.at, pinned }])).catch(() => undefined);
	};
	const sendChat = (text: string) => {
		const line: ChatMsg = { id: `${myId.current}-${Date.now()}`, name: shownName, text: text.slice(0, 1000), at: new Date().toISOString(), mine: true };
		setChat((cur) => [...cur, line]);
		send("chat", { ...line, mine: false });
	};
	const askPoll = (question: string, options: string[]) => {
		const id = `${myId.current}-${Date.now()}`;
		setPolls((cur) => [...cur, { id, question, options, by: "You", votes: {}, open: true }]);
		send("poll", { id, question, options, by: shownName });
	};
	const votePoll = (id: string, option: number) => {
		setPolls((cur) => cur.map((x) => (x.id === id && x.open ? { ...x, votes: { ...x.votes, [myId.current]: option } } : x)));
		send("vote", { id, voter: myId.current, option });
	};
	const endPoll = (id: string) => {
		setPolls((cur) => cur.map((x) => (x.id === id ? { ...x, open: false } : x)));
		send("pollend", { id });
	};

	/** Change microphone or camera while in the call: the new track replaces the old one on every connection. */
	const switchDevice = async (kind: "audio" | "video", deviceId: string) => {
		try {
			const fresh = await navigator.mediaDevices.getUserMedia(kind === "audio"
				? { audio: { deviceId: { exact: deviceId }, noiseSuppression: noise, echoCancellation: echo, autoGainControl: true } }
				: { video: { deviceId: { exact: deviceId }, width: 1280, height: 720 } });
			const track = (kind === "audio" ? fresh.getAudioTracks() : fresh.getVideoTracks())[0];
			if (!track || !local.current) return;
			const old = (kind === "audio" ? local.current.getAudioTracks() : local.current.getVideoTracks())[0];
			track.enabled = kind === "audio" ? micOnRef.current : camOnRef.current;
			for (const pc of pcs.current.values()) {
				const sender = pc.getSenders().find((x) => x.track?.kind === kind);
				if (sender && !(kind === "video" && sharing)) await sender.replaceTrack(track).catch(() => undefined);
			}
			if (old) { local.current.removeTrack(old); old.stop(); }
			local.current.addTrack(track);
			if (kind === "audio") setMicId(deviceId); else setCamId(deviceId);
			if (localVideo.current) localVideo.current.srcObject = local.current;
		} catch { /* the old device stays in use */ }
	};
	const applyAudioProcessing = async (next: { noiseSuppression?: boolean; echoCancellation?: boolean }) => {
		const t = local.current?.getAudioTracks()[0];
		await t?.applyConstraints({ noiseSuppression: next.noiseSuppression ?? noise, echoCancellation: next.echoCancellation ?? echo, autoGainControl: true }).catch(() => undefined);
	};

	const react = (emoji: string) => {
		showReaction("me", emoji, shownName);
		send("react", { id: myId.current, emoji, name: shownName });
	};
	useEffect(() => { if (panel === "chat") setUnreadChat(0); }, [panel, chat.length]);

	// People waiting to come in are shown to everyone who may let them in.
	useEffect(() => {
		if (!joined) return;
		let on = true;
		const poll = () => { if (document.hidden) return; unwrap(listKnocks(code, cohostToken)).then((k) => on && setKnocks(k)).catch(() => undefined); };
		poll();
		const t = setInterval(poll, 3500);
		return () => { on = false; clearInterval(t); };
			}, [joined, code, cohostToken]);
	const addCohost = (peerId: string) => { void unwrap(makeCohost(code, peerId)).then((token) => { send("ctl", { from: myId.current, to: peerId, action: "cohost", token }); setRemote(peerId, { host: true }); hostIds.current.add(peerId); }).catch(() => undefined); };
	const hostCtl = (to: string, action: "mute" | "remove" | "end") => send("ctl", { from: myId.current, to, action });
	const decide = (k: Knock, admit: boolean) => {
		setKnocks((cur) => cur.filter((x) => x.guestKey !== k.guestKey));
		void unwrap(decideKnock(code, k.guestKey, admit, cohostToken)).catch(() => undefined);
	};
	const decideAll = (admit: boolean) => { setKnocks([]); void unwrap(decideAllKnocks(code, admit, cohostToken)).catch(() => undefined); };

	// A guest in the waiting room checks every few seconds whether they have been let in.
	useEffect(() => {
		if (entry !== "waiting") return;
		let on = true;
		const t = setInterval(async () => {
			try {
				const r = await unwrap(checkMeetingEntry(code, myId.current));
				if (!on) return;
				if (r.status === "in") { setEntry("idle"); await beginRef.current(r.key, false, presentAfter.current); }
				else if (r.status === "denied") setEntry("denied");
			} catch { /* try again */ }
		}, 2500);
		return () => { on = false; clearInterval(t); };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entry, code]);

	// Keep the messages with the meeting.
	useEffect(() => {
		if (!joined || !canSave) return;
		const t = setInterval(() => {
			const fresh = chatRef.current.slice(chatSaved.current);
			if (!fresh.length) return;
			chatSaved.current = chatRef.current.length;
			void unwrap(saveMeetingChat(code, fresh.map(({ id, name, text, at }) => ({ id, name, text, at })))).catch(() => { chatSaved.current = Math.max(0, chatSaved.current - fresh.length); });
		}, 20_000);
		return () => clearInterval(t);
	}, [joined, canSave, code]);

	toggleMicRef.current = toggleMic;
	toggleCamRef.current = toggleCam;
	toggleHandRef.current = toggleHand;

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

	const home = canSave ? "/meet" : "/";
	useEffect(() => {
		if (!left) return;
		if (secs <= 0) { window.location.assign(home); return; }
		const t = setTimeout(() => setSecs((n) => n - 1), 1000);
		return () => clearTimeout(t);
	}, [left, secs, home]);

	/** Finish the recording: keep it in Files and attach it to this meeting. */
	const stopRecording = useCallback(async () => {
		const r = recorder.current;
		if (!r) return;
		recorder.current = null;
		setRecording(false);
		send("rec", { on: false, by: name });
		setSaving(true);
		try {
			const blob = await r.stop();
			if (blob.size < 2000) throw new Error("Nothing was recorded.");
			const label = (title || code).replace(/[\\/:*?"<>|]+/g, " ").trim();
			const file = `Recording ${label} ${format(new Date(), "yyyy-MM-dd HHmm")}.webm`;
							let stored = false;
				try {
					const begun = await unwrap(beginRemoteRecording(code));
					await sendRecording(begun.put, blob, (p) => setSavePct(p));
					await unwrap(finishRemoteRecording(code, begun.name, blob.size));
					stored = true;
				} catch { /* the storage host is not set up or not reachable: Files is used */ }
				if (stored) return;
				try {
					const { path, signedUrl } = await prepareUpload(null, file, blob.size);
				await putToSignedUrl(signedUrl, new File([blob], file, { type: blob.type }));
				const created = await registerUpload(null, path, file, blob.size, blob.type || "video/webm");
				await unwrap(attachRecording(code, created.id));
			} catch {
				// Could not reach Files: hand the recording over so it is not lost.
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url; a.download = file; a.click();
				setTimeout(() => URL.revokeObjectURL(url), 30_000);
			}
		} catch {
			/* nothing to keep */
		} finally {
			setSaving(false);
			setSavePct(null);
		}
	}, [code, name, send, title]);

	const startRecording = () => {
		if (recorder.current || !canSave) return;
		const r = new MeetRecorder({
			title: title || code,
			streams: () => [...(local.current ? [local.current] : []), ...remotesRef.current.flatMap((x) => (x.stream ? [x.stream] : []))],
			videos: () => Array.from(document.querySelectorAll<HTMLVideoElement>("video[data-rec-video]")),
		});
		try { r.start(); } catch { return; }
		recorder.current = r;
		setRecording(true);
		setRecSecs(0);
		send("rec", { on: true, by: name || "Someone" });
	};
	useEffect(() => {
		if (!recording) return;
		const t = setInterval(() => setRecSecs((n) => n + 1), 1000);
		return () => clearInterval(t);
	}, [recording]);

	const leave = useCallback(async () => {
		// Everything that holds the camera, the microphone or the screen is let go first.
		await persist(true);
		if (recorder.current) await stopRecording();
		stopPreview();
		screenStream.current?.getTracks().forEach((t) => t.stop());
		screenStream.current = null;
		pcs.current.forEach((pc) => pc.close());
		pcs.current.clear();
		local.current?.getTracks().forEach((t) => t.stop());
		local.current = null;
		channel.current?.unsubscribe();
		setJoined(false);
		setRemotes([]);
		setReadyOpen(false);
		if (inSuite) {
			callStore.close();
			// From the corner of another page the person stays where they are; from the call page they go back.
			if (window.location.pathname.startsWith("/meet")) router.push(home);
			return;
		}
		// Straight back to Meet: no second screen to dismiss, and no camera left on.
		window.location.assign(home);
	}, [persist, inSuite, router, home, stopRecording]);

	leaveRef.current = leave;
	useEffect(() => () => {
		stopPreview();
		pcs.current.forEach((pc) => pc.close());
		local.current?.getTracks().forEach((t) => t.stop());
		channel.current?.unsubscribe();
	}, []);

	// A companion is the same person on a second device: it is only drawn while it presents or shows a camera.
	const showsVideo = (r: Remote) => r.cam !== false && !!r.stream?.getVideoTracks().some((t) => t.readyState === "live" && !t.muted);
	const visible = remotes.filter((r) => !r.companion || r.sharing || showsVideo(r));
	const myCompanion = remotes.find((r) => r.companion && !!userId && r.uid === userId) ?? null;
	const handOrder = remotes.filter((r) => r.hand).sort((a, b) => (a.handAt ?? 0) - (b.handAt ?? 0));
	const tile = (r: Remote) => (
		<RemoteTile key={r.id} r={r} sinkId={speakerId} audioOn={speakerOn} reaction={tileReact[r.id]} pinned={pinned === r.id} onPin={() => setPinned((p) => (p === r.id ? null : r.id))} />
	);
	const tiles = visible.length + 1;
	const cols = tiles <= 1 ? "grid-cols-1" : tiles <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3";
	const mailto = `mailto:?subject=${encodeURIComponent(title || "Join the call")}&body=${encodeURIComponent(`Join the call: ${link}`)}`;

	/* ------------------------------------------------------------ lobby */

	if (left && !joined) {
		return (
			<main className="flex min-h-dvh flex-col bg-white text-[#202124]">
				<header className="flex items-center gap-3 px-5 pt-5">
					<span className="relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#068297] text-sm" aria-hidden>{secs}</span>
					<span className="text-sm text-[#5f6368]">Returning to home screen</span>
				</header>
				<div className="mx-auto mt-10 flex w-full max-w-xl flex-1 flex-col items-center px-5 text-center">
					<h1 className="text-3xl font-normal sm:text-4xl">You left the meeting</h1>
					<div className="mt-8 flex flex-wrap justify-center gap-3">
						<button onClick={() => setLeft(false)} className="h-11 rounded-full border border-[#dadce0] px-6 text-sm font-medium text-[#068297] hover:bg-[#f1fafb]">Rejoin</button>
						<a href={`/meet/${code}/notes`} className="flex h-11 items-center rounded-full border border-[#dadce0] px-6 text-sm font-medium text-[#068297] hover:bg-[#f1fafb]">Call notes</a>
						<button onClick={() => window.location.assign(home)} className="h-11 rounded-full bg-[#068297] px-6 text-sm font-medium text-white hover:bg-[#056d7e]">Return to home screen</button>
					</div>
					<div className="mt-12 flex w-full items-start gap-4 rounded-lg border border-[#dadce0] bg-[#f8f9fc] p-5 text-left">
						<span className="mt-0.5 text-[#068297]"><ShieldCheck className="h-8 w-8" /></span>
						<span><span className="block text-lg">Your meeting is safe</span><span className="block text-sm text-[#5f6368]">No one can join a meeting unless invited or admitted by the host</span></span>
					</div>
				</div>
			</main>
		);
	}

	if (!joined && (entry === "waiting" || entry === "denied")) {
		return (
			<main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center text-[#202124]">
				{entry === "waiting" ? (
					<>
						<span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#e0f2f5]"><Loader2 className="h-9 w-9 animate-spin text-[#068297]" /></span>
						<h1 className="text-2xl font-medium sm:text-3xl">Asking to join…</h1>
						<p className="mt-2 max-w-sm text-sm text-[#5f6368]">You will be let in as soon as someone in the call admits you. You can leave this screen open.</p>
						<p className="mt-6 text-sm font-medium">{title || code}</p>
						<p className="text-xs text-[#5f6368]">Joining as {name}</p>
						<button onClick={() => setEntry("idle")} className="mt-8 h-11 rounded-full border border-[#dadce0] px-6 text-sm font-medium text-[#068297] hover:bg-[#f1fafb]">Cancel</button>
					</>
				) : (
					<>
						<span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#fce8e6]"><ShieldCheck className="h-9 w-9 text-[#d93025]" /></span>
						<h1 className="text-2xl font-medium sm:text-3xl">You can&apos;t join this call</h1>
						<p className="mt-2 max-w-sm text-sm text-[#5f6368]">Your request to join was declined.</p>
						<div className="mt-8 flex gap-3">
							<button onClick={() => setEntry("idle")} className="h-11 rounded-full border border-[#dadce0] px-6 text-sm font-medium text-[#068297] hover:bg-[#f1fafb]">Back</button>
							<button onClick={() => window.location.assign(home)} className="h-11 rounded-full bg-[#068297] px-6 text-sm font-medium text-white">Return to home screen</button>
						</div>
					</>
				)}
			</main>
		);
	}

	if (!joined) {
		const chip = "flex h-9 max-w-[220px] items-center gap-2 rounded-full border border-[#dadce0] bg-white px-3 text-sm text-[#1B232B]";
		return (
			<main className={cn("text-[#0b2228]", embedded ? "fixed inset-0 z-[100] overflow-y-auto bg-white p-4" : "")}><div className="mx-auto grid w-full max-w-[1100px] gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] lg:items-start">
				<div>
					<div className="relative aspect-video overflow-hidden rounded-2xl bg-[#0E1318] shadow-[0_1px_2px_rgba(16,24,40,0.08)]">
						<video ref={previewVideo} autoPlay playsInline muted className={cn("h-full w-full -scale-x-100 object-cover", (!camOn || permission !== "granted") && "invisible absolute")} />
						{(!camOn || permission !== "granted") && (
							<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
								{permission === "denied" ? <p className="text-sm">Allow the camera and microphone in your browser to be seen and heard. You can still listen.</p> : (
									<>
										<span className="flex h-24 w-24 items-center justify-center rounded-full bg-sauti-teal text-3xl font-medium">{initials(name || "You")}</span>
										<p className="text-sm sm:text-lg max-sm:mb-12">Camera is off</p>
									</>
								)}
							</div>
						)}
						<span className="absolute left-4 top-3 text-sm font-medium text-white drop-shadow">{name || "You"}</span>
						<div className="absolute inset-x-0 bottom-4 flex justify-center gap-4">
							<button onClick={() => setMicOn((v) => !v)} aria-label={micOn ? "Turn off microphone" : "Turn on microphone"} className={cn("flex h-12 w-12 items-center justify-center rounded-full border text-white transition", micOn ? "border-white/60 bg-transparent hover:bg-white/15" : "border-transparent bg-[#ea4335]")}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
							<button onClick={() => setCamOn((v) => !v)} aria-label={camOn ? "Turn off camera" : "Turn on camera"} className={cn("flex h-12 w-12 items-center justify-center rounded-full border text-white transition", camOn ? "border-white/60 bg-transparent hover:bg-white/15" : "border-transparent bg-[#ea4335]")}>{camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>
						</div>
					</div>
					{micOn && permission === "granted" && (
						<div className="mt-3 flex items-center gap-2 text-xs text-[#5f6368]"><Mic className="h-3.5 w-3.5" /><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8eaed]"><div className="h-full rounded-full bg-[#068297] transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} /></div></div>
					)}
					{permission === "granted" && (
						<div className="mt-3 flex flex-wrap gap-2">
							{mics.length > 0 && <label className={chip}><Mic className="h-4 w-4 shrink-0" /><select aria-label="Microphone" value={micId} onChange={(e) => setMicId(e.target.value)} className="min-w-0 bg-transparent outline-none"><option value="">Default microphone</option>{mics.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>}
							{speakers.length > 0 && <label className={chip}><Volume2 className="h-4 w-4 shrink-0" /><select aria-label="Speaker" value={speakerId} onChange={(e) => setSpeakerId(e.target.value)} className="min-w-0 bg-transparent outline-none"><option value="">Default speaker</option>{speakers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>}
							{cams.length > 0 && <label className={chip}><Video className="h-4 w-4 shrink-0" /><select aria-label="Camera" value={camId} onChange={(e) => setCamId(e.target.value)} className="min-w-0 bg-transparent outline-none"><option value="">Default camera</option>{cams.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>}
						</div>
					)}
				</div>

				<div className="flex flex-col items-center gap-5 rounded-2xl border border-serene-neutral-200/70 bg-white p-5 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:items-start lg:text-left">
					{canSave && <a href="/dashboard/mjengo/calendar" className="text-xs font-medium text-[#5f6368] hover:text-[#202124]">&larr; Back to Sauti Salama</a>}
					<div>
						<h1 className="text-2xl font-bold leading-tight tracking-tight text-sauti-dark">{title || "Ready to join?"}</h1>
						<p className="mt-1 text-sm text-[#5f6368]">{remotes.length ? "Others are in the call" : "Check how you look and sound, then join"}</p>
					</div>
					<label className="w-full max-w-sm text-left">
						<span className="mb-1 block text-xs font-medium text-[#5f6368]">Your name</span>
						<input value={name} onChange={(e) => setName(e.target.value)} placeholder="How should people see you?" className="h-12 w-full rounded-lg border border-[#dadce0] px-3 text-base outline-none focus:border-[#068297] focus:ring-1 focus:ring-[#068297]" />
					</label>
					<div className="flex flex-wrap justify-center gap-3 lg:justify-start">
						<button onClick={() => join(false)} disabled={!name.trim() || entry === "checking"} className="h-12 rounded-full bg-[#068297] px-7 text-sm font-medium text-white shadow-sm hover:bg-[#056d7e] disabled:opacity-40">{entry === "checking" ? "Joining…" : companion ? "Join as companion" : "Join now"}</button>
						<button onClick={() => join(true)} disabled={!name.trim() || entry === "checking"} className="flex h-12 items-center gap-2 rounded-full border border-[#dadce0] px-6 text-sm font-medium text-[#068297] hover:bg-[#f1fafb] disabled:opacity-40"><MonitorUp className="h-4 w-4" /> Present</button>
					</div>
					{entryError && <p role="alert" className="max-w-sm text-sm text-[#d93025]">{entryError}</p>}
						{userId ? (
							<label className="flex max-w-sm cursor-pointer items-start gap-3 text-left">
								<input type="checkbox" checked={companion} onChange={(e) => { setCompanion(e.target.checked); if (e.target.checked) { setSpeakerOn(false); setMicOn(false); } else setMicOn(true); }} className="mt-1 h-4 w-4 accent-[#068297]" />
								<span className="text-sm"><span className="flex items-center gap-1.5 font-medium"><SmartphoneNfc className="h-4 w-4" /> Use this device as a companion</span><span className="block text-xs text-[#5f6368]">Your microphone and speaker stay on the device you joined with. Use this one to see what is presented, present your screen, show a camera, chat and react. It shows to others as you, not as a second person.</span></span>
							</label>
						) : (
							<p className="flex max-w-sm items-start gap-3 text-left text-xs text-[#5f6368]"><SmartphoneNfc className="mt-0.5 h-4 w-4 shrink-0" /> Sign in on this device and on your main device with the same account to use one of them as a companion.</p>
						)}
					<p className="max-w-sm text-xs text-[#5f6368]">Captions and accessibility tools are off until you turn them on inside the call. Calls go directly between people in the call.</p>
				</div>
			</div></main>
		);
	}

	/* ------------------------------------------------------------ room */

	// The presented screen, if anyone is presenting, takes the stage.
	const presenter = sharing ? { id: "me", name: `${shownName} (you)`, stream: null as MediaStream | null } : remotes.find((r) => r.sharing) ?? null;
	const capSize = a11y.size === "xl" ? "text-2xl" : a11y.size === "lg" ? "text-xl" : "text-base";
	const clock = format(new Date(), "h:mm a");

	const selfTile = (
		<div className="group relative flex h-full min-h-[110px] w-full items-center justify-center overflow-hidden rounded-xl bg-[#1B232B] max-md:min-h-0">
			<video ref={localVideo} data-rec-video="1" autoPlay playsInline muted className={cn("h-full w-full object-cover", !sharing && "-scale-x-100", !(camOn || sharing) && "hidden")} />
			{!(camOn || sharing) && <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sauti-teal text-xl font-medium">{initials(shownName)}</span>}
			{!(camOn || sharing) && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs"><VideoOff className="h-3 w-3" /> Camera off</span>}
			{tileReact.me && <span className="absolute right-2 bottom-2 text-3xl drop-shadow">{tileReact.me}</span>}
			<button onClick={() => setPinned((p) => (p === "me" ? null : "me"))} aria-label={pinned === "me" ? "Unpin" : "Pin yourself"} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 opacity-0 transition hover:bg-black/70 focus:opacity-100 group-hover:opacity-100">{pinned === "me" ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button>
			<span className="absolute bottom-2 left-3 flex items-center gap-1.5 text-sm font-medium text-white drop-shadow">{!micOn && <MicOff className="h-3.5 w-3.5" />}{shownName} (you)</span>
			{handUp && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#068297]"><Hand className="h-4 w-4" /></span>}
		</div>
	);

	return (
		<div className={cn("fixed inset-0 z-[100] flex h-dvh flex-col bg-[#0E1318] text-white", a11y.reduceMotion && "[&_*]:!transition-none [&_*]:!animate-none")}>
			<ReactionLayer items={floating} />
			{reactOpen && <div className="md:hidden"><div className="fixed inset-0 z-30" onClick={() => setReactOpen(false)} /><div className="fixed inset-x-0 bottom-20 z-40 flex justify-center"><div className="relative"><ReactionPicker onPick={react} onClose={() => setReactOpen(false)} /></div></div></div>}
			{knocks.length > 0 && (
				<div role="alert" className="absolute left-1/2 top-14 z-40 w-[min(92vw,24rem)] -translate-x-1/2 space-y-2 rounded-2xl bg-white p-3 text-[#202124] shadow-2xl">
					<p className="px-1 text-sm font-medium">{knocks.length === 1 ? "Someone wants to join" : `${knocks.length} people want to join`}</p>
					{knocks.slice(0, 4).map((k) => (
						<div key={k.guestKey} className="flex items-center gap-2">
							<span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5f6368] text-xs text-white">{initials(k.name)}</span>
							<span className="min-w-0 flex-1 truncate text-sm">{k.name}</span>
							<button onClick={() => decide(k, false)} className="h-8 rounded-full px-3 text-sm font-medium text-[#5f6368] hover:bg-black/5">Deny</button>
							<button onClick={() => decide(k, true)} className="h-8 rounded-full bg-[#068297] px-3.5 text-sm font-medium text-white hover:bg-[#056d7e]">Admit</button>
						</div>
					))}
					{knocks.length > 1 && <button onClick={() => decideAll(true)} className="w-full rounded-full border border-[#dadce0] py-1.5 text-sm font-medium text-[#068297] hover:bg-[#f1fafb]">Admit all</button>}
				</div>
			)}
			{(recording || recBy || saving) && (
				<div role="status" className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur">
					<span className={cn("h-2 w-2 rounded-full", saving ? "bg-amber-400" : "animate-pulse bg-[#ea4335]")} />
					{saving ? `Saving the recording${savePct !== null ? ` ${savePct}%` : ""}` : recording ? `Recording ${String(Math.floor(recSecs / 60)).padStart(2, "0")}:${String(recSecs % 60).padStart(2, "0")}` : `${recBy} is recording this meeting`}
				</div>
			)}
			<div className="hidden shrink-0 items-center gap-3 px-5 pt-3 text-base md:flex">
				<span className="font-medium">{clock}</span>
				<span className="text-white/40">|</span>
				<span className="font-medium">{code}</span>
					{companion && <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs"><SmartphoneNfc className="h-3.5 w-3.5" /> Companion: sound stays on your main device</span>}
					{!companion && myCompanion && <span className="flex items-center gap-1.5 rounded-full bg-[#068297]/30 px-2.5 py-1 text-xs"><SmartphoneNfc className="h-3.5 w-3.5" /> Your companion device is connected</span>}
				<button onClick={() => setPanel((p) => (p === "info" ? "none" : "info"))} aria-label="Meeting details" className="text-white/70 hover:text-white"><Info className="h-4 w-4" /></button>
				<span className="flex-1" />
				<button onClick={() => setPanel((p) => (p === "people" ? "none" : "people"))} aria-label="People" className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-sm hover:bg-white/20"><Users className="h-4 w-4" />{remotes.length + 1}</button>
			</div>
			{endsAt && nowTick > new Date(endsAt).getTime() && (
				<div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-3" role="status">
					<span className="rounded-full bg-black/55 px-3 py-1 text-xs text-white/90 backdrop-blur">This meeting was scheduled to end at {format(new Date(endsAt), "h:mm a")} ({Math.max(1, Math.round((nowTick - new Date(endsAt).getTime()) / 60000))} min ago)</span>
				</div>
			)}
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))] text-sm md:hidden">
				<span className="min-w-0 flex-1 truncate font-medium">{title || code}</span>
				<span className="text-white/70">{clock}</span>
			</div>
			<div className="flex min-h-0 flex-1">
				<div className="min-h-0 min-w-0 flex-1 p-3 max-md:p-1.5">
					{pipWin ? (
						<div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl bg-[#2a2a2a] text-center">
							<PictureInPicture2 className="h-8 w-8 text-white/70" />
							<p className="text-sm text-white/80">The call is in a floating window.<br />Drag it anywhere, even to another screen.</p>
							<button onClick={() => pipWin.close()} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-[#202124] hover:bg-white/90">Bring the call back here</button>
						</div>
					) : presenter ? (
						<div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
							<div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
								{presenter.id === "me" ? (
									<>
										<ScreenPreview stream={screenStream.current} />
										<span className="absolute left-3 top-3 rounded-md bg-black/60 px-2.5 py-1 text-sm">You are presenting to everyone</span>
										<button onClick={stopShare} className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#ea4335] px-5 py-2 text-sm font-medium hover:bg-[#d93025]">Stop presenting</button>
									</>
								) : (
									<>
										<StreamVideo stream={(presenter as Remote).stream} className="h-full w-full object-contain" />
										<span className="absolute left-3 top-3 rounded-md bg-black/60 px-2.5 py-1 text-sm">{presenter.name} is presenting</span>
									</>
								)}
							</div>
							<div className="flex shrink-0 gap-2 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-y-auto">
								<div className="h-28 w-44 shrink-0 lg:h-32 lg:w-full">{selfTile}</div>
								{visible.filter((r) => r.id !== presenter.id).map((r) => <div key={r.id} className="h-28 w-44 shrink-0 lg:h-32 lg:w-full">{tile(r)}</div>)}
							</div>
						</div>
											) : pinned && (pinned === "me" || visible.some((r) => r.id === pinned)) ? (
							<div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
								<div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl">{pinned === "me" ? selfTile : tile(visible.find((r) => r.id === pinned)!)}</div>
								<div className="flex shrink-0 gap-2 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-y-auto">
									{pinned !== "me" && <div className="h-28 w-44 shrink-0 lg:h-32 lg:w-full">{selfTile}</div>}
									{visible.filter((r) => r.id !== pinned).map((r) => <div key={r.id} className="h-28 w-44 shrink-0 lg:h-32 lg:w-full">{tile(r)}</div>)}
								</div>
							</div>
						) : (
							<div className={cn("grid h-full min-h-0 auto-rows-fr gap-3", cols, visible.length > 0 && "max-md:grid-cols-1 max-md:gap-1.5")}>
							<div className={cn("min-h-0", visible.length > 0 && "max-md:fixed max-md:bottom-24 max-md:right-3 max-md:z-20 max-md:h-36 max-md:w-24 max-md:overflow-hidden max-md:rounded-xl max-md:shadow-xl max-md:ring-1 max-md:ring-white/20")}>{selfTile}</div>
							{visible.map((r) => tile(r))}
						</div>
					)}
				</div>

				{panel !== "none" && !embedded && (
					<aside className="fixed inset-x-0 bottom-0 z-40 flex h-[70dvh] flex-col overflow-hidden rounded-t-2xl bg-white text-[#202124] shadow-2xl md:static md:m-3 md:ml-0 md:h-auto md:w-80 md:shrink-0 md:rounded-xl md:shadow-none">
						<div className="flex items-center justify-between border-b border-[#dadce0] px-4 py-3 text-base">
							{panel === "transcript" ? "Transcript" : panel === "info" ? "Meeting details" : panel === "chat" ? "Messages" : panel === "polls" ? "Polls" : panel === "settings" ? "Call settings" : "People"}
							<button onClick={() => setPanel("none")} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"><X className="h-4 w-4" /></button>
						</div>
													{panel === "chat" && <ChatPanel lines={chat} onSend={sendChat} onPin={pinChat} />}
							{panel === "polls" && <PollPanel polls={polls} me={myId.current} onCreate={askPoll} onVote={votePoll} onClose={endPoll} />}
							{panel === "settings" && (
								<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
									<label className="block"><span className="mb-1 block text-xs text-[#5f6368]">Microphone</span>
										<select value={micId} onChange={(e) => void switchDevice("audio", e.target.value)} className="h-10 w-full rounded-lg border border-[#dadce0] bg-white px-2"><option value="">Default microphone</option>{mics.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
									<label className="block"><span className="mb-1 block text-xs text-[#5f6368]">Camera</span>
										<select value={camId} onChange={(e) => void switchDevice("video", e.target.value)} className="h-10 w-full rounded-lg border border-[#dadce0] bg-white px-2"><option value="">Default camera</option>{cams.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
									<label className="block"><span className="mb-1 block text-xs text-[#5f6368]">Speaker</span>
										<select value={speakerId} onChange={(e) => setSpeakerId(e.target.value)} className="h-10 w-full rounded-lg border border-[#dadce0] bg-white px-2"><option value="">Default speaker</option>{speakers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
									<label className="flex items-center justify-between gap-3"><span>Reduce background noise</span><input type="checkbox" checked={noise} onChange={(e) => { setNoise(e.target.checked); void applyAudioProcessing({ noiseSuppression: e.target.checked }); }} className="h-4 w-4 accent-[#068297]" /></label>
									<label className="flex items-center justify-between gap-3"><span>Echo cancellation</span><input type="checkbox" checked={echo} onChange={(e) => { setEcho(e.target.checked); void applyAudioProcessing({ echoCancellation: e.target.checked }); }} className="h-4 w-4 accent-[#068297]" /></label>
									<label className="flex items-center justify-between gap-3"><span>Play call sound</span><input type="checkbox" checked={speakerOn} onChange={(e) => setSpeakerOn(e.target.checked)} className="h-4 w-4 accent-[#068297]" /></label>
								</div>
							)}
							{panel === "transcript" && (
								<div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
								{!speechOk && <p className="text-amber-700">Live captions need Chrome, Edge or Safari. Others in the call may still see your words.</p>}
								{lines.length === 0 && <p className="text-[#5f6368]">{captionsOn ? "What people say appears here as they speak." : "Captions are off, so nothing is being transcribed on this device. Turn them on in the bar below."}</p>}
								{lines.map((l) => (<p key={l.id}><span className="font-medium text-[#068297]">{l.name}</span> <span>{l.text}</span></p>))}
							</div>
						)}
						{panel === "people" && (
								<div className="min-h-0 flex-1 overflow-y-auto">
									{canModerate && (
										<div className="flex flex-wrap items-center gap-2 border-b border-[#e8eaed] px-4 py-2 text-xs">
											<span className="mr-auto text-[#5f6368]">{isHost ? "You are the host" : "You are a co-host"}</span>
											{isHost && <button onClick={() => { const next = !locked; setLocked(next); void unwrap(lockMeeting(code, next)).catch(() => setLocked(!next)); }} aria-pressed={locked} className={cn("rounded-full border px-3 py-1 font-medium", locked ? "border-[#068297] bg-[#e0f2f5] text-[#068297]" : "border-[#dadce0] text-[#5f6368] hover:bg-[#f1fafb]")}>{locked ? "Call is locked" : "Lock the call"}</button>}
											{remotes.length > 0 && <button onClick={() => hostCtl("all", "mute")} className="rounded-full border border-[#dadce0] px-3 py-1 font-medium text-[#068297] hover:bg-[#f1fafb]">Mute everyone</button>}
											{remotes.length > 0 && <button onClick={() => { hostCtl("all", "end"); setTimeout(() => void leaveRef.current(), 400); }} className="rounded-full bg-[#fce8e6] px-3 py-1 font-medium text-[#d93025] hover:bg-[#f9d6d2]">End for everyone</button>}
										</div>
									)}
									{handOrder.length > 0 && (
										<div className="border-b border-[#e8eaed] px-4 py-2 text-xs">
											<p className="mb-1 font-medium text-[#5f6368]">Hands up, in order</p>
											{handOrder.map((r, i) => <p key={r.id} className="flex items-center gap-2 py-0.5 text-sm"><Hand className="h-3.5 w-3.5 text-[#068297]" />{i + 1}. {r.name}</p>)}
										</div>
									)}
									<ul className="space-y-1 p-3 text-sm">
										<li className="flex items-center gap-3 rounded-lg p-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-sauti-teal text-xs text-white">{initials(shownName)}</span><span className="flex-1">{shownName} (you){isHost ? " · Host" : ""}</span>{!micOn && <MicOff className="h-4 w-4 text-[#5f6368]" />}{!camOn && <VideoOff className="h-4 w-4 text-[#5f6368]" />}</li>
										{remotes.map((r) => (
											<li key={r.id} className="group flex items-center gap-3 rounded-lg p-2 hover:bg-[#f8f9fa]">
												<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5f6368] text-xs text-white">{initials(r.name)}</span>
												<span className="min-w-0 flex-1 truncate">{r.name}{r.host ? " · Host" : ""}{r.companion ? " · Companion" : ""}</span>
												{r.hand && <Hand className="h-4 w-4 text-[#068297]" />}
												{r.muted && <MicOff className="h-4 w-4 text-[#5f6368]" />}
												{r.cam === false && <VideoOff className="h-4 w-4 text-[#5f6368]" />}
												<button onClick={() => setPinned((p) => (p === r.id ? null : r.id))} aria-label={pinned === r.id ? "Unpin" : "Pin"} className="flex h-7 w-7 items-center justify-center rounded-full text-[#5f6368] hover:bg-black/5">{pinned === r.id ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</button>
												{canModerate && (
																<>
																	{isHost && !r.host && !r.companion && <button onClick={() => addCohost(r.id)} title="Make co-host" className="rounded-full border border-[#dadce0] px-2 py-0.5 text-[11px] font-medium text-[#068297] hover:bg-[#f1fafb]">Co-host</button>}
																	<button onClick={() => hostCtl(r.id, "mute")} disabled={r.muted} aria-label={`Mute ${r.name}`} title="Mute" className="flex h-7 w-7 items-center justify-center rounded-full text-[#5f6368] hover:bg-black/5 disabled:opacity-30"><MicOff className="h-4 w-4" /></button>
														<button onClick={() => hostCtl(r.id, "remove")} aria-label={`Remove ${r.name}`} title="Remove from the call" className="flex h-7 w-7 items-center justify-center rounded-full text-[#d93025] hover:bg-[#fce8e6]"><UserMinus className="h-4 w-4" /></button>
													</>
												)}
											</li>
										))}
									</ul>
								</div>
							)}
							{panel === "info" && (
							<div className="space-y-3 p-4 text-sm">
								<p className="font-medium">{title || "Meeting"}</p>
								{description && <p className="whitespace-pre-wrap text-[#444746]">{description}</p>}
								{resources.length > 0 && (
									<div>
										<p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#5f6368]">Resources</p>
										<ul className="space-y-1">{resources.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#068297] hover:underline"><ExternalLink className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{r.label}</span></a></li>)}</ul>
									</div>
								)}
								<p className="break-all rounded-lg bg-[#f1f3f4] p-3 text-xs">{link}</p>
								<button onClick={() => { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} className="flex items-center gap-2 rounded-full border border-[#dadce0] px-4 py-2 text-[#068297] hover:bg-[#f1fafb]">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy joining link"}</button>
								<a href={mailto} className="flex items-center gap-2 text-[#068297] hover:underline"><Mail className="h-4 w-4" /> Send by email</a>
							</div>
						)}
					</aside>
				)}
			</div>

			{captionsOn && lines.length > 0 && panel !== "transcript" && (
				<p className={cn("pointer-events-none absolute inset-x-0 bottom-24 mx-auto w-fit max-w-[90%] rounded-lg px-4 py-2 text-center", capSize, a11y.contrast ? "bg-black text-yellow-300 ring-2 ring-yellow-300" : "bg-black/75 text-white")}>
					<span className="font-semibold">{lines[lines.length - 1].name}:</span> {lines[lines.length - 1].text}
				</p>
			)}

			{/* Bottom bar, as in Google Meet: details on the left, controls in the middle, panels on the right. */}
			<div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-5 sm:pb-3">
				<div className="hidden min-w-0 items-center text-sm md:flex"><span className="max-w-[16rem] truncate text-white/80">{title}</span></div>
				<div className="mx-auto flex items-center gap-2 md:mx-0">
					<Ctl onClick={toggleMic} label={micOn ? "Turn off microphone" : "Turn on microphone"} icon={micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />} danger={!micOn} />
					<Ctl onClick={toggleCam} label={camOn ? "Turn off camera" : "Turn on camera"} icon={camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />} danger={!camOn} />
					<Ctl onClick={() => setCaptionsOn((v) => !v)} label={captionsOn ? "Turn off captions" : "Turn on captions"} icon={<Captions className="h-5 w-5" />} active={captionsOn} className="hidden md:flex" />
					<Ctl onClick={toggleHand} label={handUp ? "Lower hand" : "Raise hand"} icon={<Hand className="h-5 w-5" />} active={handUp} className="hidden md:flex" />
					<Ctl onClick={toggleShare} label={sharing ? "Stop presenting" : "Present now"} icon={<MonitorUp className="h-5 w-5" />} active={sharing} className="hidden md:flex" />
					<div className="relative hidden md:block">
						<Ctl onClick={() => setA11yOpen((v) => !v)} label="Accessibility" icon={<Accessibility className="h-5 w-5" />} active={a11yOpen || a11y.contrast || a11y.size !== "md" || a11y.reduceMotion} />
						{a11yOpen && (
							<div className="absolute bottom-14 left-1/2 z-20 w-72 -translate-x-1/2 rounded-xl bg-white p-4 text-sm text-[#202124] shadow-xl">
								<p className="mb-3 font-medium">Accessibility</p>
								<label className="mb-3 flex items-center justify-between gap-3"><span>Captions</span><input type="checkbox" checked={captionsOn} onChange={(e) => setCaptionsOn(e.target.checked)} className="h-4 w-4 accent-[#068297]" /></label>
								<div className="mb-3">
									<span className="mb-1 block text-xs text-[#5f6368]">Caption size</span>
									<div className="inline-flex rounded-lg border border-[#dadce0] p-0.5">{([["md", "Normal"], ["lg", "Large"], ["xl", "Huge"]] as const).map(([k, l]) => <button key={k} onClick={() => setA11y({ ...a11y, size: k })} aria-pressed={a11y.size === k} className={cn("rounded-md px-3 py-1", a11y.size === k ? "bg-[#e0f2f5] text-[#068297]" : "")}>{l}</button>)}</div>
								</div>
								<label className="mb-3 flex items-center justify-between gap-3"><span>High contrast captions</span><input type="checkbox" checked={a11y.contrast} onChange={(e) => setA11y({ ...a11y, contrast: e.target.checked })} className="h-4 w-4 accent-[#068297]" /></label>
								<label className="mb-3 flex items-center justify-between gap-3"><span>Reduce motion</span><input type="checkbox" checked={a11y.reduceMotion} onChange={(e) => setA11y({ ...a11y, reduceMotion: e.target.checked })} className="h-4 w-4 accent-[#068297]" /></label>
								<label className="flex items-center justify-between gap-3"><span>Caption language</span>
									<select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-md border border-[#dadce0] bg-white px-2 py-1">{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
								</label>
								<p className="mt-3 text-xs text-[#5f6368]">All of these are off until you turn them on.</p>
							</div>
						)}
					</div>
					{canSave && <Ctl onClick={() => (recording ? void stopRecording() : startRecording())} label={recording ? "Stop recording" : "Record the meeting"} icon={recording ? <span className="h-3.5 w-3.5 rounded-sm bg-white" /> : <Circle className="h-5 w-5 fill-[#ea4335] text-[#ea4335]" />} active={false} danger={recording} className="hidden md:flex" />}
					<Ctl onClick={() => setMoreOpen(true)} label="More options" icon={<MoreVertical className="h-5 w-5" />} className="md:hidden" />
					<div className="relative hidden md:block">
							<Ctl onClick={() => setReactOpen((v) => !v)} label="Send a reaction (R)" icon={<Smile className="h-5 w-5" />} active={reactOpen} />
							{reactOpen && <ReactionPicker onPick={react} onClose={() => setReactOpen(false)} />}
						</div>
						<Ctl onClick={dockCall} label={inSuite ? "Picture in picture: the call in its own window, so you can keep working in the suite" : "Picture in picture"} icon={<PictureInPicture2 className="h-5 w-5" />} active={!!pipWin} className="hidden md:flex" />
					<button onClick={() => { if (isHost && visible.length > 0) setEndAsk(true); else void leave(); }} aria-label="Leave call" title="Leave call" className="flex h-12 w-16 items-center justify-center rounded-full bg-[#ea4335] hover:bg-[#d93025]"><PhoneOff className="h-5 w-5" /></button>
				</div>
				<div className="hidden items-center gap-1 md:flex">
					<div className="relative">
						<Ctl onClick={() => setPanel((p) => (p === "chat" ? "none" : "chat"))} label="Messages (T)" icon={<MessageCircle className="h-5 w-5" />} active={panel === "chat"} flat />
						{unreadChat > 0 && panel !== "chat" && <span className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ea4335] px-1 text-[10px] font-bold">{unreadChat > 9 ? "9+" : unreadChat}</span>}
					</div>
					<Ctl onClick={() => setPanel((p) => (p === "info" ? "none" : "info"))} label="Meeting details" icon={<Info className="h-5 w-5" />} active={panel === "info"} flat />
					<Ctl onClick={() => setPanel((p) => (p === "people" ? "none" : "people"))} label="People" icon={<Users className="h-5 w-5" />} active={panel === "people"} flat />
					<Ctl onClick={() => setPanel((p) => (p === "polls" ? "none" : "polls"))} label="Polls" icon={<BarChart3 className="h-5 w-5" />} active={panel === "polls"} flat />
					<Ctl onClick={() => setPanel((p) => (p === "settings" ? "none" : "settings"))} label="Call settings" icon={<Settings2 className="h-5 w-5" />} active={panel === "settings"} flat />
					<Ctl onClick={() => setPanel((p) => (p === "transcript" ? "none" : "transcript"))} label="Transcript" icon={<MessageSquareText className="h-5 w-5" />} active={panel === "transcript"} flat />
				</div>
			</div>

			{pipWin && createPortal(
				<div className="flex h-screen w-screen flex-col bg-[#191919] text-white">
					<div className={cn("grid min-h-0 flex-1 auto-rows-fr gap-1.5 overflow-auto p-1.5", visible.length > 0 ? "grid-cols-2" : "grid-cols-1")}>
						<div className="min-h-[90px]">{selfTile}</div>
						{remotes.map((r) => <div key={r.id} className="min-h-[90px]">{tile(r)}</div>)}
					</div>
					<div className="flex shrink-0 items-center justify-center gap-2 bg-[#191919] pb-2 pt-1">
						<Ctl onClick={toggleMic} label={micOn ? "Turn off the microphone" : "Turn on the microphone"} icon={micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />} danger={!micOn} />
						<Ctl onClick={toggleCam} label={camOn ? "Turn off the camera" : "Turn on the camera"} icon={camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />} danger={!camOn} />
						<Ctl onClick={() => pipWin.close()} label="Bring the call back to the page" icon={<Maximize2 className="h-5 w-5" />} />
						<button onClick={() => { pipWin.close(); leave(); }} aria-label="Leave call" title="Leave call" className="flex h-12 w-16 items-center justify-center rounded-full bg-[#ea4335] hover:bg-[#d93025]"><PhoneOff className="h-5 w-5" /></button>
					</div>
				</div>,
				pipWin.document.body,
			)}

			{endAsk && (
				<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Leave the call">
					<div className="w-full max-w-sm rounded-2xl bg-white p-5 text-[#202124] shadow-2xl">
						<h2 className="text-lg font-medium">Leave the call?</h2>
						<p className="mt-1 text-sm text-[#5f6368]">You are the host. The others can carry on without you, or you can end the call for everyone.</p>
						<div className="mt-4 flex flex-col gap-2">
							<button onClick={() => { setEndAsk(false); void leave(); }} className="h-11 rounded-full border border-[#dadce0] text-sm font-medium hover:bg-[#f8f9fa]">Leave, the call goes on</button>
							<button onClick={() => { setEndAsk(false); hostCtl("all", "end"); setTimeout(() => void leaveRef.current(), 400); }} className="h-11 rounded-full bg-[#ea4335] text-sm font-medium text-white hover:bg-[#d93025]">End for everyone</button>
							<button onClick={() => setEndAsk(false)} className="h-10 rounded-full text-sm font-medium text-[#068297] hover:bg-[#f1fafb]">Stay in the call</button>
						</div>
					</div>
				</div>
			)}

			{readyOpen && remotes.length === 0 && (
				<div className="absolute bottom-24 left-3 right-3 z-30 rounded-lg bg-white p-5 text-[#202124] shadow-2xl md:right-auto md:w-[26rem]">
					<div className="mb-4 flex items-center justify-between"><h2 className="text-lg">Your meeting&apos;s ready</h2><button onClick={() => setReadyOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"><X className="h-5 w-5" /></button></div>
					<a href={mailto} className="mb-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#068297] px-5 text-sm font-medium text-white hover:bg-[#056d7e]"><UserPlus className="h-4 w-4" /> Add others</a>
					<p className="mb-3 text-sm text-[#444746]">Or share this meeting link with others you want in the meeting</p>
					<div className="flex items-center rounded-lg bg-[#f1f3f4] py-2 pl-3 pr-1 text-sm"><span className="min-w-0 flex-1 truncate">{link.replace(/^https?:\/\//, "")}</span><button onClick={() => { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} aria-label="Copy joining info" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5">{copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}</button></div>
					<p className="mt-4 flex items-start gap-2 text-xs text-[#5f6368]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#068297]" /> Anyone with this link can join the call, so only share it with people you want in.</p>
					{name && <p className="mt-3 text-xs text-[#5f6368]">Joined as {name}</p>}
				</div>
			)}

			{moreOpen && (
				<div className="fixed inset-0 z-50 md:hidden" onClick={() => setMoreOpen(false)}>
					<div className="absolute inset-0 bg-black/50" />
					<div onClick={(e) => e.stopPropagation()} className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-[#202124]">
						<span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-[#dadce0]" />
						{([
							[sharing ? "Stop presenting" : "Present screen", <MonitorUp key="p" className="h-5 w-5" />, () => { setMoreOpen(false); void toggleShare(); }, sharing],
							[handUp ? "Lower hand" : "Raise hand", <Hand key="h" className="h-5 w-5" />, () => { toggleHand(); setMoreOpen(false); }, handUp],
							[captionsOn ? "Turn off captions" : "Turn on captions", <Captions key="c" className="h-5 w-5" />, () => setCaptionsOn((v) => !v), captionsOn],
							...(canSave ? [[recording ? "Stop recording" : "Record the meeting", <Circle key="rec" className="h-5 w-5 fill-[#ea4335] text-[#ea4335]" />, () => { setMoreOpen(false); if (recording) void stopRecording(); else startRecording(); }, recording]] : []),
							["Reactions", <Smile key="re" className="h-5 w-5" />, () => { setMoreOpen(false); setReactOpen(true); }, false],
							["Messages", <MessageCircle key="ch" className="h-5 w-5" />, () => { setPanel("chat"); setMoreOpen(false); }, panel === "chat"],
							["Picture in picture", <PictureInPicture2 key="pp" className="h-5 w-5" />, () => { setMoreOpen(false); void dockCall(); }, false],
							["People", <Users key="u" className="h-5 w-5" />, () => { setPanel("people"); setMoreOpen(false); }, false],
							["Meeting details", <Info key="i" className="h-5 w-5" />, () => { setPanel("info"); setMoreOpen(false); }, false],
							["Polls", <BarChart3 key="po" className="h-5 w-5" />, () => { setPanel("polls"); setMoreOpen(false); }, panel === "polls"],
							["Call settings", <Settings2 key="se" className="h-5 w-5" />, () => { setPanel("settings"); setMoreOpen(false); }, panel === "settings"],
							["Transcript", <MessageSquareText key="t" className="h-5 w-5" />, () => { setPanel("transcript"); setMoreOpen(false); }, false],
						] as [string, React.ReactNode, () => void, boolean][]).map(([label, icon, run, on]) => (
							<button key={label} onClick={run} className={cn("flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-[15px]", on ? "bg-[#e0f2f5] text-[#068297]" : "active:bg-black/5")}>{icon}{label}</button>
						))}
						<div className="mx-2 mt-2 rounded-xl border border-[#dadce0] p-3 text-sm">
							<p className="mb-2 flex items-center gap-2 font-medium"><Accessibility className="h-4 w-4" /> Accessibility</p>
							<div className="mb-2 inline-flex rounded-lg border border-[#dadce0] p-0.5">{([["md", "Normal"], ["lg", "Large"], ["xl", "Huge"]] as const).map(([k, l]) => <button key={k} onClick={() => setA11y({ ...a11y, size: k })} aria-pressed={a11y.size === k} className={cn("rounded-md px-3 py-1", a11y.size === k ? "bg-[#e0f2f5] text-[#068297]" : "")}>{l}</button>)}</div>
							<label className="flex items-center justify-between gap-3 py-1"><span>High contrast captions</span><input type="checkbox" checked={a11y.contrast} onChange={(e) => setA11y({ ...a11y, contrast: e.target.checked })} className="h-4 w-4 accent-[#068297]" /></label>
							<label className="flex items-center justify-between gap-3 py-1"><span>Reduce motion</span><input type="checkbox" checked={a11y.reduceMotion} onChange={(e) => setA11y({ ...a11y, reduceMotion: e.target.checked })} className="h-4 w-4 accent-[#068297]" /></label>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function Ctl({ icon, label, onClick, active, danger, className, flat }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; danger?: boolean; className?: string; flat?: boolean }) {
	return (
		<button onClick={onClick} aria-label={label} title={label} aria-pressed={active} className={cn("flex shrink-0 items-center justify-center transition", flat ? "h-11 w-11 rounded-full" : "h-12 w-12 rounded-full", danger ? "bg-[#ea4335] text-white hover:bg-[#d93025]" : active ? "bg-[#7fd3e0] text-[#0E1318]" : flat ? "text-white hover:bg-white/10" : "bg-[#1B232B] text-white hover:bg-[#27323b]", className)}>
			{icon}
		</button>
	);
}

/** Plays a stream; the presenter's own screen and a remote screen both use it. */
function StreamVideo({ stream, className, muted }: { stream: MediaStream | null; className?: string; muted?: boolean }) {
	const ref = useRef<HTMLVideoElement>(null);
	useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; if (ref.current && muted) ref.current.muted = true; }, [stream, muted]);
	return <video ref={ref} data-rec-video="1" data-rec-stage="1" autoPlay playsInline muted={muted} className={className} />;
}
function ScreenPreview({ stream }: { stream: MediaStream | null }) {
	return <StreamVideo stream={stream} muted className="h-full w-full object-contain" />;
}

function initials(n: string) { return n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?"; }

/** True while the person is talking: a quiet analyser on their audio, checked a few times a second. */
function useSpeaking(stream: MediaStream | null, muted: boolean) {
	const [on, setOn] = useState(false);
	useEffect(() => {
		if (!stream || muted || !stream.getAudioTracks().length) { setOn(false); return; }
		let ctx: AudioContext | null = null;
		let timer: ReturnType<typeof setInterval> | null = null;
		try {
			ctx = new AudioContext();
			const an = ctx.createAnalyser();
			an.fftSize = 256;
			ctx.createMediaStreamSource(stream).connect(an);
			const buf = new Uint8Array(an.frequencyBinCount);
			timer = setInterval(() => {
				an.getByteFrequencyData(buf);
				const avg = buf.reduce((x, y) => x + y, 0) / buf.length;
				setOn((cur) => (cur === avg > 14 ? cur : avg > 14));
			}, 180);
		} catch { /* no analyser */ }
		return () => { if (timer) clearInterval(timer); ctx?.close().catch(() => undefined); };
	}, [stream, muted]);
	return on;
}

function RemoteTile({ r, sinkId, audioOn, reaction, pinned, onPin }: { r: Remote; sinkId: string; audioOn: boolean; reaction?: string; pinned: boolean; onPin: () => void }) {
	const ref = useRef<HTMLVideoElement>(null);
	// The other person's own word on their camera wins: a switched-off camera still sends black frames.
	const hasVideo = r.cam !== false && !!r.stream?.getVideoTracks().some((t) => t.readyState === "live" && !t.muted);
	const speaking = useSpeaking(r.stream, r.muted);
	useEffect(() => { if (ref.current && r.stream) ref.current.srcObject = r.stream; }, [r.stream]);
	useEffect(() => {
		const el = ref.current as (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }) | null;
		if (el?.setSinkId && sinkId) el.setSinkId(sinkId).catch(() => undefined);
	}, [sinkId]);
	return (
		<div className={cn("group relative flex h-full min-h-[120px] items-center justify-center overflow-hidden rounded-2xl bg-[#2a2a2a] ring-2 transition", speaking ? "ring-[#7fd3e0]" : "ring-transparent")}>
			<video ref={ref} data-remote="1" data-rec-video="1" autoPlay playsInline muted={!audioOn} className={cn("h-full w-full object-cover", !hasVideo && "invisible absolute")} />
			{!hasVideo && <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4b5563] text-xl font-semibold">{initials(r.name)}</span>}
			{r.cam === false && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs"><VideoOff className="h-3 w-3" /> Camera off</span>}
			{!r.stream && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-white/60" />}
			{r.hand && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#068297]"><Hand className="h-4 w-4" /></span>}
			{reaction && <span className="absolute bottom-2 right-2 text-3xl drop-shadow">{reaction}</span>}
			<button onClick={onPin} aria-label={pinned ? `Unpin ${r.name}` : `Pin ${r.name}`} className={cn("absolute right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 opacity-0 transition hover:bg-black/70 focus:opacity-100 group-hover:opacity-100", r.hand ? "top-11" : "top-2")}>{pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button>
			<span className="absolute bottom-2 left-2 flex max-w-[80%] items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs">{r.muted && <MicOff className="h-3 w-3 shrink-0" />}<span className="truncate">{r.name}</span></span>
		</div>
	);
}
