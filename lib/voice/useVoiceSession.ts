"use client";

/**
 * useVoiceSession — the live voice engine, ported VERBATIM (logic-wise)
 * from the shipped Veronum voice client (public/chat-app/app.js, the same
 * code we deployed). It owns the OpenAI Realtime WebRTC session + Whisper
 * push-to-talk; the compare-specific bits (auth token, where a prompt
 * goes, what the "last reply" is) come in as callbacks so this stays a
 * reusable engine.
 *
 * Engine state lives in a single mutable ref (the React equivalent of the
 * original module-level `voice` object). Only the three values the UI
 * reacts to — enabled / status / micState — are React state.
 *
 * All /api/voice/* calls carry the Supabase Bearer token (the routes gate
 * on the same compare billing); the real OPENAI_API_KEY never reaches the
 * browser — only the ephemeral clientSecret from /api/voice/realtime-token.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "off" | "connecting" | "ready" | "listening" | "speaking";

export interface VoiceCallbacks {
  /** Supabase access token for /api/voice/* auth. */
  getToken: () => Promise<string | null>;
  /** A spoken/transcribed prompt to forward into the chat (compare send). */
  onSubmit: (text: string) => void;
  /** Text of the most recent assistant reply (for the summarize tool). */
  getLastReply: () => string;
  /** Optional: short context string pushed to the Companion on connect. */
  getContext?: () => string;
}

interface Engine {
  enabled: boolean;
  starting: boolean;
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  remoteAudio: HTMLAudioElement | null;
  micStream: MediaStream | null;
  micSender: RTCRtpSender | null;
  recorder: MediaRecorder | null;
  pttChunks: BlobPart[];
  holding: boolean;
  companionSpeaking: boolean;
  pendingSummary: string | null;
}

function freshEngine(): Engine {
  return {
    enabled: false, starting: false, pc: null, dc: null, remoteAudio: null,
    micStream: null, micSender: null, recorder: null, pttChunks: [],
    holding: false, companionSpeaking: false, pendingSummary: null,
  };
}

