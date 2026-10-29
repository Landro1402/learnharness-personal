"use client";
// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { PauseIcon, PlayIcon, SquareIcon, Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDictationActive } from "@/components/dictation-state";
import { chooseLocalVoice, SPEECH_RATES, speechPreferences, splitSpeechText, textForSpeech, type SpeechPreferences } from "@/src/core";
import { IDLE_SPEECH, SpeechPlayback, type SpeechPlaybackState } from "@/components/speech-playback";
import { GoogleSpeechPlayback } from "@/components/google-speech-playback";
import { GOOGLE_SPEECH_KEY, GOOGLE_SPEECH_MODELS, GOOGLE_SPEECH_VOICES, GOOGLE_SPEECH_CHUNK_LENGTH, googleSpeechOptions, type GoogleSpeechOptions } from "@/src/core";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import { useSettingsSaved } from "@/components/settings-signal";

const STORAGE_KEY = "lh:read-aloud:v1";
interface ReaderPreferences extends SpeechPreferences, GoogleSpeechOptions { provider: "google" | "device" }
function readerPreferences(value: unknown): ReaderPreferences {
	const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
	return { ...speechPreferences(input), ...googleSpeechOptions(input), provider: input.provider === "device" ? "device" : "google" };
}
interface SpeechContextValue {
	state: SpeechPlaybackState;
	voices: SpeechSynthesisVoice[];
	preferences: ReaderPreferences;
	configured: boolean | null;
	supported: boolean | null;
	dictating: boolean;
	read: (owner: string, markdown: string) => void;
	pause: () => void;
	resume: () => void;
	stop: () => void;
	configure: (preferences: ReaderPreferences) => void;
}
const SpeechContext = createContext<SpeechContextValue | null>(null);