export function useVoiceSession(cb: VoiceCallbacks) {
  const v = useRef<Engine>(freshEngine());
  const cbRef = useRef(cb);
  cbRef.current = cb; // always call the latest callbacks without re-subscribing

  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<{ text: string; kind?: "ok" | "err" }>({ text: "" });
  const [micState, setMicState] = useState<MicState>("off");

  const sendEvent = useCallback((obj: unknown) => {
    const dc = v.current.dc;
    if (!dc || dc.readyState !== "open") return;
    dc.send(JSON.stringify(obj));
  }, []);

  // ── tool dispatch (data-channel function calls → /api/voice/*) ──────
  const authedFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const token = await cbRef.current.getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  }, []);

  const handleToolCall = useCallback(async (ev: { name?: string; arguments?: string; call_id?: string }) => {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(ev.arguments || "{}"); } catch { /* ignore */ }
    let output = "";
    try {
      if (ev.name === "submit_to_claude") {
        const prompt = String(args.prompt || "");
        if (prompt) { cbRef.current.onSubmit(prompt); output = "submitted to the chat"; }
        else output = "no prompt provided";
      } else if (ev.name === "summarize_claude_response") {
        output = cbRef.current.getLastReply() || "no reply yet";
      } else if (ev.name === "web_search") {
        const r = await authedFetch("/api/voice/web-search", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: String(args.query || "") }),
        }).then((x) => x.json());
        output = r.ok ? (r.answer || "(no answer)") : "search error: " + (r.error || "unknown");
      } else if (ev.name === "query_session_history") {
        // Compare history lives in the browser, not on disk — answer best-effort.
        output = cbRef.current.getLastReply() || "history not available";
      } else {
        output = `unknown tool: ${ev.name}`;
      }
    } catch (e) {
      output = "tool error: " + (e instanceof Error ? e.message : String(e));
    }
    sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: ev.call_id, output } });
    sendEvent({ type: "response.create" });
  }, [authedFetch, sendEvent]);

  const onRealtimeEvent = useCallback((ev: { type?: string; error?: { message?: string; type?: string; code?: string } } & Record<string, unknown>) => {
    if (!ev || !ev.type) return;
    switch (ev.type) {
      case "response.audio.delta":
        v.current.companionSpeaking = true;
        setMicState(v.current.holding ? "listening" : "speaking");
        break;
      case "response.done": {
        v.current.companionSpeaking = false;
        setMicState(v.current.holding ? "listening" : (v.current.enabled ? "ready" : "off"));
        const queued = v.current.pendingSummary;
        if (queued) { v.current.pendingSummary = null; announceFinished(queued); }
        break;
      }
      case "input_audio_buffer.speech_started":
        v.current.pendingSummary = null;
        break;
      case "response.function_call_arguments.done":
        void handleToolCall(ev as { name?: string; arguments?: string; call_id?: string });
        break;
      case "error":
        console.warn("[voice] realtime error", JSON.stringify(ev));
        setStatus({ text: "voice error: " + (ev.error?.message || ev.error?.type || ev.error?.code || "unknown"), kind: "err" });
        break;
    }
  }, [handleToolCall]);

  // Push the last assistant reply to the Companion so it can summarize aloud.
  const announceFinished = useCallback((text: string) => {
    if (!text) return;
    sendEvent({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: `CHAT_FINISHED: ${text.slice(0, 1800)}` }] } });
    sendEvent({ type: "response.create", response: { instructions: "Briefly summarize what just happened in 1-2 sentences. No greeting." } });
  }, [sendEvent]);

  const teardown = useCallback(() => {
    const e = v.current;
    try { e.dc?.close(); } catch { /* */ }
    try { e.pc?.close(); } catch { /* */ }
    try { e.micStream?.getTracks().forEach((t) => t.stop()); } catch { /* */ }
    try { e.recorder?.stop(); } catch { /* */ }
    try { e.remoteAudio?.remove(); } catch { /* */ }
    v.current = freshEngine();
    setEnabled(false);
    setMicState("off");
  }, []);

  const enable = useCallback(async () => {
    const e = v.current;
    if (e.enabled || e.starting) return;
    e.starting = true;
    setMicState("connecting");
    setStatus({ text: "starting voice…" });
    try {
      const tok = await authedFetch("/api/voice/realtime-token").then((r) => r.json());
      if (!tok.ok || !tok.clientSecret) throw new Error(tok.error || tok.detail || "no client_secret");
      setStatus({ text: "requesting microphone…" });
      e.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      e.pc = new RTCPeerConnection();
      e.remoteAudio = document.createElement("audio");
      e.remoteAudio.autoplay = true;
      document.body.appendChild(e.remoteAudio);
      e.pc.ontrack = (evt) => { if (e.remoteAudio) e.remoteAudio.srcObject = evt.streams[0]; };
      e.micSender = e.pc.addTrack(e.micStream.getAudioTracks()[0], e.micStream);
      e.dc = e.pc.createDataChannel("oai-events");
      e.dc.addEventListener("message", (evt) => {
        try { onRealtimeEvent(JSON.parse(evt.data)); } catch (err) { console.warn("[voice] bad event", err); }
      });
      e.dc.addEventListener("open", () => {
        const ctx = cbRef.current.getContext?.();
        if (ctx) sendEvent({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: ctx }] } });
      });
      const offer = await e.pc.createOffer();
      await e.pc.setLocalDescription(offer);
      const sdpResp = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(tok.model)}`, {
        method: "POST", headers: { Authorization: `Bearer ${tok.clientSecret}`, "Content-Type": "application/sdp" }, body: offer.sdp || "",
      });
      if (!sdpResp.ok) throw new Error(`realtime SDP exchange failed (${sdpResp.status})`);
      await e.pc.setRemoteDescription({ type: "answer", sdp: await sdpResp.text() });
      e.enabled = true;
      setEnabled(true);
      setMicState("ready");
      setStatus({ text: "voice ready · hold mic to talk · ✕ to stop", kind: "ok" });
    } catch (err) {
      console.error("[voice] enable failed", err);
      setStatus({ text: "voice failed: " + (err instanceof Error ? err.message : String(err)), kind: "err" });
      teardown();
    } finally {
      v.current.starting = false;
    }
  }, [authedFetch, onRealtimeEvent, sendEvent, teardown]);

  const pttStart = useCallback(() => {
    const e = v.current;
    if (!e.enabled) { void enable(); return; }
    if (e.holding) return;
    e.holding = true;
    try { sendEvent({ type: "response.cancel" }); } catch { /* */ }
    e.companionSpeaking = false;
    e.pendingSummary = null;
    try { e.micSender?.replaceTrack(null); } catch { /* */ }
    e.pttChunks = [];
    try {
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      e.recorder = new MediaRecorder(e.micStream!, { mimeType: mime });
      e.recorder.ondataavailable = (evt) => { if (evt.data && evt.data.size > 0) e.pttChunks.push(evt.data); };
      e.recorder.start(250);
    } catch (err) {
      setStatus({ text: "ptt start failed: " + (err instanceof Error ? err.message : String(err)), kind: "err" });
      e.holding = false;
      return;
    }
    setMicState("listening");
    setStatus({ text: "listening… release to send", kind: "ok" });
  }, [enable, sendEvent]);

  const pttEnd = useCallback(async () => {
    const e = v.current;
    if (!e.holding) return;
    e.holding = false;
    try {
      const track = e.micStream?.getAudioTracks()[0];
      if (track) await e.micSender?.replaceTrack(track);
    } catch (err) { console.warn("[ptt] re-engage mic failed", err); }
    const rec = e.recorder;
    e.recorder = null;
    if (!rec) { setMicState(e.enabled ? "ready" : "off"); return; }
    const stopped = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
    try { rec.stop(); } catch { /* */ }
    await stopped;
    if (e.pttChunks.length === 0) { setMicState(e.enabled ? "ready" : "off"); setStatus({ text: "nothing captured", kind: "err" }); return; }
    setMicState("connecting");
    setStatus({ text: "transcribing…" });
    const blob = new Blob(e.pttChunks, { type: rec.mimeType || "audio/webm" });
    e.pttChunks = [];
    try {
      const tr = await authedFetch("/api/voice/transcribe", { method: "POST", headers: { "Content-Type": blob.type }, body: blob }).then((r) => r.json());
      if (!tr.ok || !tr.text) throw new Error((tr.openaiBody || tr.error || "empty transcription").slice(0, 240));
      setMicState("ready");
      setStatus({ text: `heard: "${tr.text.slice(0, 60)}"`, kind: "ok" });
      cbRef.current.onSubmit(tr.text);
    } catch (err) {
      setMicState(e.enabled ? "ready" : "off");
      setStatus({ text: "transcribe failed: " + (err instanceof Error ? err.message : String(err)), kind: "err" });
    }
  }, [authedFetch]);

  // Tear down the session if the component unmounts mid-call.
  useEffect(() => () => teardown(), [teardown]);

  /** Call when a chat reply finishes so the Companion can summarize it. */
  const onReplyFinished = useCallback((text: string) => {
    if (!v.current.enabled || !text) return;
    if (v.current.companionSpeaking) v.current.pendingSummary = text;
    else announceFinished(text);
  }, [announceFinished]);

  return { enabled, status, micState, enable, disable: teardown, pttStart, pttEnd, onReplyFinished };
}

export type VoiceApi = ReturnType<typeof useVoiceSession>;