/** One queue per session; voice preferences belong to this device, not the chat record. */
export function ReadAloudProvider({ sessionId, children }: { sessionId: string; children: ReactNode }) {
	const player = useRef<SpeechPlayback | null>(null);
	const google = useRef<GoogleSpeechPlayback | null>(null);
	const [state, setState] = useState<SpeechPlaybackState>(IDLE_SPEECH);
	const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
	const [preferences, setPreferences] = useState<ReaderPreferences>(() => readerPreferences(null));
	const [configured, setConfigured] = useState<boolean | null>(null);
	const [supported, setSupported] = useState<boolean | null>(null);
	const dictating = useDictationActive();
	const refreshKey = useCallback(() => {
		void fetch("/api/speech", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
			.then((body) => setConfigured(body ? Boolean(body.configured) : null)).catch(() => setConfigured(null));
	}, []);
	useEffect(refreshKey, [refreshKey]);
	useSettingsSaved((section) => { if (section === "keys") refreshKey(); });
	const stop = useCallback(() => { player.current?.stop(); google.current?.stop(); }, []);

	useEffect(() => {
		setState(IDLE_SPEECH);
		try { setPreferences(readerPreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"))); }
		catch { /* Reading still works when storage is unavailable. */ }
		const available = typeof window.speechSynthesis?.speak === "function" && typeof window.SpeechSynthesisUtterance === "function";
		setSupported(true);
		const cloud = new GoogleSpeechPlayback(setState);
		google.current = cloud;
		const synth = window.speechSynthesis;
		const controller = available ? new SpeechPlayback(synth, (text) => new SpeechSynthesisUtterance(text), setState) : null;
		player.current = controller;
		const loadVoices = () => {
			try { setVoices(synth?.getVoices().filter((voice) => voice.localService) ?? []); }
			catch { setVoices([]); }
		};
		const stop = () => { controller?.stop(); cloud.stop(); };
		loadVoices();
		synth?.addEventListener("voiceschanged", loadVoices);
		window.addEventListener("pagehide", stop);
		return () => {
			stop();
			player.current = null;
			google.current = null;
			synth?.removeEventListener("voiceschanged", loadVoices);
			window.removeEventListener("pagehide", stop);
		};
	}, [sessionId]);

	useEffect(() => { if (dictating) stop(); }, [dictating, stop]);

	const configure = useCallback((next: ReaderPreferences) => {
		const value = readerPreferences(next);
		if (value.provider === "google" && preferences.provider === "google" && value.model === preferences.model && value.voice === preferences.voice && value.language === preferences.language) google.current?.setRate(value.rate);
		else stop();
		setPreferences(value);
		try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Optional preference persistence. */ }
	}, [preferences, stop]);
	const read = useCallback((owner: string, markdown: string) => {
		if (dictating) return;
		stop();
		if (preferences.provider === "google") {
			google.current?.start(owner, splitSpeechText(textForSpeech(markdown), GOOGLE_SPEECH_CHUNK_LENGTH), preferences, preferences.rate);
			return;
		}
		const voice = chooseLocalVoice(voices, preferences.voiceURI, navigator.language);
		if (!voice || !player.current) {
			setState({ ...IDLE_SPEECH, owner, error: "No on-device voice is available. Install a system voice or try another browser." });
			return;
		}
		player.current.start(owner, splitSpeechText(textForSpeech(markdown)), voice, preferences.rate);
	}, [dictating, voices, preferences, stop]);
	const value = useMemo<SpeechContextValue>(() => ({
		state, voices, preferences, configured, supported, dictating, read, configure,
		pause: () => preferences.provider === "google" ? google.current?.pause() : player.current?.pause(),
		resume: () => preferences.provider === "google" ? google.current?.resume() : player.current?.resume(),
		stop,
	}), [state, voices, preferences, configured, supported, dictating, read, configure, stop]);
	return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

/** Receives exactly the visible passage; private answers and reasoning never enter speech. */
export function ReadAloud({ text, disabled = false }: { text: string; disabled?: boolean }) {
	const settings = useSettingsDialog();
	const speech = useContext(SpeechContext);
	const id = useId();
	const optionsId = useId();
	const speechRef = useRef(speech);
	speechRef.current = speech;
	useEffect(() => () => {
		if (speechRef.current?.state.owner === id) speechRef.current.stop();
	}, [id, text]);
	const prepared = useMemo(() => textForSpeech(text), [text]);
	if (!speech || !prepared) return null;
	const { state, preferences, voices } = speech;
	const active = state.owner === id && state.status !== "idle";
	const error = state.owner === id ? state.error : null;
	const selected = chooseLocalVoice(voices, preferences.voiceURI, typeof navigator === "undefined" ? "" : navigator.language);
	return (
		<div data-testid="read-aloud" className="my-2 flex flex-wrap items-center gap-2 font-ui text-xs text-muted-foreground"
			onKeyDown={(event) => {
				if (event.altKey) return;
				if (event.key === "Escape") { speech.stop(); event.preventDefault(); }
				event.stopPropagation(); // Keep quiz/compose shortcuts away from speech controls.
			}}>
			{active ? <>
				<Button type="button" variant="ghost" size="sm" onClick={state.status === "paused" ? speech.resume : speech.pause}>
					{state.status === "paused" ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
					{state.status === "paused" ? "Resume" : "Pause"}
				</Button>
				<Button type="button" variant="ghost" size="sm" onClick={speech.stop}><SquareIcon className="size-3.5" />Stop</Button>
				<span role="status">{state.status === "paused" ? "Paused" : state.status === "loading" ? "Preparing audio" : "Reading"} · {state.chunk}/{state.total}{state.cached ? " · Saved audio" : ""}</span>
			</> : <Button type="button" variant="ghost" size="sm"
				disabled={disabled || speech.supported === null || speech.dictating}
				onClick={() => speech.read(id, text)}
				title={disabled ? "Available when this response finishes" : preferences.provider === "google" ? "Read using Google speech" : "Read using an on-device voice"}>
				<Volume2Icon className="size-3.5" />Read aloud
			</Button>}
			<details className="relative">
				<summary className="cursor-pointer select-none">Speech options</summary>
				<div id={optionsId} className="mt-2 flex max-w-full flex-wrap items-center gap-3 rounded-lg border bg-popover p-3 text-popover-foreground">
					<label className="flex flex-col gap-1">Speech
						<select aria-label="Speech provider" className="rounded border bg-background p-1 text-foreground" value={preferences.provider === "device" ? "device" : preferences.language === "it" ? "google-it" : "google"}
							onChange={(event) => speech.configure({ ...preferences, provider: event.target.value === "device" ? "device" : "google", language: event.target.value === "google-it" ? "it" : event.target.value === "google" ? "en" : preferences.language })}>
							<option value="google">Google AI · English tutor</option><option value="google-it">Google AI · Italian tutor</option><option value="device">On-device</option>
						</select>
					</label>
					{preferences.provider === "google" ? <>
						<label className="flex flex-col gap-1">Voice
							<select aria-label="Google reading voice" className="rounded border bg-background p-1 text-foreground" value={preferences.voice}
								onChange={(event) => speech.configure({ ...preferences, ...googleSpeechOptions({ ...preferences, voice: event.target.value }) })}>
								{GOOGLE_SPEECH_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
							</select>
						</label>
						<label className="flex flex-col gap-1">Model
							<select aria-label="Google speech model" className="rounded border bg-background p-1 text-foreground" value={preferences.model}
								onChange={(event) => speech.configure({ ...preferences, ...googleSpeechOptions({ ...preferences, model: event.target.value }) })}>
								{GOOGLE_SPEECH_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
							</select>
						</label>
					</> : <label className="flex min-w-0 flex-col gap-1">Voice
						<select aria-label="Reading voice" className="max-w-full rounded border bg-background p-1 text-foreground"
							value={selected?.voiceURI ?? ""} disabled={!voices.length}
							onChange={(event) => speech.configure({ ...preferences, voiceURI: event.target.value })}>
							{!voices.length && <option value="">No on-device voices</option>}
							{voices.map((voice) => <option key={`${voice.voiceURI}:${voice.lang}`} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
						</select>
					</label>}
					<label className="flex flex-col gap-1">Speed
						<select aria-label="Reading speed" className="rounded border bg-background p-1 text-foreground" value={preferences.rate}
							onChange={(event) => speech.configure({ ...preferences, rate: Number(event.target.value) })}>
							{SPEECH_RATES.map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
						</select>
					</label>
					{preferences.provider === "google" ? <>
						<span className="basis-full">Generated on demand · saved audio replays without another Google request.</span>
						<span className="basis-full">Use a Free project in AI Studio. Billing and limits depend on your Google project.</span>
						<Button type="button" variant="outline" size="sm" onClick={() => settings.open("keys", GOOGLE_SPEECH_KEY)}>{speech.configured ? "Manage Google key" : "Add Google key"}</Button>
						<a href="https://aistudio.google.com/rate-limit" target="_blank" rel="noreferrer" className="underline">Google usage and limits</a>
					</> : <>
						<span className="basis-full">On-device speech · no API key.</span>
						{!voices.length && <span className="basis-full">Install a system voice or try another browser. Voice availability depends on this device.</span>}
					</>}
					<span className="basis-full">Code blocks and diagrams are skipped; formulas are read literally.</span>
				</div>
			</details>
			{error && <span role="alert" className="basis-full text-destructive">{error}</span>}
		</div>
	);
}
